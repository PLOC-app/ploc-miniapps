# PLOC Mini Apps

Community library of ready-to-use mini apps for [PLOC](https://www.ploc.co), the wine cellar app.
A mini app is a web page that PLOC opens in its own screen and that can use the PLOC SDK to read your cellar.

**Gallery: <https://ploc-app.github.io/ploc-miniapps/>**: pick a mini app, tap *Install in PLOC* or scan a QR code.

## Install a mini app

- On your phone: open the gallery, choose a mini app, tap **Install in PLOC**.
- Or in PLOC, open *Mini apps*, add one and paste its address: `https://ploc-app.github.io/ploc-miniapps/<slug>/`
  (every gallery page shows it).

A mini app can read (and sometimes change) your cellar: PLOC asks what it may do, and the source is public: read it.
Mini apps that change data say `ploc:permissions` = `write` in their header.

## Resources

- [PLOC JS SDK](https://github.com/PLOC-app/ploc-app-js-sdk): the `sdk` object, API catalog and TypeScript types.
- [PLOC skills](https://github.com/PLOC-app/ploc-skills): the skill that lets an AI assistant write PLOC scripts and mini apps.
- [PLOC scripts](https://github.com/PLOC-app/ploc-scripts): the same gallery, for scripts.
- [PLOC community](https://www.ploc.co/community/): ask questions and share what you build.

## Share a mini app

1. Write it (with the [PLOC skill](https://github.com/PLOC-app/ploc-skills) if you like) and test it in PLOC.
2. Add `miniapps/<slug>/index.html` starting from [`TEMPLATE.html`](TEMPLATE.html).
3. Open a pull request. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Repository

| Path | Content |
|---|---|
| `miniapps/<slug>/index.html` | one mini app per folder (plus its own static files and an optional `preview.png`), with the gallery header in its `<meta>` tags |
| `TEMPLATE.html` | starting point for a new mini app |
| `tools/validate.mjs` | checks the mini apps (`node tools/validate.mjs`) |
| `tools/build-site.mjs` | builds the gallery and `catalog.json` into `_site/` (`node tools/build-site.mjs`) |
| `site/` | QR code library (MIT), logo and the PLOC icons used by the gallery |
| `.github/workflows` | `validate.yml` on every pull request, `pages.yml` publishes the gallery when `main` changes |

`catalog.json` is generated, never edited by hand. It is published at `<gallery>/catalog.json`.

### What gets published

```
<gallery>/<slug>/            the mini app, copied as is: this address is what PLOC installs
<gallery>/details/<slug>/    its gallery page: description, install button, QR code, address in clear
<gallery>/catalog.json       every mini app, with its install link
```

### Install link

```
ploc://miniapp?v=1&url=<URL-encoded address of the mini app>
```

For example `ploc://miniapp?v=1&url=https%3A%2F%2Fploc-app.github.io%2Fploc-miniapps%2Ftonight-pick%2F`.

### One-time setup

In the GitHub repository settings: *Pages* → source **GitHub Actions**; *Branches* → protect `main` and require a
review from Code Owners.

## License

[MIT](LICENSE)
