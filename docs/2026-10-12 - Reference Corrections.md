# October 12 reference corrections

Joshua's latest written corrections supersede conflicting portions of the earlier PDF. Visual sources: handoff screenshots `03-mac-month-color-tray.png` and `05-mac-workshop.png`.

- Today: first card contains Today's Schedule and Coming Up; no schedule section or quote on an empty day. Coming Up contains only dates with events. The square month card contains only the calendar. Current weather and forecast occupy their own card. Fortnight weekdays appear once; notebook spines omit page counts.
- Full month: dark header and weekday band restored; calendar color continues to the bottom.
- Workshop: four square-cover cards, title/status row, one context/next-step line, real progress, tool chips, and a cream Shop Routine panel. Removed extra card arrows, version/date labels, edit pencils, placeholder hammers, and bottom bar. Actual record content replaces illustrative screenshot content.
- Click The Workshop heading for navigation, New plan, equipment, On my desk, and Workshop pages. Plan cards still open their full plan/editor; Workshop pages preserves access to all notes and revisions. Tools on the wall heading adds equipment; tool chips open source pages.
- Shop Routine displays the existing Workshop page with that exact title. Its heading opens the page for editing; if none exists, clicking creates an empty ordinary page. Rendering never creates a page or invents tasks. Existing page save, conflict recovery, sync, and export apply.
- No schema, cloud data, background services, permissions, recurrence, or hosted MCP modifications. All test writes use unpaired disposable local profiles.

Live release: Netlify `6acd9c989e81e7268cffadb7`, service worker v41. Build, eight targeted checks (including the new reference and six-week calendar checks), six-width layout/interaction checks, and hosted candidate verification pass. The original broad test runs are preserved alongside successful reruns: one expected tile-count assertion was updated, a tablet date-tile overflow was corrected, and the weather suite was rerun against the configured local server. Physical installed-phone behavior and real cross-device propagation remain unverified. Evidence: `work/2026-10-12-reference-corrections/`. Baseline/recovery source: `90acaced0f00123e33aac3f7343bf5b3224536c5`, production v40 deploy `6acd95269c0cc5456608cf6c`.
