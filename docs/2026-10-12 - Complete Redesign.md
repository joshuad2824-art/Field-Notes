# Field Notes — complete visual redesign

## Source and scope

Joshua authorized a complete visual and layout replacement using `../../../Field_Notes/design_handoff_field_notes_redesign/README.md`, the supplied `Field Notes Redesign.dc.html`, its tokens/palette, 27 reference screens, and original mascot assets. This supersedes the previous desk/kit appearance. The implementation remains inside the established React app.

## Implemented

- Room-and-tile Today board; continuous forward agenda and day sheet; monthly calendar with phone day selection.
- Floating contextual navigation, notebook sidebar/list, day-beside-page tablet layout, phone page heading, night/paper pages and original highlighters.
- Sixteen-color notebook palette, remembered last-notebook theme, page/default stock controls, and notebook manager.
- Workshop plans with real status and progress, owned tools, and the existing project editor under “On my desk.”
- From Siena note/reminder/update/saved board, work notebook desk, grouped local search, Settings, Trash, and illustrated empty states.
- Original mascots converted to small WebP assets; locally hosted fonts retained. No placeholder photos or fixture content ship in the build.

## Preservation decisions

- No backend, schema, hosted MCP, authorization, sync protocol, recurrence, import/export, or image-storage changes. Existing per-page stock/pen and explicit device choices remain authoritative.
- Legacy cover colors are translated at display time, without rewriting synced notebook rows on launch. An explicit color choice uses the existing notebook save/version mechanism.
- Editor heading line heights remain multiples of the existing 28px grid. Oswald caret buffers are centered to avoid changing CodeMirror's measured line geometry. Table tests compare actual text before/after a table separately from widget text metrics.
- Calendar file export remains in the event's secondary menu. Device names are omitted because the sync layer does not provide them. No invented Shop routine, status, progress, weather, or connection state.
- Tablet day/page split extends through 1199px to accommodate the supplied 1180px iPad reference despite the handoff's contradictory 1119px breakpoint label.
- The new appearance is isolated in `redesign-tokens.css` and `redesign.css`; editor highlighter CSS remains byte-for-byte unchanged. Older structural CSS remains where existing functionality still depends on it.

## Verification

`BASE=http://127.0.0.1:5188 npm run check` runs 23 current suites. The previous check command is retained as `check:previous-layout` for historical reference; its old rail, old masthead and previous layout expectations are intentionally obsolete. Functional tests for editor, tables, sync, Journal, backups, date ranges, recurrence, weather permissions, links, open-editor conflict handling, Davis consent, and publisher validation remain in the current gate.

The new checks cover 28 captures representing all 27 handoff references (the final reference contains two states), widths 1440/1180/820/390/320, runtime errors, record/image preservation during navigation, persisted themes and page stock, all 16 palette contrasts, reminder completion, reserved Journal, search, and restore/confirmed permanent deletion. Fixtures are restricted to unpaired localhost and never touch real archives. Screenshots/logs are in `work/2026-10-12-redesign/` and `work/check-results/`.

A clean dependency install and production build passed before publication. All 23 current regression suites and the complete design check passed. Physical Home Screen/Safari keyboard behavior and propagation to another paired physical device are separate from browser verification.

## Recovery and current status

Baseline `9475cec`. Source recovery archive: `work/2026-10-12-redesign/before.tar`. Published Netlify `6acd5e4be27d392faed8cafa` to https://timber-inkfieldnotes.netlify.app. Hosted navigation, local save/reload and runtime checks pass at 1440/1180/390/320px. Release source is synchronized with GitHub using `[skip netlify]` to preserve the verified deployment. Prior production is Netlify `6aca65a2c15d91b5423c0955`, service worker v38. This build uses v39.
