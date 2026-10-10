# October 10 refinement handoff

Source: Joshua's `Downloads/design_handoff_phase1_kit` (README, audit, and nine-part visual kit), based on main `6931715`. The HTML files are design references, not runtime code or instructions to change infrastructure.

## Scope and decisions

Implement Phase 1 readability, calendar marks, navigation labels, copy, and time formatting. Build Phase 2 shared components and a development-only `/kit` preview without replacing production screens. Future screen rebuilds, Jot capture, and the icon redesign remain Phase 3/4 work, as defined by the supplied handoff.

Skip a persistent notebook spine-height field: stable notebook-ID-derived heights provide consistent presentation without schema, migration, backup, or sync changes. Keep data, history, pairing, and access controls intact. Prototype support scripts and missing design-tool bundles are not production dependencies.

## Phase 1

- Paper-specific ink, legible metadata and placeholders, single calendar marks, four labeled 52px phone tabs, desktop New page / Ask Siena labels, On my desk copy, compact 12-hour event times and overdue duration.
- Four forecast days below 400px; larger views retain five/seven. Corrected the existing 320px notebook masthead overflow by reducing its gaps.
- Production build, dashboard suite, five-width navigation suite, and eight-width phone/tablet checks pass. The 1440/744/390px computed-type audit passes; sampled light-paper text meets 4.5:1 contrast.

## Phase 2 and release

- Built Masthead/Actions, DeskContainer/ReadingColumn, SectionHead, Paper, Row, Card, Menu/Fold, Meta, Rail/TabBar, and RoomTransition in `src/components/kit/` with scoped `kit.css`.
- `/kit` is development-only and tree-shaken from the production JavaScript. It reads existing local records; preview controls only modify component state. The larger navigation and screen replacements remain future work. No settings flag, schema change, migration, or backend deployment is needed.
- Menus contain focus and support arrows, Home/End, Enter/Space, and Escape; folds support keyboard opening/closing. Completion waits for its callback and retains a failed reminder. Touch swipe is available on the Row. Cards keep edit controls as sibling buttons, not nested interactive links.
- Rail spines derive stable 96–128px heights from notebook IDs. Folded rail is 72px, open rail 236px; the preview tab bar has the reserved, disabled Jot slot. Room transitions preserve child identity and use a 90ms fade for reduced motion.
- Manila metadata is darker than the prototype values because the supplied cream-paper colors only achieved about 3.9:1 on manila. This preserves the stated readability requirement.
- Kit layout, keyboard/focus, completion, fold, stable-spine, motion, typography, and real-data preservation checks pass at 1440, 744, and 390px. All 20 suites in `npm run check` pass. A clean `npm ci` build matches the working build byte for byte.
- Phase 1 is on GitHub main at `e5c3241`; Phase 2 is `ac42e83`. Service worker v38 delivers the combined release. Physical iPhone behavior remains unverified; browser touch and safe-area simulations pass.


## Published verification

- Production: https://timber-inkfieldnotes.netlify.app
- Netlify deployment `6aca65a2c15d91b5423c0955`, published October 10, 2026 from the verified source on main (`ac42e83`); service worker v38.
- All 72 hosted files match the clean-install/working build byte for byte. Netlify confirms this is the current ready deployment.
- Live controls and reload checks passed at 1440px and 390px in isolated, unpaired browser contexts, with no page errors. No real notes, reminders, pairing, or cloud records were changed.
- Recovery and local logs: `work/2026-10-10-phase1-kit/`. The local kit preview runs at `/kit` in development. Its JavaScript is absent from production; the shared component source and scoped stylesheet are committed for future screen work.
- Physical iPhone and installed-app behavior are not claimed; simulated touch/safe-area and browser checks passed. The existing build-size warning remains.
