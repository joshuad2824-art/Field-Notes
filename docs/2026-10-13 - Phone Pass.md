# October 13 phone pass

Joshua used the controls-review build (v43) on his iPhone and sent screenshots. The spec, not the build, was at fault for most of what he found: it put ← and all five rooms in the pill, which is eight marks on a phone, and it left the quick note's dots unnamed. He approved the fixes below, chose to keep the written-day rings on the month, and authorized the release. This pass was made in a Claude session working from a copy of the controls-review commits.

## What changed

| Where | Before | Now |
| --- | --- | --- |
| Pill, phone (<820) | ← · five rooms · ⋯ · + — eight marks, edge to edge | ← · the room you are in · + (no ← on Today). The room's mark raises the five rooms and ⋯ in a row above the pill; Esc, a tap outside, or a room lowers it. |
| Pill, tablet and desk | ← shown everywhere but Today, often only repeating Today | ← shows only where its parent is not Today (page, journal page, day, event, new event, plan, tag, and back rooms opened from somewhere else). |
| Notebooks in the pill | From inside a notebook it reopened the same notebook | From inside a notebook it raises the shelf above the pill. |
| Notebook switcher | The name was the switcher with nothing to say so; Joshua could not find it on his phone | A small, quiet chevron sits beside the name. `ShelfMenu` is one component used under the name and above the pill. Esc goes through the dismiss stack, so it closes the shelf and nothing else. |
| St. John desk | Its name opened its page list, so the desk had no way to another notebook | Its name is the switcher, like every notebook. "From your notebook" opens the St. John page list. |
| Quick note | Unlabelled dots (two near-identical blues), × that actually filed | The chosen dot is ringed and its notebook's name appears beside the row. ✓ (Done) files; on a phone the sheet is full height with the dots above the writing, so the keyboard never hides them. Filing path unchanged. |
| New / edit event | + dimmed and inert; Save and Copy details in the form; "Repeat / Schedule" stacked | + is the form's ✓ (Save event, or Save the series). The form keeps only Cancel when editing. Copy details lives in the saved event's ⋯. "Schedule" is visually hidden; the select keeps its accessible name. |
| Event view | Pencil and ⋯ in a band of their own above the title | On the date line, top right; the band is gone. |
| Page, phone | Notebook name row, then a toolbar row with a list button that repeated ← | One row: the notebook's name (the switcher) at left, Aa and ⋯ at right. The list button is hidden on phones. |
| Today, quiet day | An empty 250px schedule card on phone and tablet | Under 1200px the card is one line: the date, written across. |
| Today, phone month | Square card; the last week could touch or clip its edge | As tall as its weeks (46px rows). Rings kept. |
| Month cells | Title above time, so "1 more" clipped at 1440×900 | One line per event, time at the right (Timepage's month). Two events and "N more" fit. |
| Empty notebook leaf | A lighter teal slab | Cut from the default page stock (night or paper) with that stock's dots. |
| St. John, tablet and desk | Short list card left a hole above "From your notebook" | The list and the notebook's pages are one column; the brief stands two rows tall beside it. |
| Settings, phone | Section tabs ran off the right edge | They wrap onto a second row. |
| All caps | Undo could take back the shout together with the typing before it | All caps is its own history step (`isolateHistory`). Found because `editor.mjs`'s "undo takes it back" depended on timing. |

## Decisions and amendments

- **Decision 13 (amended again).** The pill is identical on every phone screen and identical on every tablet and desk screen, but the two differ: a phone carries three marks and raises the rest. On wider screens ← appears only when it goes somewhere other than Today.
- **Decision 19 (amended again).** + is a form's ✓ while an event's form is open. It remains dimmed and inert only under an open quick note.
- The written-day rings on the month stay (Joshua's choice).

## Tests

- New `tests/pill.mjs`: `raiseRooms()` and `openAppMenu()` reach a room or the app menu at any width. `redesign`, `redesign-actions` and `pdf-adjustments` use them where they opened the app menu or counted rooms in the pill.
- `controls-review`: phone pills are asserted to be ← · room · + (two marks on Today); every room and the app menu are reached through the raised row; Esc lowers it; ← presence follows the new rule; ← parents whose target is Today are walked on phones only; new checks for Notebooks raising the shelf, the St. John name switching notebooks, the pill's ✓ on New event, and no second Save in the form. 5,289 assertions pass at 1920/1440/1180/820/390/320.
- `reference-corrections`: the month card is square from 820px up; on a phone it asserts the last week sits inside the card.
- `controls-review`, `pdf-adjustments`: the quick note's ✓ is "Done".
- Run here against a local Vite server: 24 of 27 suites pass. `links` and `open-editor-sync` fail identically on the untouched v43 source in this environment (no route to example.com; the faked mirror's host is intercepted by the session's proxy), so they are environmental here; both passed on Joshua's Mac for v43.

## Not verified here

Physical iPhone and iPad behaviour (the raised rooms row under a real finger, the full-height quick note with the iOS keyboard), and propagation to another paired device.
