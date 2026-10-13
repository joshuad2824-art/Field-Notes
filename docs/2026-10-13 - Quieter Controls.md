# October 13 quieter controls (third pass)

Joshua reviewed the "Field Notes — Quieter Controls" proposal and its mockups and asked for all of it, plus three calendar changes of his own. He had not chosen between the options the proposal left open, so the recommended ones were taken: the room's name is a passing caption rather than a fixed label slot; one fold mark cycles rather than two folds; the phone's sheet does not carry the notebooks. The proposal itself, with the measurements behind it, is `docs/2026-10-13 - Toolbars and Navigation Proposal.md`.

The goal: the October 13 grammar was right; what was left was feel. Marks that move under the hand, surfaces that stack, controls that say nothing about what they do. The look — palettes, type, tiles, mascots, highlighters, the 28px grid — is unchanged.

## What changed

| # | Where | Before | Now |
| --- | --- | --- | --- |
| P1 | Notebook switcher under a list's name (phone, tablet, desk with the sidebar folded) | The chevron turned and nothing appeared: `.list-title { overflow: hidden }` (frame.css) clipped the shelf to the height of the name | The switcher's container no longer clips; the label still ellipsizes on its own. The page toolbar's copy gets the same rule. |
| P2 | Pill, tablet and desk | 375–495px wide by route; the active room widened to carry its name and ← came and went, so Notebooks drifted 62px and + 59px between rooms | Every mark has a fixed slot on every route. ← keeps its slot, empty and inert, where there is nowhere up to go. The room you are in is a well that settles from slot to slot (240 ms, the standard ease; reduced motion swaps it). The name is a caption above the pill, under the pointer or focus and for 1.4 s on arrival. Measured: 429px and identical x for every mark on all nine rooms at 1440. |
| P3 | Pill, phone | ← · the room's glyph · +; the glyph raised a second pill of unlabelled glyphs, whose ⋯ raised a third surface | ← · the room by name (a notebook's own name inside one) with a caret · +, at one width. The name raises one sheet: the five rooms with their names, a rule, then the six back rooms. Anywhere in two taps. A short swipe up on the pill raises it too. |
| P4 | + where a room implies nothing | Three unlabelled glyphs in a column over the content | A row of three named choices above the pill: Page (with the remembered notebook's dot and name), Event (today), Quick note (file later). |
| P5 | Pill under a resting mouse | Receded to a bar after three still seconds and came back at every twitch | Dims to 40% where it is; any movement brings it back. Scrolling down and typing still recede it. Touch unchanged. |
| P6 | Folding columns on a desk | A boxed ‹ in the list head, a › before the name once folded, a sidebar glyph on the leaf: three glyphs, four places | One fold mark at the leaf's top-left, drawn with a line for each column open. It steps notebooks + list + page → list + page → page alone → back, and ⌘\ steps the same cycle. ⌘⇧\ still turns the notebooks on and off alone. Between 1120 and 1199, where the notebooks column can't dock, it is list ⇄ page. The list head's ‹ › retired. |
| P7 | Aa | Toolbar, then a band of section tabs with its own ×, then the tools: three bands over the writing | The toolbar's row becomes the strip: the sections as a small segmented control, the tools beside them, undo, redo, and Aa lit, which closes it (as does Esc). Where the Text section can't fit beside the row's marks — every phone, and any leaf under about 1320px — its tools take one line under the sections: two bands at most, never three. The strip takes the leaf's colours, so it reads on paper. Undo and redo no longer close it. Overflow fades at the edge. |
| P8 | Title menus | Only the notebook's name said it opened anything | One chevron, drawn once (`TitleChevron`), after every title that opens something: notebook names, St. John, the month name, the day's heading, the Workshop heading, a plan's title. An event's title keeps its pencil. |
| P9 | A plan's sections | A native `<select>` | A sticky row of the Workshop's own chips, so a long plan can still be crossed from anywhere in it. |
| P9 | Settings on a phone | Section tabs wrapped into two rows of tiny chips | One row of chips that scrolls sideways, fading at the edge. |
| — | Event rows, Today and Calendar (Joshua's request) | A line under each title naming its source: "Work · Read only", "Apple · Read only", "Davis · Read only", "Family calendar" | Gone. The bar's colour still tells the sources apart, and each row's accessible name still says its source and that it is read only. Locations stay. |
| — | Phone calendar's day sheet (Joshua's request) | The day's events, then the pages written that day | The day's events only. The month's written-day rings stay, and the pages are a tap away on the day agenda. |
| — | Phone calendar (Joshua's request) | The day sheet began right under the last week | 40px under the month and a little more padding at the sheet's head. |

## Decisions amended

- **Decision 13.** The pill holds still: fixed slots on every route, ← keeping its slot, the room as a well and its name as a caption. On a phone the room's mark carries the room's name and raises one sheet. One fold mark replaces "every column carries the control for the one beside it": it cycles 3 → 2 → 1 → 3, as does ⌘\.
- **Decision 17.** At rest a mouse dims the pill rather than receding it.
- **Decision 18.** The strip is still a strip along the top of the leaf, and now it opens in the toolbar's own row (with a second line where it doesn't fit). It has no × of its own.
- **Decision 19.** + is unchanged in what it makes; the chooser names its three choices and where a page will go.

## Decisions this pass made

- **Undo and redo keep the strip open.** They sit beside it in the same row now, and shaping a page and taking a step back are one activity. (`data-tray-keep` on the two buttons; `editor.mjs` asserts it.)
- **The strip keeps its three section names** (Text, Insert, Appearance) rather than the mockup's "Blocks" and "Look": the sections' contents didn't change, and the names are what the editor, spreadsheet and dismissal suites reach them by.
- **The Stale marker went with the source line.** It still reaches a screen reader through the row's name.
- **The pill's marks lost their native tooltips** (`title`). The caption says the same thing without a second, slower box.

## Tests

Every changed assertion targeted a control this pass moved on purpose; each keeps its meaning.

| Suite | Was | Now |
| --- | --- | --- |
| `pill.mjs` (helpers) | `raiseRooms` waited for `.pill-rooms`; `openAppMenu` pressed the raised ⋯ | `raiseRooms` waits for the sheet and returns its rooms; `openAppMenu` returns where the back rooms are (the sheet's rows on a phone, the app menu elsewhere); new `backRooms()` |
| `redesign-actions` | `.pill-rooms`, `.pill-menu`; "Hide the notebooks" / "Show the notebooks" | The helpers; the fold mark's three steps, asserting the sidebar goes and comes back |
| `tray-dismiss` | Clicked the toolbar row as a neutral spot; closed with the strip's × | Clicks the page foot's word count; closes with Aa |
| `editor` | Re-opened the strip with Aa after undo/redo (they used to close it) | Asserts undo and redo leave it open, then carries on |
| `controls-review` | Raised ⋯ inside the phone's rooms pill; "Hide/Show the notebooks"; "recedes after three still seconds" | The back rooms through the sheet or ⋯; the fold mark's cycle and ⌘\; dims at rest and does not leave. New: every pill mark holds its x and the pill one width on every route (tablet and desk), the caption under the pointer, the phone's room mark names the room, the switcher's shelf is hit-testable, the chooser names its choices and notebook, no source line or "read only" under events on Today, Calendar and Day, no page rows in the calendar's day sheet, the four title chevrons, plan chips not a select, the strip in the toolbar row with no × |

## Verification

- **The gate.** `BASE=http://127.0.0.1:5188 npm run check` on the branch: 29 of 31 suites pass, including `controls-review` at 6,017 assertions across 1920/1440/1180/820/390/320. The same two fail on untouched `main@97f6bc5` run alongside it in this environment: `links` (no route to example.com) and `open-editor-sync` (the faked mirror's host is intercepted by the session's proxy; on repeat runs it fails at alternating steps on both branches). Neither touches anything this pass changed; both passed on Joshua's Mac for v43. `main` also failed `sync` once in parallel and passed on the branch.
- **Measured.** At 1440×900 the pill is 429px on all nine rooms and every mark sits at the same x (Today 588, Notebooks 638, Calendar 688, Workshop 738, From Siena 788, ⋯ 849, + 905); before, 375–495px with drifts up to 62px.
- **The strip.** At 1800 the Text section's tools fit without scrolling on one line under the sections (968px of 968); at 2560 the strip shares the toolbar's row; at 1440 and on phones it scrolls with a fade.
- **Captures.** All 17 routes at six widths, 102 captures, no runtime errors and no horizontal overflow (`work/2026-10-13-quieter-controls/after/`).
- **Build.** `npm run build` clean; service worker v53.
- **Not verified here:** the iPhone under a real finger (the sheet, the swipe up, the strip's second line with the keyboard up) and propagation to another paired device.

## Preservation

No schema, sync, MCP, recurrence or import/export changes. Nothing touched the leaf's 28px grid or the highlighters. Quick-note filing is the same path. Every test ran on fixtures in unpaired localhost profiles.
