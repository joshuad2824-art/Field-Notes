# Approved home and Theology shell — unpublished

Joshua approved the first v7 image (1440×900), with one addition: Theology in the open space beneath Notebooks. Further Theology requirements have not arrived, so its route contains only the dashboard shell. Publication is held; no production database migration, hosted-function deployment, frontend deployment or remote push has happened.

## Implemented

- Desktop follows the approved 48-column composition: weekday over text-only wine Quick Note; Today/Coming up beside the month and weather; larger Siena and Reminders readers below; compact notebook list above the full-surface Theology link. Long readers scroll internally and shorter cards end with their own content.
- The weekday background is exactly `#b9a590`. Measured text contrast is 8.18:1. Quick Note remains above 12.5:1 in normal, hover and focus states. Theology is a native link to `/theology`, supports keyboard activation, reload and Up navigation, and creates no notebook or page.
- Today includes all active non–St. John Siena message kinds and reminders, including future reminders. Exact St. John notebook items stay on that desk. Existing notebook associations are preserved; no keyword-based work classification or data moves are used.
- Calendar sources remain combined in Today and Coming up. The old future-work exclusion and 3-event/4-date display limits are removed. Both desktop columns scroll independently; empty columns have no heading or placeholder. The existing read-only snapshot, occurrence IDs, source credentials, permissions and updater remain unchanged.
- Shared safe Siena typography and searchable reversible Archive are included. Notebook pages are excluded; old unknown actions remain active until explicitly resolved; reading is separate from resolving. A separate reversible-state clock fixes cross-device restores without letting an unrelated later read undo them.

## Visual evidence

Fictional fixtures only. Screenshots show the implemented application, with no injected layout or substituted UI.

| View | Library ID | Current attachment ID |
| --- | --- | --- |
| 1440×900 | `[private Library identity]` | `[private file identity]` |
| 1366×768 | `[private Library identity]` | `[private file identity]` |
| 390px Theology shell | `[private Library identity]` | `[private file identity]` |

The standard desktop shows five complete reminders and all seven notebook names. At 1366×768 there are three complete reminder rows; Theology takes 68px and the notebook list becomes 204px tall with internal scrolling. Ten checked sizes span 1200–2560px desktop widths, tablet widths 1180/820, and phone widths 390/320. Desktop page and horizontal overflow are zero. Phone/tablet keep their established page-scrolling behavior and readable type. Six-week months fit on desktop and narrow phones. Viewport measurements and screenshots are in `work/2026-10-20-approved-home/`.

## Verification and release order

Build, Deno publisher typecheck, additive/repeatable migration and access-policy checks, Archive rendering/backup preservation, paired-device sync and reversible-state convergence checks pass. The full regression run identified stale assertions for the removed completed-history expander, retired fortnight strip and added Archive menu destination. Those checks now follow the approved behavior; all reruns now pass, including controls at 1920/1440/1180/820/390/320px. The full run plus completed targeted reruns and the two new suites covers 36 passing suites. Exact provenance is in `work/2026-10-20-approved-home/verified-checks.json`. Historical tracked captures are restored; current copies stay in the ignored local evidence directory. Test fixture writes reload before UI assertions to avoid calling a separate Vite development-module change bus.

The live baseline was refreshed before implementation: remote main `0da2a4acdf1fdc5199b6fc0964facbe0abf3e0e2`; published Netlify deploy `6ad4035c5e80357abb07cdde`. The original dirty local repository is untouched. Work is in the separate `codex/siena-archive-review` branch/worktree. Service worker v57 is prepared locally.

After Joshua supplies Theology details, implement only those requirements, rerun affected checks/build, then perform the one authorized bundled release: additive migration first, compatible publisher next, frontend last. Verify production assets, exact deploy/commit and hosted behavior. Local paired fixtures do not establish physical iPhone installation or real cross-device propagation.
