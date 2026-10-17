# Field Notes Home Screen icon — October 17, 2026

Joshua asked to use his supplied `13.png` as the phone Home Screen icon.

- Original artwork preserved exactly at `docs/assets/field-notes-puffin-icon-master.png`; black background and composition retained.
- Generated 180px Apple touch, 192px and 512px web-app icons, plus 16/32/48px browser icons. Maskable version uses a black safety border.
- HTML and manifest use `puffin-20261017` URLs to refresh browser icon caches. Service worker v56 precaches the matching Apple icon and manifest.
- Baseline was verified against GitHub `main@8e6071529e6284044d35457eb5265883cfa57a24` and published Netlify deploy `6acfc26baa9242c3be229102`. Only icon assets, icon metadata, worker version, and release records change.
- Recovery copies and verification evidence: `work/2026-10-17-home-screen-icon/`. Earlier untracked screenshots that collided with current GitHub files were preserved beneath its `before-update/` folder.

## Verification and status

Clean dependency installation and production build pass. All application JavaScript and CSS match the existing production files byte for byte after matching the existing public Davis app identifier. Icon metadata, image dimensions, service-worker refresh, and offline icon/shell checks pass. All 33 regression suites pass; controls review was scoped to 390px (937 assertions), with additional desktop widths traversed before narrowing. Published from GitHub `f84feeefbd4e976d2121f22b75f1e8989355ea04` to ready Netlify deploy `6ad4035c5e80357abb07cdde`. All 13 checked live shell, icon, and application assets match the build byte for byte. A fresh 390px hosted session picked up worker v56, the 180px puffin icon, and passed offline reload. Physical iPhone Home Screen installation requires Joshua's device.

## Phone handoff

Open the live Field Notes site in Safari, refresh it, and use Share → Add to Home Screen. Confirm the puffin appears in the add preview. Keep the existing installation until the new one opens with the expected notes.
