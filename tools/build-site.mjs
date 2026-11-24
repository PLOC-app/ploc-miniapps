#!/usr/bin/env node
// Builds the gallery into _site/ (GitHub Pages):
//   _site/catalog.json              list of all mini apps
//   _site/index.html                gallery
//   _site/<slug>/                   the mini app itself, copied as is: THIS is the URL PLOC installs
//   _site/details/<slug>/index.html page with description, install button, QR code and the URL in clear
// Run `node tools/validate.mjs` first. SITE_URL overrides the public base URL.
import { mkdirSync, writeFileSync, copyFileSync, cpSync, rmSync, lstatSync } from "node:fs";
import { join } from "node:path";
import { ROOT, listSlugs, readApp } from "./lib.mjs";

const SITE_URL = (process.env.SITE_URL || "https://ploc-app.github.io/ploc-miniapps").replace(/\/+$/, "");
const REPO_URL = "https://github.com/PLOC-app/ploc-miniapps";
const OUT = join(ROOT, "_site");
const INSTALL_SCHEME = "ploc://miniapp?v=1&url=";   // opens PLOC and offers to add the mini app

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const CSS = `
:root{--bg:#fff;--fg:#1d1d1f;--muted:#6e6e73;--card:#f5f5f7;--accent:#02ABF8;--on-accent:#0b1b24;--border:#d2d2d7;--icon:none}
@media(prefers-color-scheme:dark){:root{--bg:#111;--fg:#f5f5f7;--muted:#a1a1a6;--card:#1c1c1e;--accent:#02ABF8;--on-accent:#0b1b24;--border:#3a3a3c;--icon:invert(1)}}
[hidden]{display:none!important}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 -apple-system,system-ui,sans-serif}
main{max-width:760px;margin:0 auto;padding:24px 16px 64px}a{color:var(--accent)}h1{margin:.2em 0}
.top{display:flex;align-items:center;gap:12px}.top img{border-radius:12px;display:block}.top h1{margin:0}
.muted{color:var(--muted)}.badge{display:inline-block;padding:2px 10px;border-radius:99px;background:var(--card);border:1px solid var(--border);font-size:13px;margin-right:6px}
.card{display:flex;gap:14px;align-items:center;padding:14px 16px;margin:10px 0;border-radius:12px;background:var(--card);color:inherit;text-decoration:none}
.card strong{display:block}.card .txt{min-width:0}.btn{display:inline-block;padding:10px 18px;border-radius:10px;background:var(--accent);color:var(--on-accent);text-decoration:none;font-weight:600}
.ico{flex:none;width:44px;height:44px;border-radius:12px;background:var(--bg);border:1px solid var(--border);display:flex;align-items:center;justify-content:center}
.ico img{width:26px;height:26px;filter:var(--icon)}.head{display:flex;gap:14px;align-items:center}.head h1{margin:0}
input[type=search]{width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--fg);font:inherit;margin:12px 0}
.qrs{display:flex;flex-wrap:wrap;gap:24px}.qrs figure{margin:0}.qrs figcaption{margin-top:6px;font-size:14px}
.qr{background:#fff;padding:12px;border-radius:12px;display:inline-block;line-height:0}.qr img{width:200px;height:200px}.btn.alt{background:var(--card);color:var(--fg);border:1px solid var(--border);margin-left:8px}
.url{display:flex;gap:8px;align-items:center;padding:10px 12px;border-radius:10px;background:var(--card);border:1px solid var(--border)}
.url code{flex:1;overflow-wrap:anywhere;font:14px ui-monospace,Menlo,monospace}.url button{font:inherit;padding:4px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--fg);cursor:pointer}
.shot{max-width:280px;width:100%;border-radius:16px;border:1px solid var(--border);display:block}
.chips button{border:1px solid var(--border);background:var(--bg);color:var(--fg);border-radius:99px;padding:4px 12px;margin:0 6px 6px 0;font:inherit;cursor:pointer}
.chips button[aria-pressed=true]{background:var(--accent);color:var(--on-accent);border-color:var(--accent)}
`;

const page = (title, body, root = "") => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><link rel="icon" href="${root}logo.png"><style>${CSS}</style></head><body><main>${body}</main></body></html>
`;

const icon = (name, root = "") => `<span class="ico"><img src="${root}icons/${esc(name)}.svg" alt="" width="26" height="26"></span>`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
copyFileSync(join(ROOT, "site", "qrcode.js"), join(OUT, "qrcode.js"));
copyFileSync(join(ROOT, "site", "logo.png"), join(OUT, "logo.png"));
cpSync(join(ROOT, "site", "icons"), join(OUT, "icons"), { recursive: true });

const catalog = [];
for (const slug of listSlugs()) {
    const app = readApp(slug);
    if (!app.meta) continue;
    const m = app.meta;
    const url = `${SITE_URL}/${slug}/`;
    const install = INSTALL_SCHEME + encodeURIComponent(url);
    const entry = {
        slug, name: m["ploc:name"], description: m.description, author: m.author, version: m["ploc:version"],
        category: m["ploc:category"], permissions: m["ploc:permissions"], icon: m["ploc:icon"], lang: m.lang || null,
        url, page: `${SITE_URL}/details/${slug}/`, install,
        preview: app.preview ? `${url}${app.preview}` : null,
        source: `${REPO_URL}/tree/main/miniapps/${slug}`,
    };
    catalog.push(entry);

    cpSync(app.dir, join(OUT, slug), { recursive: true, dereference: false, filter: src => !lstatSync(src).isSymbolicLink() });
    mkdirSync(join(OUT, "details", slug), { recursive: true });
    writeFileSync(join(OUT, "details", slug, "index.html"), page(`${entry.name} - PLOC Mini Apps`, `
<p><a href="../../">&larr; PLOC Mini Apps</a></p>
<div class="head">${icon(entry.icon, "../../")}<h1>${esc(entry.name)}</h1></div>
<p>${esc(entry.description)}</p>
<p><span class="badge">${esc(entry.category)}</span><span class="badge">${esc(entry.permissions)}</span><span class="badge">v${esc(entry.version)}</span>${entry.lang ? `<span class="badge">${esc(entry.lang)}</span>` : ""}
<span class="muted">by ${esc(entry.author)}</span></p>
<p><a class="btn" href="${esc(install)}">Install in PLOC</a><a class="btn alt" href="${esc(url)}">Open in browser</a></p>
<p class="muted">Or scan with PLOC (or your phone camera):</p>
<div class="qrs"><figure><div class="qr" id="qr"></div><figcaption>Install</figcaption></figure>${entry.preview ? `<figure><img class="shot" src="${esc(entry.preview)}" alt="Screenshot of ${esc(entry.name)}"></figure>` : ""}</div>
<h2>Add it by hand</h2>
<p class="muted">In PLOC, open <em>Mini apps</em>, add a mini app and paste this address:</p>
<div class="url"><code id="u">${esc(url)}</code><button type="button" id="copy">Copy</button></div>
<p class="muted">A mini app reads${entry.permissions === "write" ? " and can change" : ""} your cellar through the PLOC SDK: PLOC asks you what it may do.
<a href="${esc(entry.source)}">Read its source</a> before you install it. The page works in a normal browser too, with demo data when the app provides it.</p>
<script src="../../qrcode.js"></script>
<script>
(function () {
  var qr = qrcode(0, "L");
  qr.addData(${JSON.stringify(install)}, "Byte");
  qr.make();
  document.getElementById("qr").innerHTML = qr.createImgTag(6, 0);
  var b = document.getElementById("copy");
  b.onclick = function () {
    var t = document.getElementById("u").textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { b.textContent = "Copied"; }, function () {
      var r = document.createRange(); r.selectNodeContents(document.getElementById("u"));
      var s = getSelection(); s.removeAllRanges(); s.addRange(r);
    });
  };
})();
</script>`, "../../"));
}

writeFileSync(join(OUT, "catalog.json"), JSON.stringify({ generated: new Date().toISOString(), miniapps: catalog }, null, 2) + "\n");

const cats = [...new Set(catalog.map(c => c.category))].sort();
writeFileSync(join(OUT, "index.html"), page("PLOC Mini Apps", `
<header class="top"><a href="https://www.ploc.co"><img src="logo.png" alt="PLOC" width="48" height="48"></a><h1>PLOC Mini Apps</h1></header>
<p class="muted">Community mini apps for <a href="https://www.ploc.co">PLOC</a>. Pick one and install it in PLOC.
<a href="${REPO_URL}">Contribute on GitHub</a>.</p>
<input type="search" id="q" placeholder="Search a mini app" aria-label="Search a mini app">
<div class="chips" id="chips">${cats.map(c => `<button type="button" aria-pressed="false" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div>
<div id="list">${catalog.map(c => `
<a class="card" href="details/${esc(c.slug)}/" data-c="${esc(c.category)}" data-t="${esc((c.name + " " + c.description + " " + c.author).toLowerCase())}">
${icon(c.icon)}<span class="txt"><strong>${esc(c.name)}</strong><span class="muted">${esc(c.description)}</span><br>
<span class="badge">${esc(c.category)}</span><span class="badge">${esc(c.permissions)}</span></span></a>`).join("")}</div>
<script>
(function () {
  var q = document.getElementById("q"), cat = "";
  function apply() {
    var t = q.value.toLowerCase();
    document.querySelectorAll("#list .card").forEach(function (a) {
      a.hidden = (cat && a.dataset.c !== cat) || a.dataset.t.indexOf(t) < 0;
    });
  }
  q.oninput = apply;
  document.querySelectorAll("#chips button").forEach(function (b) {
    b.onclick = function () {
      cat = cat === b.dataset.c ? "" : b.dataset.c;
      document.querySelectorAll("#chips button").forEach(function (x) { x.setAttribute("aria-pressed", String(x.dataset.c === cat)); });
      apply();
    };
  });
})();
</script>`));

console.log(`Built ${catalog.length} mini app(s) into _site/ (base URL ${SITE_URL})`);
