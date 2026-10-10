# Field Notes design implementation

Status: implemented, published, and verified live, October 7, 2026. Joshua authorized the full design implementation and necessary publication in the current chat.

## Current sources and decisions

- Review: `/Users/joshuadavis/Documents/Codex/2026-10-07/siena-please-go-through-and-review/outputs/Field Notes Design Review.md`.
- Keep woodland, puffin, cream paper, handwritten accents, and dependable writing and sync.
- Meaningful plan sections, accurate lists/tables/diagrams, next-step context, and section navigation.
- Icon-only routine actions with accessible names; distinctive replacement artwork remains a later pass.
- Stable decorative variation rather than repeating identical tape.
- Workshop is the sole visible home for plans/images; retain underlying notebook associations and all saved pages.
- Weather shows five days on phones and seven on desktop, and remains expanded directly below the dashboard header, above all dashboard cards, per Joshua’s latest direction. Events for the day occupy the right-hand notebook page. Reminders sit beside the notebook on desktop. On our desk appears only as tags below, with short note previews; all active items are listed. Supporting inventory/history follows. Content-driven heights and related side-by-side cards reduce avoidable scrolling.

## Work order

1. Shared reading renderer, icon controls, decorative variants, and safe notebook routing.
2. Workshop landing, sectioned plans, and editing with the existing save/conflict safeguards.
3. Dashboard priorities and compact previews.
4. Consistent secondary screens, Settings groups, forms, and calendar/review layouts.
5. Typecheck/build, meaningful preservation and interaction tests, and visual checks at phone and desktop widths.

## Preservation and recovery

The existing dirty working tree is preserved. The complete pre-design checkout, excluding dependencies, Git metadata, build output, and private environment files, is archived at `work/baseline/field-notes-before-design.tgz` in the current chat directory. No live vault data is needed for implementation tests; use disposable local fixtures.

## Verification and release

All 20 existing regression suites passed individually or in groups, including writing, tables, sync, calendar projection, journal, review navigation, and Workshop image round trips. Design checks cover seven widths from 320 to 1920 pixels, structured rendering, merged tables, safe URLs, source/image preservation, focused editing, icon controls, reminder reachability, layout fit, and deliberate deletion using disposable local fixtures. Original stored notebook records are included in preservation snapshots.

Production verification caught a real Workshop notebook with a custom saved ID. The shelf and remembered destination now recognize both seeded and custom-ID notebooks named Workshop or The Workshop, without changing their records. Legacy notebook routes lead to Workshop; explicit legacy capture links still resolve their original notebook. Other Workshop writing is reachable through Other notes and Search.

The existing-page project form now defaults missing Status to active in its saved state as well as its display. The regression exercises selection and Save without explicitly reselecting Active, including reload, on desktop, phone, and tablet. Joshua’s Prayer Log was already marked as a project but had no Status; its missing active metadata was restored with an exact version check and verified read-back, preserving all original text.

Final release: Netlify deploy `6ac695ab037b3190e98a0413`, service-worker v29, published October 7, 2026 at 18:55 UTC. Production HTML, asset hashes, service-worker caching, and deep links match the verified build. Live checks confirm Workshop hides the duplicate custom-ID notebook, legacy routing returns to Workshop, plans retain structured sections/tables/diagrams, weather stays above dashboard cards, and the notebook agenda replaces the former duplicate active project and separate event card. Prayer Log was subsequently saved as Paused; that newer choice is preserved. Active tag preview, attached-page opening, default Active save, refresh, and no record mutations were verified with disposable fixtures. The review browser had no saved weather reading; a populated seven-day fixture verified desktop/phone forecast layout. The site remains connected to Git deployment, so a later Git push can replace the manual release. No source commit or Git push was made for this design pass; prior checkout changes are preserved.

## Remaining work

Distinctive replacement icon artwork is a later pass. Physical iPhone/installed-app behavior and physical printing remain unverified; browser viewport checks establish layout fit, not device-specific behavior.


## Latest dashboard layout

Joshua asked for the right-hand notebook page to show Events for the day and for On our desk items to remain solely as the tags below. The duplicate notebook project/checklist and external event card are removed. Native and Davis event rows, event/calendar links, empty-day state, and full-day access remain. Short tag previews extract the first usable saved writing (maximum 180 characters), excluding headings, metadata, images, tables, and fenced code; they never rewrite the source. Existing project details remain editable. The first-three-project cutoff is removed so active linked pages remain reachable.

Verification: production build; dashboard, desk, desk-details, and approved-navigation regressions; seven-width design/preservation checks (320–1920px); desktop and phone screenshot inspection; live notebook agenda and primary asset/hash verification. No live page writes were made in this follow-up. A v28 source snapshot and release ZIP are retained in the current chat’s `work/dashboard-before-v29/`.

## Plan papers and recurring calendar — v33

Joshua’s latest direction adds varied paper stock inside plans, more desktop columns, readable calendar note titles, and recurring native events. Five stable colors and textures alternate through each plan; tape cuts/positions and occasional clips vary. Cards follow their original section order, with wide images, tables, and diagrams spanning both columns. Phones retain one column. No page or original image bytes are rewritten for styling.

Calendar note titles now use dark paper ink, including hover and pin states. Repeat forms support daily, selected weekly days, monthly date/last day or ordinal/last weekday, and yearly, at intervals of 1–99 units. Series can stop on an inclusive date or after a count. A preview shows the first dates and makes any first-date adjustment explicit. Monthly missing dates/fifth weekdays and annual February 29 skip invalid dates; this follows [RFC 5545 recurrence semantics](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.3.10).

The additive nullable `events.recurrence` JSON field leaves existing events and access policies unchanged. One master is saved, synced, exported, soft-deleted, and restored; occurrences are projected in memory and link back to their master plus selected date. Editing/deleting applies to the whole series, stated in the form and deletion prompt. Individual exceptions remain a future feature. Shared date-only arithmetic avoids daylight-saving drift. Apple Calendar handoff includes RRULE with matching DATE/floating DATE-TIME bounds; it remains a one-time import. The MCP preserves repeat rules for older edit calls and lists matching occurrence dates with each master. Local migration file uses the cloud-recorded version `20261007194356` after CLI creation and verified application.

Verification includes edge-function typechecking, local PostgreSQL migration checks, recurrence boundaries/intervals/leap dates/count/until/multiday coverage, desktop/mobile create/save/reload/edit, occurrence navigation, markers, export/restore and deletion/restore, simulated paired-device sync, and seven-width plan/source/image/contrast checks. Real phone/installed-app behavior and Apple Calendar’s physical import interface still require device confirmation. Production fixtures are not created.

Final polish mixes paper orders by plan and avoids matching decorations on neighboring cards. Empty or temporarily invalid start dates show inline guidance without crashing the repeat preview. The final build carries service-worker v33 and hosted MCP version 12. Fixture-driven desk/navigation checks were repeated successfully after restarting the local development server to clear stale hot-reload module identities.

Repeat controls occupy a full paper row with two related columns on desktop, instead of leaving a large blank space next to the location field. Mobile remains a single-column form.


## October 8 — phone navigation, notebook seam, small tablets

Joshua requested Calendar in the bottom navigation, no captions below its icons, a clean stacked notebook join, and better iPad mini formatting. Calendar retains its last viewed month and highlights on month/day/event routes. Each icon still has a screen-reader name, tooltip, keyboard access, and a touch target of at least 44px. The bottom bar retains home-indicator/browser clearance and the existing keyboard behavior.

Phone notebook pages now share a contained paper edge with one horizontal crease; side-by-side shadows and page layers no longer overlap the join. The burgundy ribbon starts within the Events page. Tablet spreads retain the dotted/lined stocks with a softer center crease.

Small tablet reminders use full card width and two columns. The calendar grid and its count stay together beside the agenda. Calendar event titles now use dark ink on their cream cards. A docked page list at 1120–1279px is 260px wide, leaving a larger writing page. Very narrow event forms use constrained tracks and stacked time controls. Source content, images, native event rules, cloud permissions, and existing data are preserved.

Local `mobile-tablet` checks cover 320×760, 390×844, 600×960, 744×1133, 768×1024, 1024×768, 1133×744, and 1440×900. They verify named icon navigation, active state, month retention, notebook geometry, paper contrast, tablet reminder/editor sizing, overflow, and unchanged source records/images. All eight responsive fixture checks passed, including keyboard activation, month memory, save controls above the bottom bar, and 34px home-indicator clearance. Existing design, approved-navigation, desk, dashboard, editor, and event-recurrence regressions passed. The production build passed. Physical iPad/Safari/installed-app confirmation remains Joshua's device check. A before-v34 recovery snapshot and v33 artifact are held in the chat's `work/before-v34/`.


Published October 8, 2026 at 14:17:05 UTC: Netlify deploy `6ac7a5e0c7939eae3b224059`, service worker v34. Primary assets (`index-4LJ1KM5r.js`, `index-sT_ZBDJ0.css`, existing editor bundle), service worker cache headers, and deep links match the verified build. Live phone navigation opens Calendar with active state and no captions; live tablet calendar uses two 340px columns at 744px, dark event ink, and no horizontal overflow. The original open plan was safely refreshed after confirming it was not being edited; all 26 sections remain and its 1133px view has two columns. Temporary viewport overrides and preview tabs were removed. No real notes, images, or events were edited during UI verification. No Git push or backend changes were needed.


## October 9: full messages, adjacent Coming up, and proposed St. John view

Joshua requested full From Siena messages on desktop, Coming up directly beneath Remember, and a review of whether the new Ascension routines justify a separate dashboard. He clarified that “regular calendar” means the native Field Notes calendar.

### Implemented and verified

Removed the featured-message CSS line clamp, including the narrower-screen clamp, while preserving body text and explicit reading state. Moved Coming up from the separate lower grid into the Remember column, so the notebook's height no longer forces a gap between those cards. No note, reminder, event, or completion state was changed by this work.

Build and existing dashboard tests passed. Existing responsive/preservation checks passed at 320, 390, 600, 744, 768, 1024, 1133, and 1440 pixels. The first responsive invocation used its default port 5188 and could not connect; rerunning against the running development server on 5173 passed. Production deploy `6ac94da8a545c33ca7d20dbc`, service worker v35. At 1440px the live featured body measured 385px for both visible and content height, with no line clamp; Coming up was 22px below Remember. Live screenshot is in `work/2026-10-09-dashboard/live-desktop.jpg`. All production build assets, HTML, and service worker were compared with local output. This remains a manual release on a Git-connected site; a future production push may replace it.

### Current calendar boundaries

Native Field Notes events already appear through the shared calendar projection. Davis rendering is implemented in the consumer, but live Settings explicitly reports setup required. The app has no Google Calendar source for Ascension. Existing work-review automations can read calendars in Codex; that is independent of Field Notes' own calendar connection. Do not claim calendar completeness from an empty Today card, duplicate family events into native events, or use reminders as substitutes for scheduled events. The Today notebook currently previews the first three events with a full-day link; once combined sources are active, revisit that limit so relevant work events are not hidden.

### Recommendation, awaiting scope decision

Build a St. John view inside the existing app, opening from the St. John notebook, with a clear route back to the combined Today view. Use the same underlying records so completing a reminder updates both views.

- Today at work: Joshua's own training sessions, meetings, on-call coverage, and OOO/time conflicts. Exclude unrelated coworkers' calendar entries and distinguish declined/canceled sessions.
- Needs Joshua: due/overdue actions with source links, ownership, and an explicit completion control. Surface the total beyond the short homepage preview.
- Waiting on others: follow-ups with a named owner and next review date, without presenting someone else's work as Joshua's task.
- From Siena: dated work briefs and meaningful changes from the recurring reviews, with source/last checked and partial-coverage indicators.
- Work references: a small collection of the established calendar, training roster, OKTUL, ServiceNow, and knowledge links; source systems continue to hold operational records.

Foundational change: the current MCP create_siena_item accepts notebook but stores it only for reminders; ordinary notes and task updates are global. Extend validated notebook attribution through creation/display before relying on a St. John filter. Do not infer work membership only from names or keywords, and preserve existing global notes until deliberately classified.

Priority: activate the scoped Davis integration, add a reliable read-only Ascension event source, then introduce the work view on verified data. Work event identities must remain stable across reschedules/cancellations, recurrence must resolve in America/Chicago, shared-calendar selections must be Joshua-specific, and duplicate events must not appear across sources. Display last successful refresh and partial/unavailable states. Preserve the established OOO behavior for work-review notifications while still displaying scheduled calendar events appropriately.

No work dashboard, new automation, calendar source, cloud authorization, or backend deployment was created in this pass. This proposal is grounded in the October 9 Ascension index and the currently deployed Field Notes UI/code.


## October 9: St. John notebook desk

Joshua authorized the next useful piece and emphasized an enjoyable, visually varied work tool. The existing St. John notebook (`d97288df-10bc-451f-8903-82d4e0c74873`) now opens a desk at `/n/<id>/desk` from the shelf. `/n/<id>` remains the original page list; Notebook pages and Notebook desk links connect the two. Other notebooks can open a desk from their page-list header without changing their usual landing route.

The desk uses a navy cover, brass accents, a cream action sheet, a paper Siena brief, and sage/sand/blue note cards. Due/overdue, ahead, and all-open filters share the existing reminder rows and completion history. Six actions appear initially with an explicit Show all control. Pinned and recent source pages appear with notebook search and original-page links. St. John includes the verified training roster, OKTUL, ServiceNow, and knowledge entry points. Phone layouts retain the content and controls in a single column. Reduced-motion preferences disable the note-card lift.

Non-reminder Siena items now have a notebook selector, including Unfiled, with a local transaction and expected-version guard. Filing changes only notebook and updated; it retains body, title, source, original creation date, seen state, and completion state. Reminder reassignment is refused. The existing sync format already roundtrips notebook for every item kind. The hosted MCP publication handler now validates any supplied notebook within the caller's archive and retains it for note, saved, task_update, and reminder kinds; retries remain idempotent and report the existing notebook. No schema or authentication changes were needed. Hosted function v14 files were read back and matched the local release exactly.

One existing, verified October 9 work brief was filed through the live UI, then read back through the connected Field Notes tool. Its creation timestamp and seen timestamp were unchanged. Original notebook pages were not edited, and no real reminders were completed. Legacy notebook pages containing access-detail labels use a generic dashboard excerpt; source text remains on the original page. This is a preview guard, not a general secrets scanner.

Validation: production build; backend Deno typecheck; actual publication handler exercised locally with an isolated fake store in `node tests/siena-routing.mjs` (all kinds, global notes, invalid notebook, archive scope, idempotent retries, unchanged seen/completion); dashboard regression suite; complete two-device sync suite; approved navigation suite at 1485/1024/768/390/320px. The first sync invocation used its default unused port 4173; the rerun explicitly used 5173 and passed. `tests/notebook-desk-check.html` on unpaired localhost verifies notebook isolation, reversible filing, sync roundtrip, stale-version rejection, invalid notebook rejection, reminder guard, shared completion, and content/reading-state preservation. Manual browser checks verified search, filter contents, six-to-eight Show all expansion, original-notebook navigation, and no horizontal/panel overflow at 320/390/768/1024/1440px. Desktop and phone designs were visually inspected. No physical-device verification is claimed.

Still separate: Ascension and Davis calendar connections, waiting-on-others status, source freshness beyond the saved-message timestamp, and review of older unfiled messages. The existing recurring Ascension workflow already directs results to St. John; its timing, prompt, and operating scope were not changed. The main Today dashboard continues to combine existing Field Notes content.

Final work-desk release: Netlify `6ac95139d2e01bfff3cc3c36`, v37. Live HTML, all assets, and service worker match local build. After reload, the existing Links page shows only its title and generic excerpt; St. John has the correct scoped reminder counts and original work brief. Screenshot: `work/2026-10-09-work-desk/live-desktop.jpg`; phone fixture screenshot: `work/2026-10-09-work-desk/phone-fixture.jpg`.
