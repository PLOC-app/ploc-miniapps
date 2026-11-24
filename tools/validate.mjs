#!/usr/bin/env node
// Checks every miniapps/<slug>/. Errors fail the run (exit 1); warnings never do.
import { listSlugs, readApp, icons, CATEGORIES, PERMISSIONS, MAX_FOLDER_SIZE, MAX_PREVIEW_SIZE, SLUG_RE, VERSION_RE, RESERVED_SLUGS } from "./lib.mjs";
import { statSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import { spawnSync } from "node:child_process";

// Names PLOC's sdk.js already declares in the page (copy of ploc-skills sdk/reserved-names.txt) + sdk and auth.
const RESERVED = [...new Set([...readFileSync(join(dirname(fileURLToPath(import.meta.url)), "reserved-names.txt"), "utf8").split(/\s+/).filter(Boolean), "sdk", "auth"])];
// Declaring them first turns a redeclaration in a classic script into an early SyntaxError, without running anything.
const PRELUDE = RESERVED.map(n => `class ${n}{}\n`).join("");

/** Syntax check only, never executes the code. Returns an error message or null. */
function compile(code, module, withReserved) {
    if (module) {
        const dir = mkdtempSync(join(tmpdir(), "ploc-"));
        try {
            writeFileSync(join(dir, "m.mjs"), code);
            const r = spawnSync(process.execPath, ["--check", join(dir, "m.mjs")], { encoding: "utf8" });
            return r.status !== 0 ? (r.stderr.split("\n").find(l => /Error/.test(l))?.replace(/^SyntaxError: /, "") || r.error?.message || "syntax error") : null;
        } finally { rmSync(dir, { recursive: true, force: true }); }
    }
    try { new Script((withReserved ? PRELUDE : "") + code); return null; } catch (e) { return e.message; }
}

const REQUIRED = ["ploc:name", "ploc:icon", "description", "author", "ploc:version", "ploc:category", "ploc:permissions"];
const knownIcons = icons();
const slugs = listSlugs();
let errors = 0;
let warnings = 0;

const gha = (level, file, msg) => console.log(process.env.GITHUB_ACTIONS ? `::${level} file=${file}::${msg}` : `  ${level}: ${msg}`);

for (const slug of slugs) {
    const rel = `miniapps/${slug}/index.html`;
    console.log(slug);
    const error = msg => { errors++; gha("error", rel, msg); };
    const warn = msg => { warnings++; gha("warning", rel, msg); };

    if (!SLUG_RE.test(slug)) error("folder name must be lowercase words separated by dashes");
    if (RESERVED_SLUGS.includes(slug)) error(`"${slug}" is a reserved folder name`);
    const app = readApp(slug);
    if (app.symlinks) { for (const f of app.symlinks) error(`symlinks are not allowed: ${f}`); continue; }
    if (!app.html) { error("missing index.html"); continue; }
    const { html, meta, files, size } = app;

    if (size > MAX_FOLDER_SIZE) error(`folder is ${size} bytes (max ${MAX_FOLDER_SIZE})`);
    for (const f of files) {
        if (f.startsWith(".") || f.includes("/.")) error(`hidden file: ${f}`);
        if (/\.(?:exe|dll|zip|gz|tgz|dmg|apk|ipa|sh|bat|php)$/i.test(f)) error(`file type not allowed: ${f}`);
    }
    if (app.preview && statSync(join(app.dir, app.preview)).size > MAX_PREVIEW_SIZE) error(`${app.preview} is larger than ${MAX_PREVIEW_SIZE} bytes`);

    for (const f of REQUIRED) if (!meta[f]) error(`<meta name="${f}"> is required (see TEMPLATE.html)`);
    if (meta["ploc:name"] && meta["ploc:name"].length > 40) error("ploc:name is longer than 40 characters");
    if (meta["ploc:icon"] && !knownIcons.includes(meta["ploc:icon"])) error(`ploc:icon "${meta["ploc:icon"]}" is not a PLOC icon (see site/icons)`);
    if (meta["ploc:version"] && !VERSION_RE.test(meta["ploc:version"])) error("ploc:version must look like 1.0.0");
    if (meta["ploc:category"] && !CATEGORIES.includes(meta["ploc:category"])) error(`ploc:category must be one of ${CATEGORIES.join(", ")}`);
    if (meta["ploc:permissions"] && !PERMISSIONS.includes(meta["ploc:permissions"])) error("ploc:permissions must be read or write");
    if (meta.description && meta.description.length > 200) error("description is longer than 200 characters");
    if (!meta.viewport) warn('no <meta name="viewport">: the page runs in a phone webview');
    if (!meta.lang) warn('no <html lang="..."> (the gallery shows the language of the app)');

    // The page code is everything the browser would run: inline scripts and local .js files.
    const code = html + "\n" + app.js;

    // Must compile. Inline scripts and local .js files are checked one by one; a classic script is also checked
    // against the names sdk.js declares (redeclaring one breaks the page without any hint in a normal browser).
    const JS_TYPES = ["", "module", "text/javascript", "application/javascript", "application/x-javascript", "text/ecmascript", "application/ecmascript", "text/jscript"];
    const units = [];
    const moduleFiles = new Set();
    const noComments = html.replace(/<!--[\s\S]*?-->/g, "");
    for (const m of noComments.matchAll(/<script\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/script\s*>/gi)) {
        const attrs = m[1];
        const type = ((attrs.match(/\btype\s*=\s*["']?([^"'>]+?)["']?(?:\s|$)/i) || [])[1] || "").split(";")[0].trim().toLowerCase();
        const src = (attrs.match(/\bsrc\s*=\s*["']?([^"'\s>]+)/i) || [])[1];
        if (!JS_TYPES.includes(type)) continue;   // json, importmap, templates...
        if (src) { if (type === "module") moduleFiles.add(src.replace(/^\.?\//, "").split(/[?#]/)[0]); continue; }
        if (m[2].trim()) units.push({ label: "inline script", code: m[2], module: type === "module" });
    }
    for (const f of files.filter(f => /\.m?js$/.test(f))) {
        const code = readFileSync(join(app.dir, f), "utf8");
        units.push({ label: f, code, module: f.endsWith(".mjs") || moduleFiles.has(f) || /^\s*(?:import|export)\b/m.test(code) });
    }
    if (!units.length) warn("no JavaScript found");
    for (const u of units) {
        const err = compile(u.code, u.module, !u.module);   // classic scripts: with the names sdk.js declares
        if (!err) continue;
        error(/already been declared/.test(err) ? `${u.label}: ${err} (reserved SDK name or declared twice: wrap the code in an IIFE and never declare sdk or auth)` : `${u.label}: syntax error: ${err}`);
    }
    // Classic scripts of a page share one scope: two of them declaring the same name break the page.
    const classic = units.filter(u => !u.module);
    if (classic.length > 1 && classic.every(u => !compile(u.code, false, true))) {
        const err = compile(classic.map(u => u.code).join("\n;\n"), false, true);
        if (err) error(`scripts of the page clash: ${err} (wrap each script in an IIFE)`);
    }

    // Rules for the runtime environment.
    if (/<script\b[^>]*\bsrc\s*=\s*["'][^"']*sdk(?:\.min)?\.js/i.test(html)) error("do not load sdk.js: PLOC injects it");
    if (/\b(?:const|let|var|function|class)\s+(?:sdk|auth)\b/.test(code)) error("do not declare `sdk` or `auth`: they are injected");
    if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(code)) error("`eval` and `new Function` are not allowed");
    if (/<(?:iframe|object|embed)\b/i.test(html)) error("iframes and embeds are not allowed: the SDK is not injected in them");
    if (/<form\b[^>]*\baction\s*=\s*["']https?:/i.test(html)) error("a form must not post to another site");

    // Heuristics: warnings only, the human review decides.
    const writes = /\.(?:save|delete|consume)\s*\(|backup\.restore|miniApps\.install|files\.delete/.test(code);
    if (writes && meta["ploc:permissions"] === "read") warn("changes data but declares ploc:permissions read");
    if (writes && !/dialog\.confirm/.test(code)) warn("changes data without `sdk.dialog.confirm`");
    if (/sdk\.network\b|network\.(?:request|upload|download)|\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/.test(code)) warn("uses the network: check the destination in the review");
    for (const m of html.matchAll(/<(?:script|link|img)\b[^>]*\b(?:src|href)\s*=\s*["'](https?:)?\/\/([^/"']+)/gi)) {
        if (/<link\b[^>]*rel=["']?(?:canonical|alternate)/i.test(m[0])) continue;
        warn(`loads a resource from ${m[2]}: prefer files in the folder; the review checks it`);
    }
    if (/<script\b[^>]*\bsrc\s*=\s*["'](?:https?:)?\/\//i.test(html) && !/\bintegrity\s*=/.test(html)) warn("external script without `integrity`: pin the exact version (and add SRI if possible)");
    if (/\.innerHTML\s*[+]?=|insertAdjacentHTML|document\.write/.test(code)) warn("`innerHTML` / `document.write`: user data must go through `textContent`");
    if (/localStorage|sessionStorage|indexedDB/.test(code)) warn("uses browser storage: all mini apps share this origin, prefix keys with the slug (prefer sdk.storage)");
    if (/\bsdk\s*\[|globalThis\[|window\[/.test(code)) warn("dynamic access to `sdk` or globals: check the intent in the review");
    if (code.split("\n").some(l => l.length > 1500)) warn("very long line: is the code minified or obfuscated?");
}

console.log(`\n${slugs.length} mini app(s), ${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
