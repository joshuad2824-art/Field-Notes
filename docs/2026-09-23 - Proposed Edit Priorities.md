# Field Notes: proposed edit priorities

Prepared September 23, 2026 for Joshua and Siena.

Status: the first two batches and darker brass icons are published as v16. The next batch—multi-day events, grouped formatting tools, and optional Overview tools—is published as v17, with its additive event-date database migration applied. Joshua has now chosen weekly reviews assembled from existing notes; v18 clarifies that workflow and preserves edits when reopening a review.

## Basis

Reviewed all five pages of `Field Notes- Suggested items to modify or clarify.pdf` and its companion HTML, the existing icon catalog, the app roadmap, and relevant local source files. Findings describe the local source and supplied screenshots; the deployed app and physical devices were not tested. Earlier project decisions provide context and can be revisited in light of Joshua's feedback.

Source PDF: `/Users/joshuadavis/Downloads/Field Notes- Suggested items to modify or clarify.pdf`

Companion HTML: `/Users/joshuadavis/Downloads/Field Notes- Suggested items to modify or clarify/FieldNotesSuggesteditemstomodifyorclarify.html`

## Suggested order

| Order | Work package | Reason | Relative scope |
| --- | --- | --- | --- |
| 1 | Consistent navigation icons and Journal placement | Existing artwork makes this a contained improvement across the app. | Small–medium |
| 2 | Compact reminders with one clear message | Directly reduces repetition and makes Overview easier to scan. | Medium |
| 3 | Screen fit: iPhone bottom gap, wide Overview and calendar | Addresses the largest layout complaints; begin phone diagnosis early. | Medium, phone cause uncertain |
| 4 | Events spanning several days | Clear functional need, with storage and calendar dependencies. | Larger |
| 5 | Overview purpose and Journal workflow | Resolve what belongs on the home screen and what Journal should do. Decisions can happen before earlier packages finish. | Decision first |
| 6 | Simpler formatting tools | Worth doing as a focused editor pass after deciding which tools should stay immediately visible. | Medium |

These are proposed implementation packages, not a fixed release schedule. If an upcoming trip or event makes multi-day scheduling urgent, move package 4 ahead of the broad layout work. Diagnose the phone gap before estimating that fix.

## 1. Navigation icons and Journal placement

Attachment coverage: page 1 Open source, Calendar, Open this page, Mark seen, From Siena, Manage; page 2 Trash, Settings, calendar navigation, Journal placement.

- Use the supplied icons for Overview, From Siena, Search, Manage notebooks, Trash, Settings, calendar, back/forward, and seen status where their meanings match.
- Keep the From Siena unseen count separate from its icon. Keep notebook names and Journal readable as text.
- For an entirely clickable earlier-page row, the title already opens the page; a small directional mark can replace the repeated “Open this page” wording.
- Open source needs an appropriate source/link or external-link mark. The existing icon catalog does not include a dedicated one; do not silently reuse a history-forward arrow for a different action.
- Use back/forward for calendar navigation where meaningful. Retain “Today” and “New page” labels initially; decide the Add event treatment with the calendar layout.
- Move Journal into a clearly separated notebook/content area, away from Trash and Settings. This placement improvement does not depend on resolving its eventual workflow.
- Seen and Done must remain distinct. An eye denotes reading status; a completion control denotes finishing a reminder. The supplied unseen artwork is a visual state, not evidence that a mark-unseen action already exists.

Completion criteria: consistent artwork, recognizable selected states, preserved badges, accessible names, visible keyboard focus, and generous touch targets. Every original destination remains reachable.

## 2. Compact reminders

Attachment coverage: page 1 oversized reminder card; page 4 repeated short and expanded wording.

Proposed default: a slim rounded row with a completion control, one concise reminder, and its due date/time. Put source and additional details behind a secondary control. A soft rounded row can wrap gracefully on a phone; a rigid single-line pill may not.

The local card currently displays both `title` and `body`, which explains the duplication. Show a useful summary once; fall back to body when no title exists. Some longer bodies contain details missing from the title, so preserve those details and make them available on demand rather than deleting stored content. Avoid fragile automatic attempts to judge whether two differently worded sentences mean the same thing.

Recommendation: prioritize Done on reminder rows; reserve prominent Seen controls for notes and task updates unless Joshua finds reminder reading status useful. Keep underlying reading and completion states intact.

Completion criteria: short reminders occupy substantially less vertical space; long reminders remain readable; unique details and source links remain available; completing a reminder still updates Overview, its notebook reminder page, and history consistently.

## 3. Screen fit

Attachment coverage: page 2 wide Overview and month screenshots; page 5 iPhone bottom gap.

### iPhone

Treat the screenshot as a reported defect requiring reproduction. Existing project notes describe multiple earlier viewport and system-background fixes, so another generic height override would be premature. Check the affected screen with the drawer open and closed, keyboard open and closed, and in both Safari and the installed app. Identify whether the strip belongs to app layout, safe-area padding, or the system-drawn background.

Completion criteria: the app surface visually reaches the available bottom edge; controls remain clear of the home indicator; scrolling and keyboard behavior remain sound on an actual iPhone. Desktop emulation alone cannot close this item.

### Wide desktop

The local Overview wrapper has a 1280px cap, and several other surfaces use narrower caps. The screenshots suggest that simply enlarging text is not the desired solution.

Proposed direction: let Overview distribute events, upcoming items, weather, and From Siena across useful columns when space permits. Let the calendar use a larger month area with the selected day's agenda alongside it. Preserve comfortable text line lengths inside those areas and collapse to a straightforward single column on phones.

Completion criteria: compare Overview and calendar at phone, tablet, laptop, and the actual 32-inch display's browser dimensions. Physical monitor size alone does not determine available layout width; record browser zoom and viewport dimensions during validation.

## 4. Multi-day events

Attachment coverage: page 3 event form.

Proposed interaction: Start date plus an optional End date, defaulting to a single day. Show an inclusive range to Joshua, such as September 25–27. Support an all-day span and a timed event whose end occurs on a later date. Reject an end before the start.

The current model has one date and optional start/end times. Queries currently match that single date. This change therefore includes the form, stored event representation, today's events, the upcoming agenda, day/month views, month markers, sync, backups, and calendar export/copy behavior. Confirm the needed persistence migration during implementation.

Completion criteria: one record appears on every covered day, including across month/year boundaries; editing or deleting it affects the whole span; old single-day events still behave as before; synchronization and backup round trips preserve dates; calendar export uses the destination format's correct end-date semantics.

This request is for a continuous span. Recurring events are a separate feature and are not part of this package.

## 5. Overview and Journal decisions

Attachment coverage: page 1 Overview action buttons and “From an earlier page”; page 2 Journal purpose.

### Overview actions

Current actions are New page, Add to today, and Search. New page creates a fresh page. Add to today reuses today's eligible writing through the capture flow; that distinction is not clear from the label.

Recommendation: retain a clear New page action and a search icon. Keep Add to today only if returning to today's running note is a regular habit; otherwise remove it from the prominent Overview actions while preserving a route to that workflow. If retained, choose wording that accurately explains which page opens.

### From an earlier page

This is a rediscovery feature: the local code selects a non-Journal page at least 30 days old, preferring a matching entry-date anniversary when available. It is not an unfinished-task list.

Recommendation: remove it from the default Overview for now, or make it an optional “Revisit” section. It need not occupy daily attention unless Joshua values that kind of rediscovery. Removing the section would not delete its source pages.

### Journal

The existing Journal collects a week's notes into one entry, then optionally rewrites that collected material as prose. It is not currently an ordinary daily-entry notebook in the navigation and capture flows.

Decision pending: personal reflection/daily entries, assembled weekly reviews, or both. If daily writing is chosen, the reserved-notebook behavior and capture routes need review; a rename alone will not deliver that workflow. Preserve existing entries in every option.

Completion criteria: Joshua can describe each retained Overview action and Journal's purpose in one sentence; primary actions lead predictably to the intended page.

## 6. Formatting toolbar

Attachment coverage: page 4 expanded formatting strip.

The screenshot shows the expanded strip, so reducing the resting toolbar alone would miss the complaint. Group everyday text tools together, place insertion tools together, and move pen, paper, color, and zoom into a compact appearance control. Retain easy access to undo/redo. Choose the always-visible formatting tools with Joshua before hiding frequently used actions.

Completion criteria: the expanded interface feels shorter and easier to understand; all existing tools remain discoverable; formatting preserves selection and focus; touch targets stay usable with the phone keyboard open; table and image editing still work.

## Suggested first delivery

Combine navigation icons, Journal relocation, and compact reminders into the first visible improvement. Begin the iPhone investigation alongside that work, and release its fix when verified. Review the result at phone and desktop widths before expanding the layout changes.

The original planning review made no application changes. The subsequent first implementation pass changes navigation presentation and reminder display locally; it preserves Journal’s workflow and stored reminder content. No deployment or live-data changes have been made.


## First pass implementation notes

- Navigation now uses the supplied icon artwork, with a matching source-link mark and completion marks. Icon buttons retain accessible names, hover titles, keyboard focus, and touch-sized hit areas. From Siena retains its numeric badge.
- Journal is in the notebook content area, separated by a rule. Its reserved status and weekly collection behavior are unchanged while its purpose remains undecided.
- Reminder rows display one main message and the due date/time. Details preserves additional text, source links, and the separate reading-status control; Done remains directly available.
- The service worker version advances to v14 for the next deployment. Existing tests now find renamed icon controls by accessible names rather than their former text-button styling.
- The local phone-size check found both the drawer and app root ending at the viewport bottom (844 of 844 pixels). This does not reproduce or resolve the reported physical iPhone strip. Existing code already handles keyboard sizing, bottom-inset compensation, and system edge colors. Real-device reproduction remains the next step; no speculative viewport change was made.
- Navigation/action areas were checked at widths of 320, 390, 768, and 1440 pixels with no horizontal overflow in Overview actions, calendar navigation, or the notebook footer.
- The unrelated pre-existing edit to `docs/siena-plugin.md` was left alone.

Validation: production build passed. All ten checks in the existing check script passed across their final runs (overview, editor, formatting joins, tables, sync, weather, Journal, backup round trips, experience, dashboard). Updated tests verify hidden reminder details can be revealed, Seen does not complete a reminder, Journal remains reserved in its new location, and seen/completed states reach the paired device. The sync completion check now waits for asynchronously loaded history before asserting. Visual review covered desktop and phone layouts; real iPhone verification remains outstanding.


## Second pass: screen fit

Implemented locally: Overview uses the available width, placing daily/upcoming content beside From Siena at wide desktop widths. Extra-wide windows also place events beside the forecast and reminders beside task updates. Smaller windows retain the original reading order in one column. Long prose stays within a comfortable measure.

Calendar places an enlarged month grid beside the chronological month entries on desktop, with the month remaining visible while scrolling longer agendas. Phone and tablet layouts keep the month above the entries. Day links continue to open the existing day view. Empty months now explain that there are no pages or events.

Joshua confirmed that the iPhone gap occurs when opening the app from its Home Screen icon. Joshua supplied the Screen report: innerHeight, visualViewport height, document client height, body bottom, and root bottom are all 894; screen height is 956; top inset is 62; bottom inset is 34; calculated safe bottom and browser overlay are zero; installed is true; displayed worker version is v13. The 62-point difference matches the top inset. This is consistent with reported WebKit standalone viewport issues, but the exact cause on this device has not been isolated. No speculative viewport-sizing change has been made. The local service worker version is v15 for the next deployment.


Phone research: WebKit [bug 236445, comment 9](https://bugs.webkit.org/show_bug.cgi?id=236445#c9) describes a bottom gap equal to the top safe-area inset when `black-translucent` is combined with `viewport-fit=cover`; those settings are present here. [Bug 301994, comment 12](https://bugs.webkit.org/show_bug.cgi?id=301994#c12) reports a matching 62-point standalone discrepancy on newer iOS. These reports support investigating the platform/status-bar combination, not declaring a fix. The screenshot cannot establish whether an alternate installed status-bar configuration will work. A controlled physical-device comparison is required before changing the launch settings in production.


Second-pass validation: production build and dashboard regression checks passed. Chromium layout checks passed at 320, 390, 768, 1120, 1440, 1920, 2560, and 3440 pixels, covering column order, horizontal overflow, and full-height app bounds. A seeded 28-day agenda verified that the desktop month stays visible during scrolling. Month navigation stays grouped at compact widths. Desktop and phone screenshots were inspected. The optional WebKit runtime download timed out and was stopped during its retry; WebKit/physical iPhone validation is not claimed. No deployment was made.


## Next work after this release

1. **Check this release in daily use.** Verify darker brass icons, subdued Trash/Settings, compact reminders, and wide layouts on Joshua's desktop and installed phone. The release worker version is v16. Keep the known iPhone gap separately tracked; this release does not claim to fix it.
2. **Multi-day events.** Add an inclusive start/end date range while preserving existing single-day records. Cover every affected day in Overview, the upcoming agenda, day/month views, sync, backups, and calendar handoff. Start with a continuous event, not recurrence. This is the next implementation package.
3. **Formatting tools.** Organize the expanded toolbar into common text tools, insertion, and appearance. Retain selection, undo/redo, keyboard behavior, and access to every existing feature.
4. **Overview decisions.** Review whether Add to today earns a primary position and whether older-page rediscovery should remain visible or become optional.
5. **Journal.** Keep the existing workflow while Joshua considers its purpose. No redesign is queued until that decision is made.

The iPhone gap remains an investigation alongside these packages. Before changing launch settings, compare the current Home Screen configuration with an isolated alternative on the actual device; do not treat a desktop browser result as evidence of an iPhone fix.

September 23 color revision: shared navigation/status artwork uses brass-600 on dark surfaces and brass-700 on paper. Trash and Settings use subdued teal at rest and become brass on hover or keyboard focus. Joshua explicitly authorized publishing this accumulated batch.


## Published release — September 23, 2026

Production: https://timber-inkfieldnotes.netlify.app

Netlify deploy: `6ab411b6cf5487acf98a9cb5` (current, ready), worker v16.

This release includes the icon/color revision, quieter Trash and Settings, Journal relocation, compact reminder display, wide Overview and Calendar layouts, and grouped phone calendar navigation. The source-upload route returned server errors twice. Publishing a staging copy of the already-built `dist` files succeeded, preserving the SPA redirect and cache headers from `netlify.toml`. No source commit/push or database migration was performed. Source changes remain in the local working tree, including the unrelated pre-existing plugin-doc edit which was not modified by this work.

Live verification passed: production worker v16, brass icon color, muted utility icons, wide Overview and Calendar layouts, phone navigation fit, and no browser runtime errors during the smoke check.


## Third pass — multi-day events and quieter tools

Implemented September 23, 2026. Joshua chose to keep New page and Search prominent and move Add to today and older-page rediscovery into optional tools.

- Events have an optional inclusive End date. The same event appears on every covered day, including across month/year boundaries, in today's events, the coming week, day views, month agendas, and calendar markers. Editing/deleting the event affects the whole span.
- All-day and timed ranges are supported. A timed span requires both times; invalid dates and reversed ranges are rejected. Existing single-day events retain their behavior. Calendar files end all-day spans on the following exclusive date, and timed spans carry the actual end date.
- End dates survive backup restoration and paired-device sync. Migration `20260923175921_event_date_ranges.sql` adds a nullable end_date with a date-order constraint. Applied to the existing Field Notes Supabase project, with the constraint verified. No event records were edited by the migration.
- Formatting opens with Text, Insert, and Appearance groups. Common text marks appear first; tables and pictures have their own group; colors, pen, paper, and zoom are under Appearance. Group buttons preserve editor/table selections. Close remains visible independently of horizontal tool scrolling; undo/redo remain on the main editor bar.
- Overview’s More tools disclosure contains Add to today and the optional older-page suggestion. Neither workflow nor any stored page was removed.

Validation: production build, dashboard, date-range, editor, table, sync, backup round-trip, overview-summary, and experience checks passed. Range coverage includes leap days, year boundaries, calendar export, creation/reload, every covered date, editing, deletion, and a span that started yesterday appearing in today's Overview. Visual checks at 320, 390, 768, and 1440 pixels found no toolbar container overflow. Phone/desktop screenshots were inspected; native-looking group button backgrounds found in the first screenshot were corrected. Physical iPhone keyboard behavior and the existing bottom gap still require device verification.

The production interface remains v16. Local v17 is ready for review. Journal behavior and iPhone viewport settings were left unchanged. The unrelated existing `docs/siena-plugin.md` edits remain untouched.

Database advisory follow-up (outside this feature): Supabase reports existing mutable search paths on `stamp_server_at` and `vault_of` ([remediation](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)) and disabled leaked-password protection ([guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)). The event migration does not modify these functions or authentication settings.


## Published third pass — September 23, 2026

Joshua authorized proceeding with the ready work. Production now serves v17 at https://timber-inkfieldnotes.netlify.app, deploy `6ab417364d06b8e74a2c50ac` (current and ready).

Published the locally built artifact through the established Netlify staging workflow, preserving SPA redirects and cache headers. Final build and whitespace checks passed. Live verification confirmed worker v17, multi-day creation/reload, every covered day, month markers, editing/deletion, today's and upcoming event cards, optional Overview tools, and all three formatting groups across four widths. The first broad browser smoke check timed out waiting for full page load; rerunning with DOM readiness passed. No browser runtime errors were reported in the passing checks.

Source remains in the local working tree; no commit or Git push was made. Journal and the physical iPhone gap remain the outstanding decisions/device checks. Reopen the installed app while online to receive the release; its Screen report should show worker v17 after the update activates.


## Journal decision and iPhone comparison — published v18

Joshua chose **weekly reviews assembled from existing notes** and identified the affected phone as **iPhone 16 Pro Max, iOS 27**.

Journal now explains its weekly purpose and offers Review last week. Reopening a review keeps the existing body intact. Gather a fresh copy creates a separate review with an “updated notes” title suffix, includes current source-note contents, and preserves the earlier review and reflections. The optional prose rewrite remains separate. No notebook migration or rewriting of existing user pages was performed.

Added two data-free diagnostic fixtures at `/screen-check/a/` and `/screen-check/b/`. They share the same viewport, layout, sizing rules, and theme; A uses the app's current black-translucent status-bar setting, while B uses default. Each has a distinct Home Screen identity and a report showing window, screen, insets, keyboard, and app bounds. Neither opens the Field Notes database nor registers a service worker. The production service worker excludes diagnostic paths so they cannot replace the offline app shell. Settings' Screen explanation now treats the measurements as evidence to compare, not proof of a system-owned strip.

This comparison is motivated by [WebKit bug 236445 comment 9](https://bugs.webkit.org/show_bug.cgi?id=236445#c9) and [bug 301994](https://bugs.webkit.org/show_bug.cgi?id=301994). Those reports do not establish the cause on Joshua's iOS 27 phone. If A does not reproduce the gap, the comparison is inconclusive. A successful B result still needs validation in the full app before changing its launch settings.

Build, whitespace, Journal regression checks, and diagnostic fixture checks passed. Journal tests verify reopening preserves a manually added reflection and a fresh collection preserves the original byte-for-byte while incorporating changed source notes. Fixture checks verify distinct launch metadata/manifests, portrait/landscape bounds, no horizontal overflow, and an unchanged offline app shell after visiting both tests. Chromium screenshots were inspected; physical iPhone results are pending.

Production deploy: `6ab42483cee11c364293b371`, worker v18. The comparison should be opened from its isolated deployment hostname, where an older installed app's service worker cannot interfere:

https://6ab42483cee11c364293b371--timber-inkfieldnotes.netlify.app/screen-check/

Next step: Joshua installs Screen A and Screen B from Safari using the instructions on that page, opens each from its icon, and shares the reports/screenshots and whether the bottom gap appears. Keep the existing Field Notes icon and archive. The production app's status-bar setting is unchanged pending those results.


## Physical iPhone comparison result — September 23

Joshua supplied reports and screenshots from both Home Screen test icons on the iPhone 16 Pro Max (reported iOS 27).

- A / black-translucent: screen 440×956, window and visual/document heights 894, root 0–894, top inset 62, bottom inset 34, effective bottom padding 0. The screenshot shows a teal band below the brass footer.
- B / default: the same screen/window/root dimensions, top inset 0, bottom inset 34, effective bottom padding 0. The screenshot shows the brass footer reaching the screen bottom; there is no lower teal band.

The comparison supports using the default status-bar setting. The identical 62-point screen/window difference does not locate unused space: in B the app begins below the status bar and reaches the screen bottom. Consequently the old subtraction of this difference from safe-area bottom padding is inappropriate for B.

The v19 candidate changes the app's status-bar meta value to default and calculates bottom clearance from the raw safe-area inset and browser overlay, without subtracting screen height differences. Keyboard viewport sizing remains unchanged. Settings now reports the configured status-bar value. Existing screen-comparison fixtures retain the v18 baseline for reproducibility.

Automated checks verify the 34-point home-indicator clearance survives the 956/894 measurement and landscape screen-size differences. Full-app verification on the actual installed iPhone remains the final check, including keyboard dismissal, rotation, and footer visibility. If the existing icon retains old launch behavior, preserve it and the local archive while investigating; do not delete/reinstall as a first troubleshooting step.

Published v19 as deploy `6ab427791e33dc6f62055652`. Production build, complete editor suite, dashboard suite, and diagnostic/offline-shell checks passed. Live verification confirmed worker v19, the default status-bar setting, and 34px simulated home-indicator clearance with a 956/894 screen/window pair while the root still reaches the viewport bottom. The production site is ready for Joshua to reopen from the existing Home Screen icon. Actual installed-app keyboard/rotation behavior and adoption of the launch setting remain to be confirmed on the phone.

## Existing installation after v19

Joshua's full-app screenshots show the lower teal band still present. Settings confirms worker v19, configured status-bar default, safe-bottom 34px, but raw top inset remains 62px (fresh Screen B had 0px). All viewport/root heights remain 894 against screen height 956. This supports testing retained Home Screen launch configuration; it does not establish that the new full-app layout itself is correct on a fresh installation.

Next controlled test: install the full v19 app from the immutable, separate deployment origin `https://6ab427791e33dc6f62055652--timber-inkfieldnotes.netlify.app/`, named Field Notes Check. Keep the original app and its local notes untouched. The isolated copy starts with its own local data and does not need pairing for this layout comparison. Compare its Settings → Screen and bottom edge. WebKit bug 316008 documents install-time retention of status-bar-related viewport behavior; it is supporting evidence, not proof of this device's exact cause.

## Installation/update confirmation — v20

Joshua reported that the fresh full-app installation removed the gap and that he had already synced it and deleted the old icon. He believes he subsequently installed from the regular production address. To verify the current Home Screen icon without relying on its name, Settings → Screen now displays window.location.origin as App address. Published v20, deploy `6ab42b9054d9269ebab92dc6`. Build passed; live browser check confirmed production address, v20 report, and phone-width text fit. Awaiting Joshua's installed-app screenshot: production origin plus v20 establishes that this copy receives regular releases; it does not by itself verify completeness of restored data or sync.
