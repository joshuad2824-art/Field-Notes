# Toolbars and navigation — a steadier, quieter pass

*Proposal, October 13, 2026. Nothing in the app has changed. The mockups live on the "Field Notes — Quieter Controls" canvas; this file is the plan behind them, written to drop into `docs/` beside the controls review and the phone pass if approved.*

---

## Bottom line

The October 13 grammar is right and should stay: one pill everywhere, up-not-back, Esc closes the last thing opened, + makes the obvious thing for the room, and the title is the menu. What's left is feel. The pill changes size from room to room, so every mark on it sits somewhere different each time you reach for it. The phone stacks three surfaces to reach a back room. Four controls fold two columns. The Aa tray lays three bands over the page. And one real bug: the notebook switcher under a list's name opens off-screen.

Eight changes fix that without touching the look. Three are small enough to ship together first.

---

## How this was looked at

`main@97f6bc5`, run locally on the redesign fixtures (no paired vault, no real notes), clock held at Oct 13 10:30. All 17 routes captured at 1440, 1180 and 390; then the open states — the phone's raised rooms, the app menu, the + chooser, the notebook switcher, the Aa tray, the receded pill, a folded rail — and the pill's geometry measured on nine routes.

---

## What's working, and stays

- **One pill on every screen**, tinted by the room (teal, navy on Calendar and St. John, driftwood in the Workshop). It's the best thing in the navigation.
- **Up, not back.** `up()` and its fixed parents; ← never leaves the app.
- **Esc and ⌘↑ and ⌘/⌃1–5.** Quietly excellent on a desk.
- **+ makes the room's thing.** Page in the notebook, event on the day, plan in the Workshop, ✓ on an open event form.
- **Receding while you type or scroll down.** The page truly becomes the page.
- **Room-coloured raised states, the 36×4 bar, the `--pill-lane`.**

---

## What's in the way

### 1. Bug — the notebook switcher opens out of sight

On a phone and a tablet, tapping a notebook's name at the head of its list flips the chevron and nothing appears. The menu is there (`.notebook-switcher-menu`, absolute, z-index 70, 232×347 at 39,77) but its parent carries `.list-title { overflow: hidden; text-overflow: ellipsis }` (`src/styles/frame.css:632`), so it's clipped to the height of the title. `elementFromPoint` at the menu's centre returns the list row under it. The phone pass added the chevron because the switcher couldn't be found; the menu it opens can't be seen. The page toolbar's copy of the switcher (`.tools-switcher`) wasn't checked.

### 2. The pill moves under your hand (desk and tablet)

The pill's width follows the route: ← comes and goes, and the active room widens to carry its name. Measured at 1440×900:

| Route | Pill width | Today at | Notebooks at | + at |
| --- | --- | --- | --- | --- |
| Today | 420 | 565 | 637 | 900 |
| Notebook | 449 | 528 | 615 | 914 |
| Page | 495 | 551 | 638 | 937 |
| Calendar | 437 | 533 | 583 | 909 |
| Day | 483 | 556 | 606 | 932 |
| Workshop | 444 | 530 | 580 | 912 |
| Plan | 490 | 553 | 603 | 935 |
| From Siena | 451 | 526 | 576 | 916 |
| Settings | 375 | 565 | 615 | 878 |

*(centre x of each mark, px)*

Across nine rooms the pill runs 375–495px wide; Notebooks drifts 62px, + drifts 59px, Today 39px. The hand learns a place and the place moves. This, more than anything visual, is why the pill doesn't yet feel smooth.

### 3. The phone stacks three surfaces

The phone pill is ← · room · +. The room's mark is the current room's glyph alone, which reads as *where you are*, not *where else you can go*. Tapping it raises a second pill of five unlabelled glyphs and a ⋯; the ⋯ raises a third surface, a two-column card. Settings, Trash and Search are three taps and three different shapes away.

### 4. + chooses in pictures only

Where a room doesn't imply a thing, + raises three unlabelled glyphs in a vertical stack that sits over the content (over the month card on Today). It doesn't say where a page will be filed.

### 5. On a desk, resting the mouse makes the pill vanish

After three still seconds under a mouse the pill shrinks to a bar; any movement brings it back. On a desk that reads as flicker — it leaves while you read and returns the moment the hand twitches.

### 6. Four controls fold two columns

A boxed ‹ at the top-right of the list folds the rail; when folded a › appears before the notebook's name to bring it back; a sidebar glyph at the top-left of the leaf folds the list; on an empty notebook that same glyph floats at the desk's corner. Three glyphs, four places, two metaphors.

### 7. Aa lays three bands over the page

Toolbar, then a row of section tabs (Text · Insert · Appearance) with its own ×, then the tools. Roughly a hundred pixels over the writing, and the tools mix glyphs with words set in different faces (`code`, `AA`, `TITLE`, `Heading`, `SUB`).

### 8. Six title menus, one signpost

Tap-the-thing is right, but only the notebook name says so (the chevron). The month name, the day heading, the Workshop heading, the plan's title and St. John all open something and look exactly like titles that don't.

### 9. Two controls from another app

The plan view's native `<select>` "Sections", and Settings' section tabs, which wrap into two rows of tiny chips on a phone.

---

## The proposal

### P1 · Let the switcher be seen *(fix — small)*
Move the ellipsis to the name's inner span so the switcher's container doesn't clip, or portal the menu to the frame like the pill's shelf already is (`ShelfMenu` is one component; the pill's copy is positioned against the window and works). Add an assertion that the menu's centre hits the menu.

### P2 · A pill that holds still *(desk and tablet — medium)*
Every mark gets a fixed slot, on every route:

`[ ← ] · Today · Notebooks · Calendar · Workshop · From Siena │ ⋯ · +`

- The ← slot is always there. Where there's no parent it holds its space, empty and inert.
- The active room is a **well** that settles from slot to slot (240ms, the app's standard ease; nothing springs, and reduced motion swaps it).
- The room's name no longer widens the pill. It appears as a small caption above the pill on hover or focus, and for a moment on arrival, then fades.
- Result: one width (about 425px at a desk, from the measured 375px plus the ← slot), and every mark at the same x on every screen.

*Option B,* if the name in the pill is worth keeping: a fixed label slot after the well. Still steady, about 80px wider.

### P3 · One surface on a phone *(phone — medium)*
The room's mark carries its name and a small ▴ — `⊞ Today ▴` — so it reads as a door. Tapping it (or a short swipe up on the pill) raises **one** sheet: the five rooms as labelled marks across the top, a rule, then the back rooms as six quiet rows (Search, Colors, Manage notebooks, Ask Siena, Trash, Settings). Two taps to anywhere. Inside a notebook the sheet's Notebooks opens the shelf in place, as now.

### P4 · + says what it'll make *(all widths — small)*
The chooser rises as a short row of labelled chips above +, not a column over the content: **Page** *in Church* · **Event** *today* · **Quick note**. The page chip names the remembered notebook it'll file into.

### P5 · Rest is a dim, not a disappearance *(desk — small)*
With a mouse at rest the pill stays where it is at 40% and returns to full on hover. Scrolling down and typing still recede it to the bar. Touch is unchanged.

### P6 · One fold mark *(desk — medium; amends decision 13)*
One sidebar glyph, at the top-left of the leaf (or the empty desk), cycles **rail + list → list → page alone → back**, and ⌘\ steps the same cycle. The glyph draws how many columns are open. The ‹ box and the › before the name retire. ⌘⇧\ stays as "bring the rail back" for anyone who's learned it.

*Tradeoff:* decision 13 says each column carries the control for the one beside it. This trades that for one place and one meaning.

### P7 · Aa opens in place *(page — medium; amends decisions 17 and 18)*
The toolbar row *becomes* the strip. Left: the three sections as a small segmented control (Text · Blocks · Look). Middle: that section's tools, scrolling sideways as now. Right: Aa, lit, which closes it. One band instead of three, the page stays exactly where it was, and Esc still closes it first. Tools are drawn in the app's own icon hand; where a word earns its place (Title, Heading) it's set as a specimen in its own face.

### P8 · A chevron means a menu *(all widths — small)*
Every title that opens something carries the switcher's chevron: notebook names, St. John, the month name, the day heading, the Workshop heading, a plan's title. One rule, learned once. An event's title keeps its pencil, because it edits rather than opens.

### P9 · Two controls brought home *(small)*
The plan's "Sections" select moves into the plan title's menu as *Jump to…*. Settings' tabs become one sideways-scrolling strip on a phone, styled like the Workshop's filters.

---

## What doesn't change

Palette, type, tiles, mascots, highlighters and the 28px grid. The pill's colours per room. `up()`, the dismiss stack and every shortcut. What + makes in each room (only how the chooser looks). Sync, storage and the editor.

Settled decisions touched: **13** (P6's single fold, P2's fixed slots), **17** and **18** (P7: the strip opens in the toolbar's row, still a strip), **19** (P4: the chooser's presentation only).

---

## Order of work

| Pass | Items | Why together |
| --- | --- | --- |
| 1 | P1, P2, P4, P8 | The bug, the steadiness, and two small clarities. Biggest felt difference for the least code. |
| 2 | P3, P5 | Phone and desk rest behaviour; both live in the pill's own component. |
| 3 | P6, P7, P9 | Structural changes to the page and two screens; each needs its suites moved. |

Each pass keeps `controls-review` green and adds what it changes: the switcher's menu is hit-testable; every pill mark has the same x on every route at a width; the phone reaches every room and back room in two taps; Esc closes the strip before it lets go of the caret.

---

## Questions for Joshua

1. **P2:** the name as a passing caption (steadier, narrower), or in a fixed slot (always visible, wider)?
2. **P6:** one fold mark that cycles, or keep two folds but give them one glyph and one place each?
3. **P3:** should the raised sheet show the notebooks too (a row of coloured dots), or keep the shelf separate?
