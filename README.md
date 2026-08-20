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
src/sync/      device pairing and the background mirror
src/weather/   one line of chrome, and the only other network in the app
src/styles/    Timber & Ink tokens, the frame, the leaf
supabase/      schema.sql — three tables and one row policy, run once
```

Storage is IndexedDB via Dexie, and it is the primary store — not a cache. A
page is a markdown string plus a small envelope, so export is a copy rather than
a conversion.

## Sync

Off until it is set up, and optional after that. There is no account and no
login: the first device generates a key, and every other device is handed it
once in a pairing code. Nothing expires.

Make a free Supabase project, run [`supabase/schema.sql`](supabase/schema.sql)
in its SQL editor, then paste the project URL and anon key into Settings → Sync.
The editor never waits on any of it — writes go to IndexedDB and return, and the
mirror catches up on its own.

## Deploying

Netlify, `npm run build`, publish `dist`. `netlify.toml` carries the build
settings and the SPA redirect.
