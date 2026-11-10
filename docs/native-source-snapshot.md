# Native source snapshot — November 10, 2026

This branch preserves the existing iOS/iPadOS pilot and WidgetKit source without merging it into the production web release. It is a reviewed source snapshot, not a new deployment or a claim of full native production readiness.

## Scope

- Capacitor iOS project and universal iPhone/iPad layout and keyboard refinements.
- Calendar, Quick Note, Date, and Weather WidgetKit extensions with fonts and assets.
- Native deep-link routing and draft-preservation changes, regression tests, and locked dependencies.
- Source is byte-identical to the committed local pilot snapshot 89480af68c6f8ae4b8def4775d1d524e1e5e91e0 for the 70 source/configuration/test files included here. This commit deliberately does not import that local history or its operational records.
- Developer signing team/profile choices, device receipts, private notes, generated bundles, and local work artifacts are excluded. Configure signing locally before a physical-device build.

## Build and checks

Use npm ci, then npm run build for the web bundle or npm run build:ios for the iOS web bundle. Use npm run ios:sync to refresh the Xcode bundle and npm run ios:open to open Xcode. The app requires the matching Capacitor dependencies in package-lock.json. Signing and release provisioning are separate owner-controlled steps.

Fresh checks on November 10 passed: npm run typecheck; npm run build; npm run build:ios; node tests/native-widget-links.mjs (8 accepted routes and 25 rejected inputs); python3 tests/native-widget-models.py (actual Swift DST, calendar grid, and cache-isolation checks). The build emits its existing large-chunk warning. Full browser regression and physical-device acceptance were not rerun for this source backup.

Native durability/export, real archive pairing and cross-device synchronization, and physical widget interaction remain separate acceptance work. Calendar widgets currently show local dates rather than private synced agenda contents; weather uses independently configured public weather data.

## Production distinction

At verification, GitHub main and Netlify production both referenced 444b3a1155275d1baf30eda0dd75251cafe379a5; production deploy 6aea55cf8b7da1987130eea3 was ready/current. This snapshot does not change production, merge main, enable synchronization, migrate data, or activate permissions. Review and approval are required before merging or deploying.
