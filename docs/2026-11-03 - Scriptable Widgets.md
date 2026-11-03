## Approved publication preflight — November 3

Joshua explicitly approved applying the widget database migration and publishing the tested frontend, while holding credential activation. Supabase applied `20261103172316_scriptable_calendar.sql` with unchanged approved SQL bytes. Production verification exposed Supabase's automatic authenticated-role EXECUTE default; the narrowly restrictive follow-up `20261103172425_widget_function_privileges.sql` removes it for these three functions. The SQL test now reproduces that platform default and verifies its removal. Existing page/event/image counts and access-policy hash are unchanged; widget rows remain zero. No reader credential has been created. The remainder below records the original development checkpoint and its limits; frontend publication is being verified separately.

# Separate Field Notes widgets — November 3, 2026

Development implementation, not published. Active writer for this checkpoint: Siena/Codex. Branch `codex/scriptable-widgets`; base is fetched GitHub main `7e757e29937ee06397a320b45bda14140574f45e`, rechecked unchanged at closeout. The Lodge main clone, archive-review worktree and iOS pilot work have been preserved. No live records or real credentials were used in testing.

Joshua requested a full month, weather, and Quick Note, and then chose separate widgets he could arrange himself. The earlier prototype attachment was not available as a local file; these standalone installers were built from the current app source and its established palette and dashboard behavior. The supplied screenshot itself was not available in this execution environment, so visual parity with that attachment is not claimed.

## Result

- `widgets/scriptable/Field Notes Calendar.js`: full Sunday-first month with today, page rings and event shading. Large recommended; five/six-week grids, leap years and month rollover supported. Tapping opens the month; per-date tap targets are not implemented.
- `Field Notes Weather.js`: current Tulsa conditions, Fahrenheit, upcoming highs in medium and five-day detail in large; same Open-Meteo provider as the app. No GPS request or weather API key. Independent of the browser’s saved weather place. Cached errors labeled for up to 24 hours, then unavailable.
- `Field Notes Quick Note.js`: opens the existing Quick Note window at `/quick-note?source=scriptable`. The existing draft, notebook picker, filing, local save and sync logic are reused without a second note-saving endpoint.
- `Field Notes Date.js`: optional amber date tile opening today.
- `src/screens/WeatherScreen.tsx`: expanded view composed from the existing weather components at `/weather`.
- Widget links for notes and calendar stop at a pairing notice when opened in an unpaired browser, avoiding silent capture into another local archive. Ordinary direct `/quick-note` use remains available to local-only app users.
- `widgets/scriptable/README.md`: step-by-step setup for someone new to Scriptable, including a copy/paste fallback, key handling, revocation and refresh limits.

Generated installers embed `widgets/scriptable/core.js`, have no external code dependency, and are reproducible with `npm run widgets:build`. They contain no archive key or real read token. Shared setup is stored in Scriptable Keychain and cached snapshots stay in its local cache, not an iCloud export. Calendar tokens are in RPC POST bodies rather than URLs.

## Proposed calendar connection

The paired browser projects the same `dayOf`, journal exclusion, recurrence and `eventOnDay` rules used by Today. Native, Davis, Apple and Work sources are combined through the app’s existing calendar model. Source status and limited source coverage are carried as ready/partial information. This does not connect a new source or establish that any real external calendar is active.

The projection contains only schema version, covered date range, timezone, written dates, event dates and three source states. A strict server validator rejects additional keys, invalid dates/windows, unknown timezones and arbitrary source fields. The reader returns only that projection plus server snapshot and expiry timestamps: no IDs, names, notes, event locations, feeds, OAuth tokens or vault key.

The migration `20261103172316_scriptable_calendar.sql` is additive: one `widget_calendars` table, no changes to existing tables/policies. RLS is enabled and public/anon/authenticated table privileges are revoked. Three fixed-search-path SECURITY DEFINER RPCs provide constrained operations:

- `widget_publish`: derives the owner vault from the existing paired header; validates a date-only snapshot. Explicit create/reconnect can establish a 256-bit read token hash. Background updates must match an existing unexpired hash and cannot create or resurrect access.
- `widget_read`: uses the limited random read token, returns only the projection, and enforces the 90-day expiry. No vault key is accepted or needed by the Scriptable client.
- `widget_revoke`: derives the owner vault and removes only that vault’s widget connection. Another vault cannot revoke it.

Only an explicit consent checkbox plus Connect calendar action generates a token. Rendering, ordinary app use and previewing scripts cannot generate or rotate one. Uncertain creates keep the same attempted token for explicit retry/revoke rather than silently generating a different key. One connection per archive; explicit activation on a different browser replaces the prior one. Publication is serialized; revocation waits for local updates, and server predicates prevent late updates recreating access.

Snapshots refresh only while the opted-in paired browser has Field Notes open, on changes, visibility/online events and a five-minute interval. They cover the prior/current/next month plus outside grid dates. The widget refresh request is 30 minutes; iOS controls actual timing. Snapshot age, offline/partial conditions, expired/revoked access and missing coverage are labeled. This is not an always-live remote calendar service. Calendar title/date/privacy parity against Joshua’s real archive has not been exercised.

## Verification

All data used for tests was synthetic, in disposable contexts. No production migration, app upload, real token creation, vault-key extraction or real note/event write occurred.

- Production TypeScript/Vite build: PASS, including final prepared service worker v60. Existing large-bundle warning remains; no dependency or lockfile version change.
- `node tests/widget-projection.mjs`: PASS. Day-by-day parity with Today’s page/event marker rules; journal/deleted exclusions; recurrence, multiday and outside-calendar event cases; strict window; date-only output.
- `node tests/scriptable-widgets.mjs`: PASS. Four installers × four widget families; 60 months, leap years and six-week grids; setup/response validation; no token URL or vault header; cache isolation, offline/error, revocation/expiry, night and storm glyphs. Native APIs are simulated, not real WidgetKit rendering.
- `BASE=http://127.0.0.1:5189 node tests/widget-browser.mjs`: PASS at 390 and 820px. Existing draft retained; notebook filing exactly once; all original fixture pages byte-for-byte unchanged; empty reopen; month/weather links; unpaired browser stops before capture; explicit opt-in/export and revoke exercised only against fictional mocked RPC endpoints; no background credential creation; no page errors.
- `node tests/widget-sql.mjs`: PASS in PGlite, an isolated in-memory PostgreSQL engine. Missing/wrong-key denial, no direct table access, cross-vault isolation, field/date/timezone validation, token rotation/revocation/expiry, no background recreation and existing-record preservation. The fixture provides `extensions.digest` using PostgreSQL’s built-in SHA-256; the existing hosted pgcrypto wrapper was not altered or exercised live. Set `PGLITE_MODULE` to a local PGlite module, or install the optional test package outside the app runtime. At this checkpoint the existing local module at `Documents/Codex/2026-10-21/task/review-source/node_modules/@electric-sql/pglite/dist/index.js` was used.
- Seven relevant existing suites: PASS (`pdf-adjustments`, `event-ranges`, `sync`, `weather-location`, `links`, `home-approved`, `room-headings`). Full unrelated 47-suite run was not required or claimed.
- `git diff --check`: PASS. Generated scripts checked against shared source. Native Scriptable memory, font metrics, installed-app routing and physical widget refresh remain unverified.

Local logs, regression report, browser screenshots and explicitly labeled calendar drawing simulation are in `work/check-results/widgets/` (ignored, synthetic only). The release handoff includes a standalone installer ZIP and a source patch/bundle. These are development artifacts, not a live release.

## Approval required through parent

Do not silently deploy or activate. Ask Joshua for specific action-time approval to:

1. Apply the exact new calendar-widget migration to the existing Field Notes Supabase project, adding only the date-snapshot table and constrained RPC surface.
2. Publish the tested frontend/service-worker v60 to the existing `timber-inkfieldnotes.netlify.app` site (with the repository’s normal merge/publication process), retaining existing app/data and calendar scopes.
3. If assisted setup is desired, create/activate one separate 256-bit, date-marker-only read credential for his archive, valid 90 days, and install it in his Scriptable Keychain via the secure setup prompt. No archive key is to enter Scriptable. This step remains held until approval at that action; Joshua can instead perform the clearly labeled Connect action himself after release.

The deployment should be verified by exact public build hashes, signed-out/write denials and source/reader parity checks using the approved connection, then the physical iPhone acceptance steps below. Do not infer activation approval from approval merely to inspect code or publish the frontend.

## Device acceptance after approved release

Run each script on Joshua’s iPhone. Check calendar numbers and markers against Today, small/large fit and a six-week month; tap to the month. Tap Quick Note, confirm the paired context (or the explicit browser pairing notice), type a disposable thought, close/reopen, then file it in a deliberately chosen notebook. Confirm actual sync on the second device only if specifically authorized. Check weather/forecast and tap destination. In airplane mode inspect honest cached timestamps; reconnect and verify refresh. Revoke the limited token and verify the reader clears its cache on the next online request. An already rendered Home Screen image can remain until iOS refreshes it; offline clients cannot instantly learn of revocation. The optional date tile and iPad sizes need their own physical layout checks.

## Recovery

No deployed rollback is currently needed. Before any approved release, retain the preceding production build and source commit. If the widget feature is removed later, revoke/delete the widget connection first, remove widget keys/caches locally, and restore the previous frontend if necessary. The additive snapshot table can remain inaccessible; dropping it requires a separate deliberate migration. Existing notes, event tables, source credentials, sync storage and the iOS pilot are unchanged by this implementation.
