# Handoff: Field Notes — home restructure, full-bleed page, pictures

## Overview

A design revision to **Field Notes** (`joshuad2824-art/Field-Notes`, branch `main`) covering four things:

1. **A new home.** The `--driftwood-800` chrome bar is removed; the date becomes the masthead. The shelf of four cover cards is replaced by a three-column desktop layout: a date/notebook rail, the page list, and the leaf.
2. **Notebooks become data.** `NOTEBOOKS` is no longer a hard-coded constant — any notebook can be added, colored from the palette, and deleted (pages tombstone for 30 days, as pages already do).
3. **The page fills its room.** The leaf spans the desk on desktop (20px surround) and is edge-to-edge under 1120px; the writing measure is fluid, capped at 900px.
4. **Pictures on the page.** Floated margin plates the text wraps around, and full-measure figures, both with captions and a lifted "print on the page" treatment.
5. **The pen changes** from Caveat to **Grape Nuts** (`--font-pen`, `--pen-size: 20px`).

## About the design files

The files in this bundle are **design references written in HTML** — prototypes of intended look and behavior. They are *not* production code to copy. The task is to **recreate them inside the existing Field Notes codebase** (React 19 + TypeScript + Vite, CodeMirror 6 editor, Dexie storage, plain CSS in `src/styles/`) using its established patterns: real CSS files with the existing class names and custom properties, not inline styles. The prototypes use inline styles only because of the tool they were authored in.

`Field Notes App.dc.html` is the design of record. `Field Notes — Home Restructure.dc.html` is the exploration canvas (turn 1 = two home directions, turn 2 = the chosen one, turn 3 = nine pen specimens). `Field Notes — Current Desktop.dc.html` is a pixel recreation of today's shipped UI, for before/after comparison.

## Fidelity

**High fidelity.** Every color, size, font and shadow below is traced to `src/styles/tokens.css` or to the Timber & Ink design system; nothing is invented. Recreate pixel-for-pixel. Where a value is new (the fluid measure ceiling, the picture plate shadow, Grape Nuts' sizes) it is called out explicitly and should be added to `tokens.css`.

---

## Screens / Views

### 1. Home / notebook (desktop, ≥ 1120px) — three columns

Replaces both `src/screens/Shelf.tsx` and the docked branch of `src/screens/NotebookScreen.tsx`.

Root: `height: 100%`, `background: var(--teal-800)`, `display: flex`. The existing `body::before` lantern + vignette wash is unchanged and still sits above the background, below content.

**Column A — the rail. `flex: 0 0 264px`, `background: var(--teal-900)`, `border-right: 1px solid rgba(246,243,236,0.06)`.** Top to bottom:

| Block | Spec |
| --- | --- |
| Wordmark | `assets/logo-wordmark-reverse.png`, `height: 19px`, `opacity: .82`. Padding `22px 20px 16px`, hairline bottom border. Never recolor with a filter — swap the file for paper stock. |
| Weekday | Oswald 500, 12px, `letter-spacing: .16em`, uppercase, `--teal-300`. |
| Day numeral | Playfair Display 700, **76px**, `line-height: .86`, `letter-spacing: -.02em`, `--cream-100`. |
| Month / year | Oswald 400, 14px, `.16em`, uppercase, `--brass-400`, two lines, `padding-bottom: 8px`, baseline-aligned to the numeral. |
| Ambient line | Courier Prime 11px, `.06em`, uppercase, `--teal-300`, `margin-top: 14px`. Copy: `Tulsa · 88° · clear`. Optional. |
| Week strip | 7-col grid, `gap: 2px`, padding `0 14px 18px`. Letters: Oswald 10px `.14em` at `rgba(156,177,178,.7)`. Numbers: Courier Prime 12px `--teal-300`, cells 30px tall. A 3px brass dot at `rgba(197,174,103,.5)` under any day that has pages. **Today** is a 28px circle, `background: var(--amber-500)`, `box-shadow: 0 0 18px rgba(222,157,75,.45)`, numeral Courier Prime 12px/700 in `--teal-800`. |
| Rule | `1px rgba(246,243,236,.06)`, `margin: 0 20px`. |
| "Notebooks" header | Archivo 600, 11px, `.14em`, uppercase, `--teal-300`; right-aligned "Manage" in the same style at `--brass-400` (hover `--brass-300`). |
| Notebook rows | `padding: 11px 10px`, `border-radius: 3px`. 9px round color dot with `1px solid rgba(246,243,236,.3)`; name Spectral 16px (`--cream-100` active / `--cream-200` idle); count Courier Prime 11px `--teal-300`. Active row: `background: rgba(246,243,236,.12)` + a 2px `--brass-400` marker inset 8px top/bottom on the left edge. Hover `rgba(246,243,236,.07)`. |
| "Add a notebook" row | Same geometry, dashed 1px dot, Spectral 16px italic `--teal-300`; opens the manager. |
| Foot | `padding: 16px 20px 20px`, hairline top. Primary: full-width, **44px**, `background: var(--cream-100)`, text `--teal-800`, Archivo 600 14px, radius 3px, `box-shadow: 3px 3px 0 rgba(0,16,17,.7)`. Hover: `translate(-1px,-1px)` + `background: var(--cream-050)`. Active: `translate(0,0)` + `inset 0 2px 4px rgba(0,16,17,.35)`. Below it a Courier Prime 11px row: `⌘⇧N` left, `Settings` right, `rgba(156,177,178,.7)`. |

**Column B — the page list. `flex: 0 0 372px`, `background: var(--teal-850)`, hairline right border.**

- Head, `padding: 18px 20px 14px`, hairline bottom: notebook color dot (9px) · name in Playfair 700 22px `--cream-100` · spacer · count in Courier Prime 11px uppercase `--teal-300`. Below it the search well: full width, 36px, `background: var(--teal-950)`, `border: 1px solid rgba(0,0,0,.4)`, `box-shadow: inset 0 1px 2px rgba(0,0,0,.5)`, radius 3px, Spectral 15px, placeholder `Search this notebook` in `--teal-700`. Focus border `rgba(222,157,75,.4)` (existing `.well`).
- Body: date-grouped rows. Group labels Archivo 600 11px `.14em` uppercase `--teal-300`, `padding: 18px 10px 6px`. Groups in order: **Pinned**, **Today**, **Yesterday**, **This week**, then `D MMM`.
- Row: `padding: 12px 10px`, radius 3px. Title Spectral 500 16px `--cream-100`; snippet Spectral 13px/20px `--teal-300`, single line, ellipsis; meta Courier Prime 11px `.06em` uppercase `--driftwood-400`, `margin-top: 6px`, form `9:07 PM · 98 words`. Pinned rows carry a `●` in `--brass-400` before the title. Active row as in the rail (12% wash + 2px brass marker). No bottom hairline between rows — the groups do that work.

**Column C — the desk + leaf.** `flex: 1 1 auto`, `display: flex; justify-content: center`, `padding: 20px 20px 0` (28px past 1500px).

- The leaf: `background: var(--teal-900)` (night stock), `width: 100%`, **`max-width: none`** — it fills the desk — `border-radius: 3px 3px 0 0`, `box-shadow: var(--shadow-lift)`, column flex, `overflow: hidden`.
- **Toolbar at rest is three marks, not eleven.** 44px tall, `padding: 0 38px`, `gap: 6px`: `☰` (toggle the columns) · spacer · `Saved` in Courier Prime 11px uppercase `rgba(156,177,178,.55)` · `Aa` (opens the style tray) · `⋯`. Buttons: 30px tall, min-width 32px, radius 3px, `rgba(156,177,178,.75)`; hover `rgba(246,243,236,.07)` + `--cream-200`. `Aa` when the tray is open: `background: rgba(246,243,236,.12)`, color `--brass-400`. When both columns are hidden the toolbar also shows a Courier Prime 11px breadcrumb: `field notes · saturday 15 august` at `rgba(156,177,178,.5)`.
- Writing area: `overflow-y: auto`; inside it a centered block, `max-width: min(100%, 900px + 2 × page-margin)`, `margin: 0 auto`, `padding: 22px <page-margin> 48px`. Page margin: 56px (80px past 1500px, 24px under 1120px). Dot grid unchanged: `radial-gradient(circle at 1px 1px, rgba(246,243,236,.06) 1px, transparent 0)`, `28px 28px`, offset `<page-margin> 29px`.
- Foot: centered, `max-width: min(100%, 900px)`, `margin: 0 <page-margin>`, `padding: 14px 0 20px`, `border-top: 1px solid rgba(246,243,236,.1)`, Courier Prime 12px `.06em` uppercase `--teal-300`: `98 words · edited 9:07 PM` … `#field-notes` in `--brass-400`. Under 1120px it gains a leading `‹ list` in `--brass-400`.

### 2. iPad (820–1119px) and iPhone (< 820px)

Screen-by-screen, exactly as `src/components/Shell.tsx` already frames it — nothing is docked below 1120px.

- **List screen** takes the whole window (`flex: 1 1 auto; width: 100%`). It gains a phone/tablet header above the notebook head: day numeral Playfair 700 64px + `Saturday / August 2026` in Oswald 12px `.16em`, and a `☰` on the right that opens the rail as an overlay. A bottom bar (`background: rgba(5,27,28,.92)`, hairline top, `padding: 12px 20px 22px`) carries `Search` in Oswald 12px `.16em` and the 44px cream **New page** block.
- **Page screen** is completely full screen: desk padding `0`, `box-shadow: none`, `border-radius: 0`, page margin 24px. The writing still respects the 900px measure cap, so it only bites on a landscape iPad.
- **The rail** is `position: absolute; inset-block: 0; left: 0; z-index: 6` with `var(--shadow-lift)` over a `rgba(0,16,17,.5)` scrim; tapping the scrim closes it. It **starts closed** below 1120px and **starts open** at/above it; crossing the boundary on resize reconciles the flag (same rule as `Shell.tsx`'s `useEffect`).

### 3. The style tray (opens from `Aa`)

Replaces the two `.panel` rows in `PageScreen.tsx`. `position: absolute; right: 20px; top: 48px; width: 236px`, `background: var(--teal-850)`, `1px solid rgba(246,243,236,.1)`, radius 4px, `var(--shadow-lift)`, `padding: 10px 0`.

Rows: **Style** label (Archivo 600 11px `.14em`) then Title / Heading / Sub as three equal cells; rule; the five highlighter swatches (22px circles: oxblood `#530a28`, forest `#123737`, navy `#082744`, driftwood `#3a342e`, brass `#7a6201` — brass is the current one, `2px solid var(--brass-400)`) with a Courier Prime `×` to clear; rule; **Picture** row with state `In the margin ▾`; **Pen** row with state in the pen face itself; **Stock** row with state `Night` in Courier Prime. Row states are `--brass-400`.

### 4. Notebook manager (dialog)

Scrim `rgba(0,16,17,.62)`. Card: `max-width: 468px`, `background: var(--teal-900)`, `1px solid rgba(246,243,236,.1)`, radius 5px, `0 2px 0 rgba(0,0,0,.5), 0 22px 52px rgba(0,0,0,.6)`, `max-height: 88vh`, scrolls.

- Title `Notebooks` in Playfair 700 20px; Courier Prime `×` to close.
- One row per notebook: 10px color dot · name Spectral 16px · count Courier Prime 11px uppercase `--driftwood-400` · `×` delete (hover color `#d98a9f`). Rows separated by 1px `rgba(246,243,236,.06)`.
- Delete confirmation appears inline, not as a second dialog: `background: var(--teal-850)`, `1px solid rgba(217,138,159,.35)`, radius 3px. Copy: **“Delete The Hearth?”** / “Its 7 pages go to the trash for thirty days.” Buttons `Delete it` (outlined `rgba(217,138,159,.45)`, text `#d98a9f`) and `Keep it` (outlined 14% cream).
- Add block: label `Add one`; a well-styled text input, placeholder **“What should I call it?”**; six 26px cover swatches, radius 2px — `#082744`, `#3a342e`, `#530a28`, `#123737`, `#24332A` (spruce-700), `#1B261F` (spruce-800) — selected gets `2px solid var(--brass-400)`; then the cream **Add notebook** block, disabled as `rgba(246,243,236,.09)` / `--teal-400` until the name is non-empty. Closing note in Spectral 13px italic: “Covers come from the palette, so a new notebook still looks like it belongs on the shelf.”

### 5. Pictures on the page

Two placements, both with a caption and both sitting **on** the paper:

- **Margin plate** — `float: right`, `width: 44%`, `max-width: 340px`, `margin: 6px 0 12px 24px`; image box 196px tall (7 × 28). Text wraps around it. **On a phone (< 820px) the float is dropped**: `float: none; width: 100%; margin: 6px 0 12px`, so the picture takes the measure and the writing runs above and below.
- **Full-measure figure** — full content width, 280px tall (10 × 28), preceded by `clear: both`.
- Image treatment (new tokens): `border-radius: 3px`, `border: 1px solid rgba(246,243,236,.12)`, `box-shadow: 0 1px 0 rgba(0,0,0,.5), 0 12px 28px rgba(0,0,0,.48)` (figure: `0 1px 0 rgba(0,0,0,.5), 0 14px 32px rgba(0,0,0,.5)`). Hover lifts `translateY(-2px)` and deepens to `var(--shadow-lift)`; transitions 90ms transform / 240ms shadow on `--ease-standard`.
- Caption: `border-top: 1px solid rgba(246,243,236,.1)`, `margin-top: 8px`, `padding-top: 8px`, Courier Prime 11px `.06em` uppercase `--teal-300`. Figures may carry a right-aligned date in the same style.
- In the real app these are the storage side of the feature, not just CSS: markdown needs an image node (`![caption](blob-id)` with a `{margin}` / `{full}` qualifier is the smallest thing that fits “a page is a markdown string”), the blob goes in Dexie beside the page (`src/lib/media.ts` already exists), the editor needs a `WidgetType` for it in `src/editor/markdown.ts`, and `src/lib/export.ts` needs to write the image files next to the markdown on export. The prototype fakes all of that with `<image-slot>`.

---

## Interactions & behavior

| Trigger | Result |
| --- | --- |
| `☰` in the page toolbar (desktop) | Hides **both** rail and list; the leaf keeps its measure and centers on the desk; a breadcrumb appears in the toolbar. Click again restores both. Keyboard `⌘\`. |
| `☰` (below 1120px) | Returns to the list screen. |
| `☰` in the list head (below 1120px) | Opens the rail as an overlay + scrim. |
| Tap a list row | Opens the page. Below 1120px this replaces the list screen entirely. |
| `‹ list` in the page foot (below 1120px) | Back to the list. |
| `Aa` | Toggles the style tray. |
| Notebook row | Selects that notebook; the list head, dot and counts follow. |
| `Manage` / `Add a notebook` | Opens the notebook manager. |
| `×` on a manager row | Inline confirmation, then delete. Active notebook falls back to the first remaining one. |
| `Add notebook` | Appends with the chosen cover and selects it. |
| Drag an image onto a plate | Fills it (prototype: persists to a sidecar; in the app: a Dexie blob). |
| Resize across 1120px | Rail flag reconciles — docked open, drawer closed. |

Motion follows the system: 90ms transform, 150ms color, 240ms surfaces, `--ease-standard`. Hovers lift up-left 1px on plate buttons and 2px on picture plates; nothing scales, nothing bounces.

## State

```ts
w: number                    // viewport width; drives docked / compact / phone
railOpen: boolean            // init: w >= 1120; reconciled on crossing 1120
listOpen: boolean            // desktop only
screen: 'list' | 'page'      // below 1120 only
tray: boolean                // style tray
manage: boolean              // notebook manager
confirm: NotebookId | null   // inline delete confirmation
newName: string, newColor: string
notebooks: Notebook[]        // now persisted (Dexie table), not a constant
activeId: NotebookId
```

Derived: `isPhone = w < 820`, `isCompact = w < 1120`, `isDocked = w >= 1120`, `wide = w >= 1500`.

Storage work implied: a `notebooks` table in `src/lib/db.ts` seeded with today's four; `NOTEBOOKS`/`notebookOf` in `src/lib/model.ts` read from it; deleting a notebook tombstones its pages using the existing `TOMBSTONE_DAYS = 30` path.

## Design tokens

Existing, unchanged — `src/styles/tokens.css`: `--teal-950 #001011`, `--teal-900 #051b1c`, `--teal-850 #0c2223`, `--teal-800 #142a2b`, `--teal-700 #22393a`, `--teal-300 #9cb1b2`, `--teal-200 #c1d4d4`; `--cream-050 #fdfaf3`, `--cream-100 #f6f3ec`, `--cream-200 #e9e6df`, `--cream-500 #a6a39c`; `--driftwood-800 #2a2622`, `--driftwood-700 #3a342e`, `--driftwood-400 #8c8172`; `--brass-700 #7a6201` … `--brass-300 #dac891`; `--amber-500 #c6862f`, `--amber-400 #de9d4b`; covers `--navy-800 #082744`, `--oxblood-800 #530a28`, `--forest-800 #123737`. Spacing 2/4/8/12/16/20/24/32/40/48/64. Radii 2/3/5/8. `--grid-pitch: 28px`. `--shadow-lift: 0 2px 0 rgba(0,0,0,.4), 0 18px 44px rgba(0,0,0,.56)`. `--duration-*`, `--ease-standard` unchanged.

New / changed:

```css
--font-pen: 'Linotype Feltpen', 'Grape Nuts', 'Caveat', var(--font-body);
--pen-size: 20px;              /* was 21px (Caveat) */
--pen-title: 30px;             /* h1 in the pen; was 34px */
--pen-quote: 22px;             /* blockquote in the pen; was 23px */
--measure-max: 900px;          /* fluid ceiling: min(100%, 900px) */
--sidebar-width: 264px;        /* was 268px */
--list-width: 372px;           /* new: the page-list column */
--cover-spruce-700: #24332A;   /* two added cover options */
--cover-spruce-800: #1B261F;
--shadow-print: 0 1px 0 rgba(0,0,0,.5), 0 12px 28px rgba(0,0,0,.48);
--shadow-print-wide: 0 1px 0 rgba(0,0,0,.5), 0 14px 32px rgba(0,0,0,.5);
```

Retired from the UI: the `--frame-chrome` bar on the shelf and notebook screens (`.chrome`), the full-width `.bottombar` on desktop, the `.cover` grid and `.plate`, `--cover-ratio`.

Type: add **Oswald** (400/500) to the font link for signage — weekday, month, month rail, tab-style labels; uppercase, `letter-spacing: .16em`, never below 14px except the 10px week letters. Add **Grape Nuts**. Playfair Display, Spectral, Archivo, Courier Prime unchanged.

## Assets

- `assets/logo-wordmark-reverse.png` — Timber & Ink wordmark, reverse cut, from the design system. Used in the rail. Swap the file (never a CSS filter) for paper stock.
- `assets/mark-ampersand.png` — brass ampersand; used only in the alternate full-bleed home (`1b`).
- `image-slot.js` — prototype-only drag-and-drop image placeholder. **Do not port it**; implement real image storage instead.
- No icon set is needed. The toolbar marks are text glyphs (`☰ ‹ ⋯ ×`) and the checkbox/highlighter are the app's own SVG paths in `src/editor/markdown.ts` / `src/styles/leaf.css`. The checkbox path is unchanged in shape but now drawn as a **circle** that fills brass when ticked, with the existing check path stroked in `--surface-page`:
  `M10 2.6c4.3-.5 7.7 3.2 7.4 7.5-.2 4.2-3.5 7.5-7.7 7.3C5.4 17.2 2.3 13.8 2.7 9.6 3 5.8 6.1 2.9 10 2.6z` (1.5 stroke) and `M6.2 10.2c1.1 1.1 2 2.4 2.8 4C10.7 10.6 12.8 7.2 15.4 4.6` (1.9 stroke).

## Files in this bundle

| File | What it is |
| --- | --- |
| `Field Notes App.dc.html` | **The design of record.** Live, responsive, interactive: column toggles, notebook manager, style tray, image plates. Open it and resize to see all three widths. |
| `Field Notes — Home Restructure.dc.html` | Exploration canvas. Turn 3 (top) = nine handwriting specimens; turn 2 = the chosen home; turn 1 = two home directions (`1a` docked, `1b` full-bleed rooms) plus iPhone and iPad frames. |
| `Field Notes — Current Desktop.dc.html` | Pixel recreation of the **current** shipped UI, built from `frame.css` / `leaf.css` / `tokens.css`, for before/after. |
| `assets/`, `image-slot.js` | Supporting files for the prototypes. |

## Suggested order of work

1. `tokens.css` — pen, measure, new shadows, Oswald + Grape Nuts in the font link.
2. Notebooks in Dexie: table + seed + `model.ts` reading from it; then the manager dialog.
3. The three-column shell: new `Rail` component, `Shell.tsx` gaining the list column, `railOpen` init/reconcile rules.
4. Home route replaces `Shelf.tsx`; delete `.chrome` / `.cover` / `.bottombar` usage from the desktop paths.
5. Leaf: `max-width: none`, centered measure block, full-bleed under 1120px, toolbar reduced to three marks, style tray.
6. Images: markdown node, Dexie blob, editor widget, export — the largest piece, and the only one that is not mostly CSS.
