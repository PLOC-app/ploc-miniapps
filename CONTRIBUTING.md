# Contributing a mini app

Thank you for sharing your mini app with the PLOC community. A mini app is a web page opened by PLOC, with the
`sdk` object injected. Not sure how to write one? Ask an AI assistant with the
[PLOC skill](https://github.com/PLOC-app/ploc-skills), then test the result in PLOC.

## How to submit

1. Fork this repository (or use the GitHub web editor, which does it for you).
2. Create `miniapps/<slug>/index.html`. The folder name is the mini app id and the end of its address: lowercase words
   separated by dashes (`wine-quiz`).
3. Start from [`TEMPLATE.html`](TEMPLATE.html) and fill the header.
4. Check it locally (optional, needs Node 22+): `node tools/validate.mjs`
5. Open a pull request. The checks run automatically; a maintainer reviews the code before merging.

Once merged, your mini app is published on the gallery with a page, a QR code and an "Install in PLOC" link, at
`https://ploc-app.github.io/ploc-miniapps/<slug>/`. Nothing else to do: the catalog is rebuilt on every merge.

## The header

`<meta>` tags in the `<head>` of `index.html`. The first two are the ones PLOC reads; the others feed the gallery.

| Tag | Required | Value |
|---|---|---|
| `ploc:name` | yes | Name shown in PLOC, 40 characters max |
| `ploc:icon` | yes | An icon name from [`site/icons`](site/icons), without `.svg` (`puzzle` when nothing fits) |
| `description` | yes | One sentence, 200 characters max |
| `author` | yes | Your GitHub username |
| `ploc:version` | yes | `X.Y.Z`, increase it when you change the mini app |
| `ploc:category` | yes | One of `dashboard`, `cellar`, `tasting`, `discovery`, `organization`, `tools`, `fun`, `misc` |
| `ploc:permissions` | yes | `read` (does not change anything) or `write` (saves, deletes, consumes, restores...) |

Also set `<html lang="...">` (the gallery shows it) and the `viewport` tag.

## Files

- `index.html` is required. For something larger, add `app.js`, `style.css`, images... in the same folder, with
  relative paths. 1 MB maximum for the whole folder.
- Optional `preview.png` (or `.jpg`, `.webp`, 300 KB max): a screenshot, shown on the gallery page.
- Not allowed: symlinks, hidden files, and executables or archives (`.exe`, `.zip`, `.sh`, `.php`...).
- No build step: what is in the folder is what is published. Commit the built files if you use a toolchain, and keep
  them readable.

## Review rules

A mini app can read and change the whole cellar, so every mini app is read by a human before it is merged.

- Plain readable code: no minified or obfuscated code, no `eval` / `new Function`.
- Do not load `sdk.js`, do not declare `sdk` or `auth`, and wrap the code of **each** script in an IIFE (or use
  `<script type="module">`): a name that `sdk.js` already declares (`Wine`, `Order`, `Rack`...) breaks the page. The checks
  compile your JavaScript and catch it.
- Anything that changes or deletes data must ask for confirmation first (`sdk.dialog.confirm`) and say what will
  change. Declare `write` for it.
- User data goes into the page with `textContent`, not `innerHTML`.
- Prefer files in your folder to external libraries. When you need a library from a CDN, pin an exact version.
- Network access only when the mini app is about it, only to the services it announces in its description, and never to
  send cellar data to a third party. No iframes, no trackers, no ads.
- All mini apps of the gallery share the same web origin: prefix `sdk.storage` (and `localStorage`) keys with the slug (`wine-quiz.score`).
- Do not include secrets or personal data (names, emails, tokens, URLs with secrets): everything is public.
- The page must say something clear when `sdk` is missing (normal browser), ideally with demo data.

The automatic checks catch most format problems and warn about risky patterns, but they cannot prove a mini app is
safe: the review does.

## License

By submitting a mini app you agree to publish it under this repository's [MIT license](LICENSE).
