# Field Notes — Start Here

Updated October 17, 2026: supplied puffin Home Screen icon.

## October 20 — Today, Archive and private Theology released

- Live: `https://timber-inkfieldnotes.netlify.app`, production deploy `6ad7ba60357e13e7bcdafbec`, service worker v57. Published from the verified local build. Joshua approved recording the same source in GitHub main with `[skip netlify]`; repository handoff details are in the release record. The original iOS checkout remains untouched.
- Approved private study migration and exact-byte book import are complete. Full live source and navigation metadata readback match; vault isolation and rollback-only live database tests pass. The book remains private runtime data outside git and public assets.
- Archive compatibility migration is applied and the authenticated MCP publisher is version 17. All 75 public file hashes match the verified build; hosted UI checks pass at 1440/820/390/320px with neutral device-local fixtures. Actual paired devices and physical iPhone/Safari remain unverified.
- Current release details and verification limits: `docs/2026-10-20 - Field Notes Private Study Release.md`. The preview history below describes earlier held checkpoints.

## October 20 — approved home and Siena/Archive bundle, pre-release history

- Separate branch/worktree based on current main. Shared safe message typography, reversible searchable Siena Archive, explicit resolution/restore state and additive sync/backup metadata are drafted and locally checked. Notebook pages are excluded.
- Joshua approved proposal v7 (1440×900) and requested Theology beneath Notebooks. The approved home, personal/St. John Siena separation, full Today/Coming up calendar columns and keyboard-accessible Theology link are implemented in the working branch.
- Theology now has a private study preview. The supplied Markdown is hash-verified outside the repository: all 260 readings, 52 weeks, nine topics, 675 anchors and 4,523 links are checked, with exact source reconstruction. Separate annotation storage, responsive indexes and local mocked sync/race tests pass. Joshua confirmed the existing Prayer Log; the full-card link resolves that uniquely titled record without creating a page. Details: `docs/2026-10-20 - Private Theology Study Preview.md`.
- **Not published.** Hold the one bundled release for review. The protected study-table migration and live private import also await specific approval. No production migration, MCP deployment or frontend publication has occurred. Local aggregate verification now passes all 38 suites (full run plus targeted recovery reruns), including desktop/touch contextual highlighting; controls review passed 5,623 assertions. All 11 refreshed screenshot identities were verified in native Library. Earlier bundle details: `docs/2026-10-20 - Approved Home and Theology Shell.md`.
- Draft behavior, verification, recorded regression failure and release order: `docs/2026-10-19 - Siena Archive Draft.md`.

## October 17 — supplied puffin Home Screen icon

- Joshua's supplied artwork is the Apple touch, web-app, and browser icon, with its original black background. Original: `docs/assets/field-notes-puffin-icon-master.png`.
- Versioned icon links and service worker v56 refresh the install metadata. Live: Netlify `6ad4035c5e80357abb07cdde` from GitHub `f84feee`. Build, icon/offline checks, and 33 regression suites pass (controls at 390px); 13 live assets match the build, and application JavaScript/CSS remain byte-identical to the prior production. Physical iPhone installation remains a device check.
- Scope, recovery, and phone handoff: `docs/2026-10-17 - Home Screen Icon.md`.


## October 14 (later) — Today by device, one pill

- Phone Today is in Joshua's order: quick note + date, weather, month, schedule, Siena, reminders. The iPad has its own board (upright: two columns; wide: twelve columns, schedule + month + weather on the first screen). Desk unchanged. `src/styles/home-board.css`.
- The phone's pill (← · room · +) is the pill at every width; the tablet/desk icon row is removed. Rooms are two taps (⌘1–5 still one key).
- Detail and test changes: `docs/2026-10-14 - Today by Device and One Pill.md`. Not released: awaiting Joshua's go-ahead.

## October 14 — scrollbars, toolbar flicker, offline

- No scrollbar anywhere in the app: one rule at the base, the two places that drew a bar on purpose removed. The day agenda's bar was `div.agenda-days.scroll` and `aside.agenda-sheet.scroll`.
- The floating toolbar no longer blinks while a long note scrolls: it leaves once as you read down and returns once when you stop or scroll up (was 24–40 flips in the same scroll). Rules in `src/lib/pill-scroll.ts`.
- Offline: opens, lists and opens earlier notes, takes a new note, keeps it across a reload — verified in a real browser with the service worker active. Sync, weather and the calendar feeds need a network, as before.
- New suites: `tests/pill-scroll.mjs`, `tests/no-scrollbars.mjs`. Service worker left at v55 on purpose. Detail: `docs/2026-10-14 - Scrollbars, Toolbar Flicker and Offline.md`.

## Earlier: October 13 quieter controls

Updated October 13, 2026 for the quieter-controls pass.

## October 13 quieter controls — released

- The pill holds still: fixed slots on every route, the room as a sliding well, its name as a caption; a resting mouse dims it instead of hiding it. On a phone the room's mark names the room and raises one sheet with every room and back room. + names Page (and its notebook), Event, Quick note.
- One fold mark on the leaf cycles 3 → 2 → 1 columns (⌘\ too). Aa opens the strip in the toolbar's own row. A chevron after a title means a menu. Plan sections are chips; Settings' phone tabs scroll. The notebook switcher's shelf is no longer clipped.
- From Joshua: no "Work · Read only" / "Family calendar" line under events; the phone calendar's day sheet lists events only and sits lower.
- Details, amendments to decisions 13, 17, 18 and 19, and every moved assertion: `docs/2026-10-13 - Quieter Controls.md`. Released on Joshua's go-ahead from `main`, service worker v53.

## October 13 phone pass — live

- From Joshua's iPhone: the phone's pill is three marks (← · the room you are in · +) and the room's mark raises the five rooms and ⋯. Notebooks from inside a notebook raises the shelf; the notebook name carries a quiet chevron; the St. John desk's name is a switcher too, so no notebook is a room you can't leave.
- Quick note names its chosen notebook and files with ✓; an event form's ✓ is the pill's +; the event's pencil and ⋯ sit on its date line; a phone page has one toolbar row; a quiet Today is one line; month cells hold one line per event; the empty leaf matches the page stock; St. John's board has no holes; Settings' tabs wrap; All caps is its own undo step.
- Production: Netlify `6ace36dbc5a0418049c987f3` from GitHub `main@e2cc481`, service worker v44 (prior `6ace21ba833484a19c975397`, v43). Pushing `main` publishes; use `[skip netlify]` for record-only commits. Details, amendments to decisions 13 and 19, and test changes: `docs/2026-10-13 - Phone Pass.md`.


## October 13 controls review — live

- One quiet control grammar: the pill is identical on every screen and width (← · Today · Notebooks · Calendar · Workshop · From Siena │ ⋯ · +), recedes while you scroll, type or rest a mouse, and every scroller keeps a lane for it. ← is "up" to a fixed parent (`up()` in `src/lib/router.ts`) and never leaves the app; Esc, ⌘↑ and ⌘/⌃1–5 work. + makes the room's obvious thing (Review last week in Journal). The notebook's name is the switcher at every width.
- Contextual controls live on what they act on (month name, day heading, event and plan titles, the Workshop heading, a held spine, a reminder's words, an empty leaf). Duplicates, explanatory copy and status counts are gone; consent text and the pairing-code warning stay. Today fits 1440×900; the date tile is a countdown to the next timed event.
- The three October stylesheets are one `redesign.css`, pixel-identical at six widths. CLAUDE.md decisions 13, 17 and 19 are amended, with an October 13 section.
- Production: Netlify `6ace21ba833484a19c975397`, service worker v43 — the v42 release (`6acdcc2e9e39ce914665915f`) plus fixes from Joshua's own screen and a line-by-line plan audit: round day marks (oval since October 12), aligned app-menu icons, a spine that opens the manager instead of crashing it, no empty Coming Up heading. All 27 suites pass; all 75 live files match the verified build; hosted navigation, new page, save/reload and up pass at 1440/1180/390/320. Prior production `6acd9c989e81e7268cffadb7` (v41).
- Details, decisions the spec left open, every changed test assertion, and recovery: `docs/2026-10-13 - Controls Review.md`. Evidence: `work/2026-10-13-controls-review/`. Physical installed-phone behaviour remains a separate, named-unverified check.


## October 12 reference corrections — live

- Joshua's latest written corrections supersede conflicting PDF recommendations. Today now has Schedule/Coming Up, a square month card, and separate weather; no quiet-day quote, repeated weekday headings, or notebook-spine counts.
- Calendar has its dark header again. Workshop follows the supplied four-card/two-panel composition with real plans, tool chips, and a page-backed Shop Routine. Click The Workshop heading for navigation and creation actions.
- Production: Netlify `6acd9c989e81e7268cffadb7`, service worker v41. Build and eight targeted checks pass; layouts checked at six widths, including six-week calendar fit. Release details and recovery: `docs/2026-10-12 - Reference Corrections.md`; evidence: `work/2026-10-12-reference-corrections/`.

## October 12 PDF adjustments — live

- Production: Netlify `6acd95269c0cc5456608cf6c`, service worker v40. Joshua's five-page PDF now takes precedence over the original screenshots where they differ.
- Cleaner, wider notes; persistent quick-note window; rearranged responsive Today board with full Siena messages and fourteen dates; full-screen calendar with upper-right tools; simplified St. John controls; new formatting strip; complete Workshop/project styling.
- Unfiled quick notes remain on this device. Choosing a notebook files the note on close; then existing page sync/export applies. All existing notes/images and background services are preserved.
- All 24 checks passed, including recorded follow-up runs. Six-width layout and interaction checks and hosted preview checks pass. Release detail: `docs/2026-10-12 - PDF Adjustments.md`; evidence/recovery: `work/2026-10-12-pdf-adjustments/`. Physical installed-phone behavior remains unverified.

## October 12 complete redesign — earlier release

- Production: Netlify `6acd5e4be27d392faed8cafa`, service worker v39. The supplied complete redesign supersedes earlier visual/kit boundaries below; older entries remain as release history.
- Today, notebooks and editor, agenda/calendar, Workshop, From Siena, work desk, search, Settings, Trash, navigation, themes and empty states now follow the October 12 handoff.
- All 23 current regression suites pass. The design checks cover 28 captures across all 27 references and five desktop/tablet/phone widths. Clean dependency installation and production build pass; hosted navigation, local save/reload, and runtime checks pass at four widths.
- Background services, synced records, permissions, hosted MCP, recurrence, backups and editor highlighters are preserved. No real archive records were changed during testing.
- Details: `docs/2026-10-12 - Complete Redesign.md`. Local evidence/recovery: `work/2026-10-12-redesign/`. Physical installed-phone behavior and real cross-device propagation remain unverified.

## October 10 refinement release — historical

- Current production: Netlify `6aca65a2c15d91b5423c0955`, service worker v38, built from GitHub main source `ac42e83`. Phase 1 is `e5c3241`; Phase 2 is `ac42e83`. Both phases and this release record are kept on main.
- Readable notebook cards and metadata, labeled compact phone tabs, labeled desktop actions, simpler calendar marks, On my desk copy, compact event times, and overdue labels are live. The 320px notebook overflow is fixed.
- The nine-part shared kit is implemented with a development-only `/kit` preview. It does not replace production screens yet, matching the handoff's Phase 2 boundary. Stable notebook-ID-derived spine heights avoid a database migration; sync, backups, data, and permissions are unchanged.
- All 20 regression suites, eight phone/tablet sizes, three kit/type-audit sizes, clean-install build comparison, and live desktop/phone reload checks pass. All 72 live files match the verified build. Physical iPhone behavior remains unverified.
- Scope, design decisions, and full evidence: `docs/2026-10-10 - Phase 1 and Shared Kit.md`. Local screenshots/logs: `work/2026-10-10-phase1-kit/`. Future screen redesigns and Jot belong to the later handoff phases.

## GitHub production synchronization — October 10

- Main now includes the October 8–9 design, recurring-event, dashboard, and notebook-desk releases. The four existing remote commits and remote-only dashboard documentation/test are retained.
- At the earlier synchronization, production was Netlify `6ac95139d2e01bfff3cc3c36`, service worker v37. All 72 files from a clean `npm ci` / `npm run build` match the live site byte for byte. Hosted MCP v14's three source files also match this checkout exactly.
- Dependency versions and the npm lockfile now reproduce the packages used by production. The prior local installation had Deno-managed package links that differed from the old npm lockfile; editor/React/Dexie versions and two editor transitive dependencies are pinned to the verified live versions.
- This source synchronization uses `[skip netlify]` so it does not replace the already verified deployment. Local recovery folders, screenshots, generated builds, and private tool configuration are excluded from the commit.
- Verification details and any outstanding regression findings: `docs/2026-10-10 - GitHub Production Sync.md`.

## St. John notebook desk — October 9

- October 9 production release: Netlify `6ac95139d2e01bfff3cc3c36`, service worker v37, hosted MCP v14. Live HTML/assets/service worker matched the build; the work desk and filed brief were checked after reload. Screenshot: `work/2026-10-09-work-desk/live-desktop.jpg`.

- The existing St. John notebook now opens its work desk from the shelf: `/n/d97288df-10bc-451f-8903-82d4e0c74873/desk`. Notebook pages keeps the original editor/list one click away. Other notebook desks are available from page-list headers.
- Navy/brass cover, paper actions and briefs, colored note cards; due/ahead/all-open reminder filters, shared completion/history, six-item preview with Show all, notebook search, and established work-resource links.
- Notes, saved links, and task updates can be explicitly filed using their notebook selector. Filing preserves content and reading status; the hosted publisher now retains validated notebook assignments for all item types (MCP v14). One existing October 9 work brief was filed and its cloud save verified.
- Tests and implementation detail: `docs/design-implementation.md`, final October 9 section. Local behavioral fixture: `tests/notebook-desk-check.html`. Publication-handler test: `node tests/siena-routing.mjs`.
- Before-change recovery: `work/2026-10-09-work-desk-before/`. Existing dirty checkout and live pages/reminder states preserved. Calendar source activation remains the next separate integration; no calendar completeness claim is made by the work desk.

## October 9 dashboard update and Ascension planning

- Published desktop readability/layout fixes: the featured From Siena message has no line clamp, and Coming up is directly inside the Remember column with a 22px gap. Full text also remains readable at smaller widths.
- Release: Netlify `6ac94da8a545c33ca7d20dbc`, service worker v35. Build, dashboard regression suite, and eight 320–1440px responsive/preservation checks passed. Live 1440px DOM checks confirmed the entire featured note fits its text box and Coming up follows Remember by 22px. Production file hashes were checked against the build.
- Before-change files: `work/2026-10-09-dashboard-before/`. Live desktop proof: `work/2026-10-09-dashboard/live-desktop.jpg`. Prior dirty checkout preserved; no Git commit/push or live record edits.
- Joshua clarified that “regular calendar” means native Field Notes events. These already feed Today/month/day views. The live Settings page still says the Davis calendar connection is not set up; there is no direct Ascension Google Calendar feed. Neither external connection was activated by this layout release.
- Proposed next scope, not yet implemented: a St. John view within Field Notes, retaining the combined Today dashboard. Group work actions, waiting items, briefs, and relevant work events; support notebook attribution for non-reminder Siena items; show source freshness/partial coverage. Details are in `docs/design-implementation.md` under October 9.
- Current Ascension routines and their verified execution status: `../../Ascension_St_John/00_START_HERE.md`. Calendar integration requires implementing/activating the source connections and verifying actual user-scoped reads; connector access in Codex does not establish a browser-app connection.

## Mobile and small tablet update

- Calendar joins Today, Notebooks, and Workshop in the icon-only mobile bar, with accessible names, active state, and the last viewed month retained.
- Stacked dashboard pages now share one clean paper boundary; the ribbon is contained in the Events page. Tablet spreads keep a softer center crease.
- Small tablets use full-width reminder cards with two columns, the calendar and agenda side by side, and a narrower docked page list that leaves room for writing. Very narrow event controls fit their paper.
- Released October 8: deploy `6ac7a5e0c7939eae3b224059`, v34. Production asset hashes, deep links, and live phone/tablet layouts verified. Current implementation and release verification: `docs/design-implementation.md`. New local fixture checks: `npm run check:mobile-tablet`. No real notes/events/images were changed by this work.

## Current design release

- Earlier October 8 design baseline: Netlify deploy `6ac7a5e0c7939eae3b224059`, service worker v34. The current production release is listed in the October 10 section above.
- Decisions and verification: `docs/design-implementation.md`. Workshop plans use five mixed paper colors/textures with varying tape/clips, two desktop columns and one mobile column, routine controls use icons, tape varies by item, and duplicate Workshop notebooks are hidden from the shelf without deleting records.
- Dashboard weather stays expanded at the top: five days on phones, seven on desktop. The right-hand notebook page holds Events for the day, while reminders stay beside it on desktop. On our desk contains only the tags below, with short previews of their attached notes. All active desk items are listed; full event/reminder collections remain reachable.
- Existing-page project forms save their displayed Active default. Joshua’s Prayer Log was previously repaired with only its missing active metadata and verified visible after refresh; later status choices remain Joshua’s own.
- Checks: all 20 existing regression suites passed in the full design pass; dashboard, desk, desk-details, and approved-navigation suites were rerun for the notebook agenda and tag previews; updated form checks pass on desktop/phone/tablet; design and preservation checks pass at seven viewport widths from 320 to 1920px.
- This design release was uploaded from the verified local build. No source commit or Git push was made; Git deployment remains connected and a future push can replace this manual release. Preserve the prior dirty working tree. Before-design recovery copy and design-only patch are retained in the current chat’s `work/`.
- Calendar note titles use dark paper ink. Native events repeat daily, on selected weekdays, by monthly date/last day or first through fifth/last weekday, or yearly, with intervals and end date/count. A preview makes the first occurrence explicit. Editing/deleting applies to the whole recoverable series. Sync, backups, and Apple Calendar files retain the rule.
- The additive recurrence migration is `supabase/migrations/20261007194356_event_recurrence.sql`; all four pre-existing cloud event rows and access policies remain unchanged. The shared date engine is `supabase/functions/_shared/recurrence.ts`, used by app and hosted MCP version 12.
- Repeat/date/export/backup/restore/form checks pass at 1440px and 390px; SQL and server typechecks pass. Sync, dashboard, event ranges, desk, approved navigation, and Davis consumer checks pass. Plan paper/contrast/source/image checks pass at seven widths.
- Later: distinctive icon artwork, physical phone/installed-app confirmation, individual recurrence exceptions, and physical printing.

## Earlier Workshop, calendar, and plugin release

- App source: this repository (`src/`); established production origin: https://timber-inkfieldnotes.netlify.app.
- Current decisions: `CLAUDE.md`; Workshop and Davis integration behavior: `docs/project-desk.md`; plugin tools and release order: `docs/siena-plugin.md`.
- Published changes: unified Workshop, compact owned-tools card, plan image upload and back navigation, one calendar projection across dashboard/month/day, connection controls in Settings, eight additional MCP tools.
- Local plugin source: `/Users/joshuadavis/plugins/field-notes`; installed local version: 0.3.0. Hosted MCP version 12 is active; ChatGPT refreshed and lists 17 tools.
- Server migration: `supabase/migrations/20261007170122_workshop_images_calendar.sql`; Edge Function: `supabase/functions/field-notes-mcp/index.ts` plus `workshop.ts`.
- Verification: build and MCP typecheck pass; pure plugin tests, disposable SQL/RLS tests, and local browser checks pass. All regression suites passed, with the last navigation suite rerun after correcting an asynchronous test wait. Five viewport widths (320, 390, 768, 1024, and 1485px) passed.
- Release: GitHub commit 3235405cb6e1c8eefef92b57c3ff6f302a94b753; Netlify deploy 6ac67c3e619bcb00084a7d64 ready; service worker v25. Earlier Oct. 7 dashboard layout was preserved. Live Workshop, image/back controls, and tool discovery verified. Real Davis integration remains unconfigured; no real family calendar read or consent change was performed.
- Workshop project-index navigation was updated and read back. Next: configure the existing Davis OAuth client when requested; real calendar display and physical phone behavior remain unverified. The separate ChatGPT Field Notes skill was also updated in place; its identity and supporting files were preserved.

The working tree already contained substantial earlier changes when this request began. Preserve them. A before-change archive is held in this chat’s `work/baseline/field-notes-before-workshop.tgz`.
