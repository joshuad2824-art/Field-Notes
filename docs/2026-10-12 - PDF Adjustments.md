# October 12 PDF adjustment pass

Joshua's five-page `Field_Notes_Updates.pdf` takes priority over the original redesign screenshots. The screenshots remain the visual target where the PDF does not revise them.

## Changes

- Notes: removed the gold focus outline, widened the writing measure, replaced the notebook-list toggle with a subtle tab, removed redundant search/desk controls and page count, hid the list scrollbar, and kept one floating new-page button. Journal retains its review action.
- Today: moved current weather beside the schedule; changed the former weather tile to Quick note; moved Remember below; replaced the month tile's Today page with upcoming events; expanded the date strip to fourteen days; linked month/date to the full calendar; made the home plus create an event; removed the home calendar shortcut; removed overdue-day counts; show the full Siena message. Empty schedules show a rotating original Siena quote, clearly attributed.
- Quick note: an unfiled draft is saved on this device and reopens unchanged. Choosing a notebook files the complete body as an ordinary page when the window closes. Filing and clearing the draft share an IndexedDB transaction; errors preserve the draft. Filed pages use existing sync/export behavior. No backend/schema changes.
- Calendar: themed background fills the viewport, bottom toolbar replaced by upper-right tools, direct month/day switch, corrected day-sheet back button. Event day/calendar actions live together in the event menu.
- St. John: removed the redundant notebook shortcut and restyled the Siena filing/reading controls.
- Writing controls: reformatted the Aa strip in the new surfaces/type without changing editing commands or highlighter rendering.
- Workshop: four cover cards on desktop, two on tablet, one on phone; real images where available and decorative covers where absent; responsive tools area and accurate plan counts. Project detail uses the new driftwood surfaces, headings, section cards, controls and readable tables; original source and image bytes remain intact.

## Verification and release

Local browser fixtures only; no real notes, events or images changed. Evidence: `work/2026-10-12-pdf-adjustments/`.

All 24 current suites passed, including four recorded follow-up runs after fixes and updated weather selectors. The new adjustment suite covers six widths (1920/1440/1180/820/390/320), quick-note reload, exact filing and failure preservation, a full long Siena message, quiet-day quote, calendar tools/navigation, editor focus, layouts and runtime errors.

Published Netlify `6acd95269c0cc5456608cf6c`, service worker v40. All 75 live files match the verified build byte for byte. The hosted preview passed four-width navigation/save/reload checks and two-width quick-note persistence/filing. Source is synchronized to GitHub with `[skip netlify]` so the verified build remains deployed. Physical installed-phone behavior remains a separate check.

Baseline: `42e9ce6`, Netlify `6acd5e4be27d392faed8cafa`, service worker v39. Recovery archive: `work/2026-10-12-pdf-adjustments/before.tar`. New release uses v40.
