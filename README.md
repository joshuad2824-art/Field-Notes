# Field Notes

A personal notebook for one person. Local-first, offline, no login. Carries the
Timber & Ink design system.

The working brief is [`CLAUDE.md`](CLAUDE.md) — read that first. Companion
documents live in [`docs/`](docs), and the Phase 0 editor spike this repo grew
out of is [`spike/phase0.html`](spike/phase0.html).

## Running it

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/
npm run preview  # serve the build
```

Node 20 or newer.

## What's here

```
src/editor/    the CodeMirror 6 core — live markdown, no visible syntax
src/screens/   shelf, notebook, page, search, trash, settings
src/lib/       Dexie storage, search index, export, router
src/styles/    Timber & Ink tokens, the frame, the leaf
```

Storage is IndexedDB via Dexie, and it is the primary store — not a cache. A
page is a markdown string plus a small envelope, so export is a copy rather than
a conversion. Nothing here talks to a network; sync is Phase 2 and deliberately
not started.

## Deploying

Netlify, `npm run build`, publish `dist`. `netlify.toml` carries the build
settings and the SPA redirect.
