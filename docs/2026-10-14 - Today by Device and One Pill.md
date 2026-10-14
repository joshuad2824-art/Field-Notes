# October 14 — Today by device, and one pill

Joshua sent a long phone screenshot (the order he wants on Today), a screen recording of his iPad mini 6 on its side (1133×744), and one request about the toolbar: his phone's pill everywhere.

## What the recording showed

On the iPad mini landscape the board was a long scroll (1853px, two and a half screens): the schedule alone across the top, a square month beside a stretched weather card, a quick note and a date as 250px squares, and the reminders, notebooks and Workshop as three 650px columns that were mostly empty. The wide icon pill sat on top of the content. Upright (744) the phone layout was stretched across 712px.

## What changed

**Phone (under 600).** Placed by grid area, in Joshua's order: quick note | date, weather, month, schedule, Siena, reminders. Compared against his screenshot: the same order, and the cards read the same.

**Tablet upright (600–999).** Two columns. Quick note | date; the weather lying down; the month beside the schedule; Siena; the reminders in two columns; the notebooks | the Workshop. 1761px at 744×1133.

**Tablet wide (1000–1199).** Twelve columns, four rows: quick note, date, weather (3·3·6); month and schedule (5·7); Siena and reminders (5·7); notebooks and Workshop (7·5). 1285px at 1133×744, down from 1853, and the first screen holds the weather, the month and the schedule.

**Desk (1200+).** Not touched; the numbers match the ones from before.

**One pill.** `ApprovedFrame` no longer has a wide variant. Its `menu`, `wellX`, `peek`, `arrival` state, the caption and well, the ⋯ menu and the five room icons are gone. CSS sets the phone's height (60) and offset (20 + safe area) at every width and one `--pill-lane`. Measured at 390, 744, 1133 and 1440 on `/`, `/calendar`, `/workshop`, `/n/church`, `/settings`: 264×60, 20 from the bottom, marks 44×44 at 8 / 58 / 212, centred, identical.

## Cost, said plainly

A room is two taps on a tablet or a desk now (open the room's name, pick a room). ⌘1–5 / ⌃1–5 are unchanged. If one tap ever matters more than the clean pill, the answer is a shortcut, not a second pill.

## Test changes

- `controls-review`: the pill is treated as the compact pill at every width (`phone = true`); the Today scroll check ignores a board that scrolls by less than the pill's 64px run (a tall iPad now scrolls by its lane).
- `reference-corrections`: the month card is square at 1200+, not at 820+.

Everything else in `npm run check` is unchanged.

## Not done

- Not released. Production is still the previous build until Joshua says go.
- Not checked on the physical iPad: the recording was the evidence, and the measurements are from a desktop browser at the iPad's sizes.
