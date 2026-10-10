# Field Notes — Start Here

Updated October 10, 2026 for the verified production-to-GitHub synchronization.


## October 10 refinement release — live

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
