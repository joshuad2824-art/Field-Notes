# CLAUDE.md — the notebook app

*Working brief. Drop this at the root of the repo. It's the context a fresh session needs before touching anything.*

---

## What this is

A personal notes and journal app for one person, Joshua Davis. It carries the Timber & Ink design system. It replaces Apple Notes, which he keeps returning to and never enjoys.

Seven apps have been tried and abandoned over the years: Apple Notes, Day One, Moleskine Planner, Google Keep, Evernote, Bear, Timepage. **None of them died of missing features.** Moleskine was the best-looking and died of session logouts. Apple Notes is the plainest and survives on reliability. That asymmetry governs every decision below.

Companion documents, all of which should be read once at the start:

- `docs/teardown.md` — the seven apps, what each got right, what killed it
- `docs/architecture.md` — sync, storage, backup, risks, cost
- `docs/visual-system.md` — palette, type, grid, formatting, the pen
- `spike/phase0.html` — the working editor prototype this repo grows out of

The app itself is at the root: `src/`, `index.html`, `netlify.toml`. `npm run dev`.

---

## Settled decisions

Do not relitigate these without being asked. Each was argued through.

1. **One page type.** Not notes-and-entries-and-tasks. A page, plus light attributes: notebook, tags, pinned, optional entry date. The four uses (capture, long-form, journaling, reference) come from attributes, never from separate sections.
2. **No login, ever, after first run.** Device pairing with a non-expiring key. No sessions, no email, no password. The editor has no awareness a network exists — writes go to local storage and return immediately. Sync may fail without ever blocking the page.
3. **Markdown files are the storage format.** Export is trivial because storage *is* the export format. No proprietary document tree.
4. **Notebooks: exactly one level.** Field Notes, The Workshop, The Hearth, Church (names still provisional). No nesting, ever. Tags cut across notebooks.
5. **The syntax is never shown.** Not on hover, not on the active line. He will never want to see markdown. It lives in the file, not on the page.
6. **No zoom.** `user-scalable=no`.
7. **No handwriting / Pencil canvas.** Closed deliberately; removed the project's largest engineering risk.
8. **Solo use.** No sharing, no collaboration, no permissions. Conflicts are only ever between his own three devices.
9. **Web, not native — provisionally.** All three devices are Apple, so Swift + CloudKit is technically the better answer to the "never sign in" requirement. Web wins on iteration speed, which is what an app whose success is about *feel* actually needs. Revisit at the end of Phase 1, not before.
10. **Pen and stock are per-page attributes with an app-wide default behind them.** Settings holds the default; a page only stores its own value once it has been given one deliberately, so changing the default moves every page that never disagreed with it. This is still not light/dark mode — the frame stays night either way, and the setting chooses what stock the leaf is cut from.
11. **The page screen has no banner.** The leaf starts at the top of the screen and its own top margin carries the tools: back, the formatting row, undo/redo, and the ⋯ menu. Pin lives in that menu. The only thing above the page is a thin dark band behind the status bar, which exists so white status text stays legible over a cream leaf.

---

## The stack

- **Vite + React.** Not Astro — the Timber & Ink site is Astro, and it's the wrong tool for an offline-first app with a service worker and live local state. Same tokens, different framework.
- **Dexie over IndexedDB** for local storage. Primary store, not a cache.
- **MiniSearch or FlexSearch** for full-text search, entirely on-device. Search never touches the network.
- **Netlify** for hosting; he already ships there.
- **Supabase** for the sync mirror when Phase 2 arrives. CouchDB + PouchDB is the credible alternative and is purpose-built for this. Do not hand-roll a sync endpoint.
- **Design tokens** come from his real files — `colors.css` v2.2, `typography.css` v2.1, `surfaces.css` v2.0, `spacing.css`, `base.css`. Copy them in; don't reinvent values. Three added hues: oxblood `#530a28`, forest `#123737`, navy `#082744`.

## Data model

```
id         uuid, stable
notebook   one of the four
title      derived from first heading or first line, never required
body       markdown
tags       derived from inline #tags in body
created    timestamp
updated    timestamp
pinned     bool
entryDate  optional — the date this page is "about"
pen        ink | felt
stock      paper | night
deleted    tombstone, 30 days, never a hard delete
```

## Layout rules that are load-bearing

- Body: Spectral 17px, line-height **28px exactly** (1.647), measure 64ch.
- **Every block height is a multiple of 28px**, headings included, so the dot grid never drifts out from under the text. Break this and the page stops looking like paper.
- Dot grid pitch 28px. Paper: `rgba(20,42,43,.10)`. Night: `rgba(246,243,236,.06)`.
- Two stocks on the leaf itself: `paper` (cream page) and `night` (teal-900 page). The frame is always dark. This is not light/dark mode — it's one scene.
- One amber element per view. Inside a page that's the caret. Nothing else glows.
- Highlighters are pigment, not light: layered angled gradients, uneven radii, multiply on paper and screen on night. Five colors, `=={color}text==`.
- Motion: nothing between the tap and the text is ever animated. `--duration-instant` (90ms) or nothing.

## Voice in the interface

The Timber & Ink brand voice is first-person singular. **This app is the exception** — it has an audience of one, and that one wrote the copy. The chrome barely speaks: labels, not sentences. No "I", no "we", no personality in the buttons. The warmth is carried by the paper, the type, and the light. The podcast sign-off never appears anywhere in this app.

---

## Build order

**Phase 1 — the single-device notebook.** Everything below, no sync at all.

- ~~Real editor core.~~ **Done — CodeMirror 6.** It was evaluated and it wins on the one thing that mattered: `Decoration.replace` hides a marker *and* registers it as an atomic range, so the cursor steps over `**` in one move and backspace takes both asterisks. Writing that by hand on contenteditable is the spike's technique with more bugs. The grammar in `src/editor/markdown.ts` is the spike's, line for line; only the mechanism changed. `npm run check` asserts the two rules that quietly break — the syntax never showing, and every block height being a multiple of 28px.
- Four notebooks, the shelf screen, covers with brass plates and cream hairline edges.
- Capture, search, tags, pinning, checklists, the full formatting set.
- Export: a notebook or the whole shelf as a folder of `.md`.
- Then **live in it for a month before writing a line of sync code.** Every one of the seven apps failed at daily use, not at features. This is the phase that tells us whether ours will too.

**Phase 2 — sync and device pairing.** Only after Phase 1 has survived a month.

**Phase 3 — resurfacing (quiet "from your archive" on open, no notifications), the commonplace book import (~97 quotes and 40 aphorisms currently in Word), entry dates and a calendar lens, scheduled monthly export to iCloud Drive.**

Scheduled export is the highest-value safety feature in the project. The realistic threat to this archive is loss, not intrusion.

---

## Known open items

- **The name.** Still undecided, deliberately. It should come from the thing once it has a shape.
- **Colored highlights use a custom extension** (`=={forest}...==`). Plain `==` is the portable convention; the brace tag is readable but non-standard. Decide before there's a lot of content.
- **Export writes a small YAML frontmatter block** — notebook, created, updated, and any entry date, pin, pen or stock. Storage is still plain markdown; this is the one thing added on the way out, because a filename can't carry a created date and losing it would be worse. If it turns out to be clutter in another editor, drop it and accept the loss.
- **The manifest says "Field Notes"** because a PWA needs *some* name on a home screen. That's a placeholder standing in for the undecided one, not a decision.
- **Linotype Feltpen is commercially licensed.** The stack names it first with Caveat behind it, so it renders where he's installed it locally. If the felt page becomes daily, buy the webfont license and self-host.
- **The iOS keyboard accessory bar** — the up/down arrows and the Done tick — cannot be removed from a web app. It's the strongest concrete argument for the native path and should be weighed at the end of Phase 1. It's also the reason the formatting row sits at the top of the page rather than docked above the keyboard: two bars stacked on the keyboard would be worse than one bar at the top. If the accessory bar ever goes, the strip should move down.

---

## Where the build actually is

Phase 1 stands up end to end: the shelf and four covers, notebook lists with pinning,
the leaf editor, search, tags, trash with 30-day tombstones, export, and an installable
shell. Nothing in `src/` imports anything that talks to a network — that isn't a
convention, it's the whole point, and it should stay true until Phase 2.

Two things are built but unproven, because only daily use proves them:

- **The iOS keyboard.** Everything here was verified in desktop Chromium. The first
  round on a real phone found that iOS scrolls the whole document when the keyboard
  opens, dragging the tools off the top of the screen — `overflow: hidden` does not
  stop it, only a fixed body does. `src/lib/viewport.ts` sizes the app to the visual
  viewport and pins the body; that fix is written but has only been reasoned about,
  not watched.
- **The felt pen** falls back to Caveat everywhere Feltpen isn't installed.

The next move is not a feature. It's the month.

## How to work in this repo

Ship small and often — feel comes from fifty revisions, not one big build. When a choice is between beautiful and instant, instant wins; the slowness in this brand is aesthetic, never latency. When something in this file turns out to be wrong, say so plainly and change it here rather than working around it.
