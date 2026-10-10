# October 10 refinement handoff

Source: Joshua's `Downloads/design_handoff_phase1_kit` (README, audit, and nine-part visual kit), based on main `6931715`. The HTML files are design references, not runtime code or instructions to change infrastructure.

## Scope and decisions

Implement Phase 1 readability, calendar marks, navigation labels, copy, and time formatting. Build Phase 2 shared components and a development-only `/kit` preview without replacing production screens. Future screen rebuilds, Jot capture, and the icon redesign remain Phase 3/4 work, as defined by the supplied handoff.

Skip a persistent notebook spine-height field: stable notebook-ID-derived heights provide consistent presentation without schema, migration, backup, or sync changes. Keep data, history, pairing, and access controls intact. Prototype support scripts and missing design-tool bundles are not production dependencies.

## Phase 1

- Paper-specific ink, legible metadata and placeholders, single calendar marks, four labeled 52px phone tabs, desktop New page / Ask Siena labels, On my desk copy, compact 12-hour event times and overdue duration.
- Four forecast days below 400px; larger views retain five/seven. Corrected the existing 320px notebook masthead overflow by reducing its gaps.
- Production build, dashboard suite, and five-width navigation suite pass. Phone/tablet and typography checks are running before the combined release.

## Phase 2 and release

In progress. The shared kit will remain isolated from production screens; update this record with final checks, main commit, and live deployment evidence.
