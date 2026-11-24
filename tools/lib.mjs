// Shared helpers for validate.mjs and build-site.mjs (no dependency).
import { readdirSync, readFileSync, existsSync, statSync, lstatSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const APPS_DIR = join(ROOT, "miniapps");
export const ICONS_DIR = join(ROOT, "site", "icons");
export const CATEGORIES = ["dashboard", "cellar", "tasting", "discovery", "organization", "tools", "fun", "misc"];
export const PERMISSIONS = ["read", "write"];
export const MAX_FOLDER_SIZE = 1024 * 1024;       // whole mini app folder
export const MAX_PREVIEW_SIZE = 300 * 1024;
export const PREVIEWS = ["preview.png", "preview.jpg", "preview.webp"];
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const VERSION_RE = /^\d+\.\d+\.\d+$/;
// Folder names that would collide with files or paths of the published site.
export const RESERVED_SLUGS = ["details", "icons", "catalog", "index", "qrcode", "logo"];

/** Names of the icons PLOC knows (site/icons/<name>.svg, copied from the PLOC skill). */
export const icons = () => existsSync(ICONS_DIR)
    ? readdirSync(ICONS_DIR).filter(f => f.endsWith(".svg")).map(f => f.slice(0, -4)).sort()
    : [];

const NAMED = { quot: '"', apos: "'", lt: "<", gt: ">", amp: "&", nbsp: " ", eacute: "é", egrave: "è", ecirc: "ê", agrave: "à", acirc: "â", ccedil: "ç", ocirc: "ô", ucirc: "û", ugrave: "ù", icirc: "î", iuml: "ï", euml: "ë", rsquo: "’", lsquo: "‘", hellip: "…", ndash: "–", mdash: "—" };
const unescapeHtml = s => s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (m, d, h, n) =>
    d ? String.fromCodePoint(+d) : h ? String.fromCodePoint(parseInt(h, 16)) : (NAMED[n] ?? m));

/** Reads the `<meta name="..." content="...">` tags and the `<html lang>` of a page into `{ name: content }`.
 *  Comments, scripts and styles are ignored; the first occurrence of a name wins. */
export function parseMeta(html) {
    const clean = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, "");
    const attr = (tag, name) => {
        const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i"));
        return m ? (m[1] ?? m[2] ?? m[3]) : null;
    };
    const meta = {};
    for (const [tag] of clean.matchAll(/<meta\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi)) {
        const name = attr(tag, "name")?.trim(), content = attr(tag, "content");
        if (name && content !== null && !(name in meta)) meta[name] = unescapeHtml(content.trim());
    }
    const lang = clean.match(/<html\b(?:"[^"]*"|'[^']*'|[^'">])*>/i);
    const l = lang && attr(lang[0], "lang");
    if (l) meta.lang = l;
    return meta;
}

/** Lists `miniapps/<slug>/` folders (sorted). */
export function listSlugs() {
    if (!existsSync(APPS_DIR)) return [];
    return readdirSync(APPS_DIR)
        .filter(n => lstatSync(join(APPS_DIR, n)).isDirectory())   // a symlink is not a folder here: validate reports it
        .sort();
}

/** All entries of a folder, recursively, as paths relative to it. Symlinks are listed (never followed). */
export function walk(dir, base = dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
        const p = join(dir, e.name);
        return e.isDirectory() && !e.isSymbolicLink() ? walk(p, base) : [p.slice(base.length + 1)];
    });
}

export const symlinks = dir => walk(dir).filter(f => lstatSync(join(dir, f)).isSymbolicLink());

export function readApp(slug) {
    const dir = join(APPS_DIR, slug);
    const file = join(dir, "index.html");
    const files = walk(dir);
    const size = files.reduce((n, f) => n + lstatSync(join(dir, f)).size, 0);
    const preview = PREVIEWS.find(p => files.includes(p)) || null;
    if (symlinks(dir).length) return { dir, files, size, preview, html: null, meta: null, symlinks: symlinks(dir) };
    if (!existsSync(file)) return { dir, files, size, preview, html: null, meta: null };
    const html = readFileSync(file, "utf8");
    const js = files.filter(f => /\.m?js$/.test(f)).map(f => readFileSync(join(dir, f), "utf8")).join("\n");
    return { dir, file, files, size, preview, html, js, meta: parseMeta(html) };
}
