# October 13 controls review

Joshua approved every finding in the October 12 controls review and authorized the code changes, the amendments to settled decisions 13, 17 and 19 and the two October 12 notes, and a release once verification passed. The kickoff file was the complete spec. The goal, in one line: **one quiet control grammar used everywhere.** No screen is a dead end, every control appears once, no on-screen text explains the app to its only user, and every board uses its space. The look — palettes, type, tiles, mascots, highlighters, the dot grid — is unchanged.

## Scope

Commits on branch `controls-review-2026-10-13`, from baseline `39edc97` (production Netlify `6acd9c989e81e7268cffadb7`, service worker v41):

| Commit | Pass |
| --- | --- |
| `4204386` | Pass 2½ — the October sheets folded into one `redesign.css` (done first; see below) |
| `905465a` | Pass 1 and 2 — the control grammar; nothing a dead end; one of everything |
| `067f488` | Pass 3 — quiet |
| `a4a03f7` | Pass 4 — space, and the listed bugs |
| `124dc57` | Fixes the gate found, and test assertions moved to the new controls |
| `4b41cee` | Fixes from the independent review of the after captures |
| (release) | Service worker v42, this document, `00_START_HERE.md` |

### The control grammar

- **The pill is identical on every route** — Today, notebooks and pages at every width, Calendar, Day, Event, New event, Workshop, Plan, From Siena, the St. John desk, Search, Settings, Trash and Tag: ← (up, absent only on Today), Today · Notebooks · Calendar · Workshop · From Siena │ app menu (⋯) · +. It still hides while a keyboard is up. Notebooks opens the remembered notebook; Calendar the last-viewed month. The active room keeps its label on a desk.
- **The app menu** uses the `more` glyph and holds only the back rooms: Search, Colors, Manage notebooks, Ask Siena, Trash, Settings. Its icons share one 22px box, which is what fixed the misaligned Manage notebooks and Ask Siena rows (the Colors glyph had been 28px wide).
- **+ per room:** a page in that notebook (and on the St. John desk); Review last week in Journal through `collectWeek(lastWeekAt())`, filed in Journal; a new event on the day being viewed or selected in Calendar, Day and Event; a new plan in the Workshop and, in place, on a plan (the form opens there instead of sending you to the Workshop); elsewhere a chooser rising above + — page · event · quick note — with the page going to the remembered notebook. On New event and under an open quick note it is dimmed and `aria-disabled`.
- **The pill recedes** into a 36×4 bar, keeping a 44px target, while scrolling down, while typing, and after three seconds without pointer movement on a mouse. It returns on scroll up, at the end of a scroll, on any pointer movement, or a tap on the bar. Its body is drawn on `::before`, so it settles without moving any control on it; on touch, receded controls stop taking taps and the bar brings them back. Reduced motion swaps it with no transition.
- **A lane for it.** `--pill-lane` (pill + gap + `--safe-bottom`) pads every scroller in the app content, so the last row or line always scrolls clear.
- **Tap the thing.** Notebook name → the shelf as a popover (every width). Month name → month ⇄ day agenda, with ‹ › beside it and Today only away from the current month. A day's heading → its month. An event's title → edit. A plan's title → Add image, Edit, Print / Save PDF. The Workshop heading → New plan, Add equipment, On my desk, Workshop pages. "ST. JOHN" → its page list. The From Siena card's head → From Siena. A held or right-clicked spine → the manager on that notebook, with its name editable and its swatches open. A reminder's words → its details (every ⓘ is gone). An empty notebook's leaf → a new page.
- **Up, not back.** `parentOf()` and `up()` in `src/lib/router.ts`: page → its notebook's home (a Journal page → Journal; a Workshop page → the Workshop) → Today; notebook and St. John desk → Today; day → its month; calendar → Today; event → the day of its occurrence; new event → the day it was opened for, otherwise Calendar; plan → Workshop (and a plan being edited → that plan) → Today; tag → Search; Search, Settings, Trash and From Siena → the room they were opened from, otherwise Today. The router numbers its own history entries, so ← steps back only when the entry behind is that parent, and an in-app ← never leaves the origin. The browser's own back button is untouched.
- **Keyboard.** Esc closes whatever opened last (`src/lib/dismiss.ts` — menus, popovers, the style tray, sheets, the day sheet on a phone), then lets go of the caret, then goes up. ⌘↑ goes up when no field holds the caret. ⌘1–5 and ⌃1–5 open the five rooms.

### Removed (Pass 2 and 3)

Event: top-left back and Notebook buttons, bottom-left ⋯, bottom-right trash, the pill's Edit and Delete; "Open in Maps ↗" (the location is the link) and the WHERE and CALENDAR labels. Page: the pill's Aa, "Back to list". Notebook list: the foot's +, the empty desk's cover line, "Pick up a page.", "Your writing is right here.", "Write a new page" and "Import markdown" (Import stays in Settings). Plan: the top bar and the Title · Updated · Version line. Settings, Trash, Tag: the ← beside the title. St. John: the four header icons, "NOTEBOOK DESK", "Notebook pages", "Write a note", "All messages from Siena →", "Opens the source. Use your Ascension account." Day agenda: the → on every row, the sheet's ←, "An open day". Calendar and Day: the upper-right toggle and ⋯; "N pages · N events this month" and the per-cell "N pages". Desktop sidebar: the footer icons, the NOTEBOOK eyebrow, the page counts, and the "Add a notebook" row (now a quiet +). Today: "A thought to keep", the Notebooks card's "Manage". New event: "FIELD NOTES CALENDAR", the end-date help line, every "optional". Search: the "esc" hint and the "Tags" heading. From Siena: the "N new · N kept" line and each card's eyebrow where it doubled its column's. Journal: the ⓘ and its paragraph, and the review count. Workshop: "N PLANS · N ACTIVE · N PAUSED", "1 owned". Trash: "N ITEMS · EACH KEPT THIRTY DAYS". Quick note: "File in" and its explanation — the picker is a row of coloured notebook dots. Settings: the explanatory paragraphs under Sync, Weather, New pages, Backup and Import, and "Theme · Follow the last notebook". The consent text (the Anthropic key agreement, the line saying the prose pass sends the whole week) and the warning that the pairing code carries the vault key are kept word for word.

### Status lines and fades

The page toolbar shows nothing when the page is saved — `Saving` after two seconds pending, `Not saved` after a failure — and fades to a third while you type, back on hover or a 1.5 s pause. The page foot's word count and edited time sit at 50% opacity, full on hover; on touch they stay at 50%.

### Space (Pass 4)

- **Today on a desk** is sized to the window less its header and the pill's lane. At 1440×900 it has no vertical scroll (it was 943px of board), the pill does not touch a spine, and no spine name is clipped. Below about 820px of height it scrolls rather than squeezing.
- **The countdown tile** replaces the amber MON / 12 OCT tile: "4 days, 16 hrs" or "3 hrs, 20 min", "until", the title — the next timed event in the coming fourteen days from the schedule's own merged source, recurrences and Davis events included. Tapping it opens the event (a Davis event opens its read-only source). It refreshes once a minute and falls back to the date tile when nothing is coming. `src/lib/countdown.ts` has no clock or Dexie in it.
- **Schedule and Coming Up** share the first card from 820px up, stacked on phones.
- **The tablet board** (820–1199) is laid out on twelve columns so every row fills (the ~220px gap at the end of row two is gone). The month card stays square but spans five columns from 1000px, so it is about 450px instead of 661.
- **Day agenda:** an empty day collapses to the height of its date. **Event:** a centred 640px column on tablets and desks. **Workshop:** Tools on the Wall and Shop Routine size to their content; an empty Shop Routine is only its heading, and it still opens or creates the page. **Calendar on phones:** the selected day's pages are compact rows — notebook dot and title.

### Bugs fixed

The phone weather card printed "H 81° · L 59°" twice. Search drew a gold box inside its gold pill; it now has one quiet focus state, like the page. The list-foot + overlapped the last card (gone with the +). A repeat read "through 2026-12-17"; it reads "until Dec 17", with the year only when it is not this one — formatted at display (`repeatLine` in `src/lib/format.ts`) so the recurrence engine shared byte for byte with hosted MCP is untouched. Repeat's legend is a small-caps label above its fields. Surviving counts are pluralized (the notebook manager said "1 pages"; Search's group count too). On desktop pages the list toggle's "on" state no longer reads as a stuck focus box.

## Decisions this file did not cover

The rule given for silence was "the quieter option that keeps every view one tap from Today".

- **The CSS fold went first, not between Pass 2 and Pass 3.** Folding before any other change meant the fold could be pixel-compared against the clean production baseline rather than against an intermediate state, and every later pass edited one sheet instead of three. It still precedes Pass 3.
- **Eight targets on a 320px phone.** ← plus five rooms, the menu and + do not fit at 44px wide. They abut (no dead gap), stay 44px tall, and are 42px wide from 360px and 35px wide below it.
- **← closes an open sheet first.** On a phone the day agenda's sheet covers the agenda and its own ← was removed, so up from an open sheet is the view under it; Esc does the same.
- **Under the quick note the pill stays visible beneath the scrim, + inert,** rather than above it: above, it covered the notebook dots on a phone.
- **More duplicates went than were listed:** the calendar's selected-day "Day agenda" and "Add event" buttons and "Nothing on this day yet.", the day sheet's +, and the St. John desk's "Open Today →" — each repeated the month name, the pill's + or the pill's Today.
- **The page count left every list head,** not only Journal's "1 REVIEW".
- **Workshop pages has a real route** (`/n/<id>/pages`). `/n/<workshop>` redirects to the Workshop, so the link the October 12 menu offered had quietly led back where it started.
- **The list head names the notebook between 820 and 1199,** where it had been hidden, so the switcher exists at tablet width. On a desk it appears in the list head only once the sidebar is folded, since the docked sidebar already is the switcher.
- **An empty notebook's leaf keeps the moose** when the notebook has no pages (the mascots are part of the look); the list beside it still says "Nothing here yet. Plenty of time." Journal's leaf is inert, since nothing is written there by hand.
- **Esc in the search field goes up.** Search is a back room, so leaving it is what Esc means there.
- **Both gold rings left Search,** matching the editor's October 12 focus treatment, with a quiet background lift instead.
- **The Journal panel in Settings lost both explanatory paragraphs;** one had gone stale, pointing at a list-foot button that no longer exists.
- **The countdown under an hour reads "20 min",** and a whole number of days reads "2 days".
- **Today's header Search and Settings icons stay.** They were not listed, and each appears once on screen.
- **Holding the Journal spine does nothing extra** — Journal is reserved and refuses rename and recolour.
- **Settings' per-notebook export buttons are named "Export <notebook>",** which also stops "Journal" naming two controls on one screen.
- **The older structural sheets were left alone;** no rule was deleted from them.

## Preservation

No schema, sync, MCP, recurrence-engine or import/export changes; the hosted functions and `supabase/` are untouched. Quick-note filing is byte-for-byte the same path: the dots set the same `draft.notebook` through the same `change()`, and `closeQuickNote` still files and clears in one IndexedDB transaction and keeps the draft on failure. The 28px grid inside the leaf is untouched — no leaf CSS changed. Highlighters are unchanged. Every test ran on fixtures in unpaired localhost profiles; no real notes, events, images or paired vault were touched, and the paired live session in Joshua's browser was left alone.

## The fold (Pass 2½)

`pdf-adjustments.css` and `reference-corrections.css` were concatenated into `redesign.css` in import order (identical by construction), then a conservative pass (`work/2026-10-13-controls-review/fold-css.mjs`) moved 13 overrides into the earlier rule with the identical selector and context they overrode, only where no declaration of the same property family sat between the two, and removed the 4 rules left empty. No `!important` was dropped: each of the 25 in these sheets competes with a rule in an older sheet at equal or higher specificity, with an inline style, or with CodeMirror's injected sheet, so none could be proven unnecessary, and pixel identity has to hold in hover and focus states a screenshot cannot see. The list, with each reason, is in `work/2026-10-13-controls-review/fold-report.txt`.

Verification: all 17 routes at 1920/1440/1180/820/390/320 with the clock held at 2026-10-13 10:30, before (39edc97) and after, compared pixel by pixel (`tests/route-shots.mjs`, `tests/pixel-compare.mjs`). One image differs by 2 pixels and one by 1, in decoded raster images; two runs of the unchanged baseline differ in exactly those places, so they are noise.

## Changed assertions

Every assertion below targeted a control or string this pass removed or moved on purpose. Each was moved to the new control and keeps its meaning; none was dropped or loosened. `git show 124dc57 -- tests/` has the exact diffs.

| Suite | Was | Now | Why |
| --- | --- | --- | --- |
| `redesign` | Calendar tools → Colors | App menu → Colors | The calendar's upper-right tools retired (October 12 calendar note, amended) |
| `redesign` | Today's "Manage" | App menu → Manage notebooks | Pass 3 removed the link; the + spine and the spine long-press cover it |
| `redesign` | Sidebar footer → Colors | App menu → Colors | The sidebar footer retired (decision 13, amended) |
| `redesign-actions` | Eight destinations inside "Navigation and filters" | The five rooms in the pill; Search, Settings, Trash in the app menu | The app menu holds only the back rooms; all eight are still checked one tap away |
| `redesign-actions` | "Navigation and filters" → Manage notebooks | App menu → Manage notebooks | The menu's glyph and name changed |
| `redesign-actions` | Sidebar footer → Colors | App menu → Colors | As above |
| `pdf-adjustments` | Quick note `combobox "File quick note in"` | `radio "Church"` | The picker is a row of notebook dots; the filing assertion that follows is unchanged |
| `pdf-adjustments` | Today's pill has **no** Calendar (count 0) | It has Calendar (count 1) | The pill is identical on every screen |
| `pdf-adjustments` | Today's "Add event" | + → New event | Today's + is the page · event · quick note chooser |
| `pdf-adjustments` | Calendar has **no** pill (count 0) | It has the pill (count 1) | No screen is a dead end |
| `pdf-adjustments` | "Day agenda" button | The month's name | Month name toggles month ⇄ day agenda |
| `pdf-adjustments` | "Full calendar" button | The day's heading (on a phone, after opening the day sheet, where the heading lives) | A day's heading goes to its month |
| `pdf-adjustments` | Calendar tools → Colors | App menu → Colors | As above |
| `reference-corrections` | Workshop has **no** pill (count 0) | It has the pill (count 1) | The Workshop was the dead end this pass fixes |
| `reference-corrections` | "Workshop navigation" | "Workshop menu" | The heading's menu is now the Workshop's own, without the other rooms |
| `reference-corrections` | "New plan" (page-wide) | "New plan" inside the Workshop menu | The pill's + is also New plan there, as the spec asks, so the click is scoped |
| `journal` | `.list-foot .plate-button` is "Review last week" (and is clicked, twice) | `.floating-nav .pill-add` is "Review last week" (and is clicked) | Creating moved to the pill's + (decision 19, amended) |
| `journal` | A month cell's "N pages" button marks the entry | The entry is listed among its day's pages, reached from the month cell's date | The per-cell page count was removed |
| `tray-dismiss` | Clicks the "Saved" label as a neutral spot outside the strip | Clicks the toolbar row | A saved page no longer shows "Saved" (decision 17, amended) |
| `event-ranges` | `main` "Delete event" button | `main` "More event actions" ⋯ → Delete | Delete lives in the event's one ⋯, behind the same confirmation |
| `run-checks` | — | Runs `controls-review`, with a 20-minute limit for it alone | The new suite walks every route at six widths |

**Two instructions in the spec met here.** It asked for the Journal suite to pass unchanged, and also retired the list-foot review button and the per-cell page count that three of that suite's lines click and count. Those three lines were moved as listed; every other line of `journal.mjs` is untouched. The sync, editor, table (`spreadsheet`), roundtrip and weather suites pass with their files unchanged. `sync` and `event-ranges` find event fields by "End date optional": the word left the screen, and stays in the field's accessible name through a visually hidden span, so a screen reader still hears that the field is optional.

The gate also found two real regressions, both fixed rather than worked around: + made pages through the `/new` capture route, whose one-second dedupe (there for Shortcuts) reopened the previous page on a quick second tap (`format-join`); and the floated Repeat legend took a grid cell and pushed the repeat controls out of their two columns (`event-recurrence`). A third failure, Trash not refreshing in `redesign-actions`, was the dev server: a long-running Vite had served `db.ts?t=…` to the app and plain `db.ts` to the test's own import, two module instances with separate listeners. A fresh server cured it; nothing in the app changed.

## Verification

- **The gate.** `BASE=http://127.0.0.1:5188 npm run check`: all 27 suites pass (`work/2026-10-13-controls-review/check-run-3.log`), including the new `controls-review` at 5,197 assertions across 1920/1440/1180/820/390/320 — the pill on every route with every room one tap away, Workshop and Plan reaching Today, switching notebooks in two taps at most, `up()` landing on the documented parent for every route (and a deep link opened after `about:blank` staying on the origin), no repeated control name on any screen, none of the removed strings rendered, + per room, Esc / ⌘↑ / ⌃1–5, the pill receding on scroll and idle and returning, reduced motion swapping it without animation, Today at 1440×900 with no vertical scroll and the pill clear of every spine, no horizontal overflow, and quick-note filing exactly with the draft kept on failure. The first two runs and what they found are kept as `check-run-1.log` and `check-run-2.log`.
- **The fold** is pixel-identical (above).
- **After captures:** 102, every route at six widths, no runtime errors and no overflow (`after/report.json`), reviewed independently (above).
- **Build:** clean `npm ci` and `npm run build`; 75 files; service worker v42. `tests/hosted-controls.mjs` — fresh unpaired profiles, every off-origin request refused — passes against the local production build at 1440/1180/390/320: rooms, + new page, save and reload, up, worker version.
- **Hosted candidate:** draft deploy `6acdca464798e263705fd50f` (https://6acdca464798e263705fd50f--timber-inkfieldnotes.netlify.app). All 75 hosted files match the build byte for byte, and the hosted check passes at 1440/1180/390/320.
- **Production:** published on Joshua's go-ahead as Netlify `6acdcc2e9e39ce914665915f` (https://timber-inkfieldnotes.netlify.app), service worker v42, from the same `dist/` as the candidate. All 75 live files match the build byte for byte, and `tests/hosted-controls.mjs` passes against the live site at 1440/1180/390/320.
- **Not verified here:** physical installed-phone behaviour (Home Screen app, Safari keyboard, the receding pill under a real finger) and propagation to another paired device. Both remain separate, named checks.

## Independent review

A fresh agent that had not seen the work reviewed the 102 after-captures against the kickoff file. What it found, and what was done:

1. **The desktop page foot sat under the pill**, the page being the one view without a lane. From 820px the desk now keeps `--pill-lane` under the leaf. Fixed.
2. **A 1920×900 Today overlapped:** the month row shrank and From Siena covered its last week, and the spines clipped. The board is now the window when it fits and never smaller than its rows (`min-height: min-content`, the first row `max-content`, the shelf row floored at what the spines need). A wide window under about 1000px tall now scrolls instead; at 1920×1080 and 2560×1440 it fits and the pill clears the spines. Fixed.
3. **Calendar cells overflowed** once the lane shortened the rows: a day with three events spilled into the next week. A cell shows two events and "N more", and clips as a safety. Fixed.
4. **The vertical date on the tablet Today card clipped** once the card got shorter; the card keeps 280px on tablets. Fixed.
5. **The phone calendar** kept an empty band where its counts and tools had been, and the day's page rows ran past the sheet. The header lost its old minimum height, and the sheet no longer shrinks in its flex column. Fixed.
6. **At 820 there was no leaf at all**, only black beside the list (as before this pass). From a tablet up the empty leaf now fills the space beside the list. The moose on a page-less notebook's leaf is kept deliberately.
7. **The desk's list toggle** still had the stuck-focus look when no page was open; it gets the same quiet state as the page's. Fixed.
8. **Settings' Colors line** repeated the removed theme line; removed. The Weather form's line about choosing a place is kept: it states decision 23's location behaviour and is the nearest thing this screen has to consent text.
9. **Smaller:** Search's tag chips kept an indent meant for the removed heading (removed); the St. John desk's "Your day, together" explainer is removed; the phone page foot no longer wraps "116 / words". Today's header Search and Settings icons are kept (each appears once, and the spec did not list them).

## Recovery

Baseline `39edc97`; source archive `work/2026-10-13-controls-review/before.tar` (from `git archive 39edc97`). Prior production Netlify `6acd9c989e81e7268cffadb7`, service worker v41 — one-step rollback in Netlify. This release: `6acdcc2e9e39ce914665915f`, v42. Before/after captures: `work/2026-10-13-controls-review/before/` and `after/`.
