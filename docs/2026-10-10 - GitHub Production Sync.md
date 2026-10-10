# Field Notes — production source synchronization

Verified October 10, 2026.

## Production identity

- Site: https://timber-inkfieldnotes.netlify.app
- Netlify published deployment: `6ac95139d2e01bfff3cc3c36`; service worker v37.
- Hosted `field-notes-mcp`: active version 14.
- Existing GitHub history through `e1991c1` is retained, including the two files absent from the older local checkout: `docs/dashboard-layout-2026-10-07.md` and `tests/dashboard-layout.mjs`.

## Evidence

A fresh local production build matched all 72 hosted files byte for byte. After reconciling dependencies, the isolated checkout built from `npm ci` also matched those same 72 files byte for byte. The three hosted MCP source files (`index.ts`, `workshop.ts`, and `_shared/recurrence.ts`) were read back and matched local source exactly. No database records or hosted code were changed.

The original working installation contained Deno-managed package links newer than the npm lockfile. Exact direct versions and overrides for `@marijn/find-cluster-break` and `style-mod` now preserve the production dependency set in clean npm installs. The initial clean-install mismatch was resolved before committing.

## Checks and known findings

- Clean dependency installation, TypeScript checking, and production build pass.
- All 20 suites in `npm run check` pass against the unchanged production source; the local log is retained at `work/2026-10-10-regression.log`.
- Dashboard and approved-navigation suites pass against the isolated clean-install checkout; navigation checks cover 320, 390, 768, 1024, and 1485px.
- Actual publication-handler routing tests pass, including notebook validation, idempotent retries, and archive/read/completion preservation.
- Workshop validation tests pass.
- Recurrence tests pass, including 1440px and 390px create/reload/edit/export/sync behavior.
- The mobile/tablet suite reports an existing 2px horizontal overflow at 320px on the notebook list (`approved-content` and `listcol` measure 322px). Reproduced on both the original production source and clean install. It is recorded for a separate fix; this synchronization preserves production behavior.
- The build retains its existing large-JavaScript-chunk warning. Five whitespace-only lines in existing source are intentionally preserved to keep the production snapshot exact.

## Publication and recovery

The synchronization commit uses `[skip netlify]` to keep the verified deployed site in place. Generated builds, original recovery folders, local screenshots, tool configuration, and dependency directories are not committed. The isolated synchronization checkout remains under `work/2026-10-10-github-sync` for local recovery. Future intended releases can use ordinary commits and the connected build pipeline.
