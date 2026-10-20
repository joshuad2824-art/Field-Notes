# Private Theology study preview — historical checkpoints

**Current status: released after separate private-setup and publication approvals.** See `docs/2026-10-20 - Field Notes Private Study Release.md` for executed migration/import, deployment identity and live verification. Earlier pending statements below are retained as checkpoint history.

The existing reviewed home, Siena formatting, reversible Archive and calendar work remains in this worktree. The Theology entry now leads to a draft study dashboard with Daily Doctrine, the existing dated devotional pages, existing Church reminders and a full-card link to the existing unique Prayer Log in Field Notes, as Joshua confirmed. No duplicate reminders or prayer pages are created.

## Implemented locally

- Separate `field-notes-study` IndexedDB database, scoped to the current paired vault (or this unpaired device).
- Exact UTF-8 source bytes identified by SHA-256; contiguous source spans reconstruct every byte. Presentation and navigation metadata are separate from that source.
- Source-order topic navigation; passage search over every parsed section, including reference matter; internal source links; reading location and return navigation. Numbered readings receive no calendar dates.
- Read-only text rendering and separate highlights using canonical displayed-text offsets, source-edition hash, quote and surrounding context. Hand-drawn marks reflow with text. Unplaceable annotations are retained with a notice.
- Explicit download of the unchanged original Markdown, plus a separate highlights/place backup. Existing notebook exports are unchanged and do not include this separate study database.
- Paired-device sync for edition bytes, highlight records/tombstones and reading location. Three isolated browser contexts pass against a local mock using the actual supplied source. Live study tables have not been created or exercised.

## Verified so far

`npm run typecheck` and `npm run build` pass. `tests/theology-study.mjs` passes with neutral synthetic text at 1440×900, 820×1180, 390×844, 320×740 and 2560×1440. It checks reference-only search, internal links, source bytes unchanged, selection across inline emphasis, highlight reload/reflow, no horizontal overflow, 18–19px body text, and no rewrites of existing pages or reminders. Screenshots and measurements are in ignored `work/check-results/theology/` and copied to Library for review.

`tests/theology-sql.mjs` passes in local PGlite with actual pgcrypto. It checks source checksum rejection, own-vault read/import, missing-key and cross-vault denial, source UPDATE/DELETE denial, immutable annotation anchors, tombstones, stale-write guards and authenticated access without a vault header returning no book rows. These are local database tests, not a live deployment test.

The fresh Library copy materialized successfully outside the repository. Its 1,127,695 original bytes match SHA-256 `f35227ef7917f20ef0bf5003653e4174869889fa399cc73968c3ea02311e50d2`. `tests/theology-book.mjs` verifies exact byte reconstruction from 336 contiguous spans, all 260 numbered readings in 52 weeks and nine topics, all 675 anchors and 4,523 internal links, and search through opening material, the final reading, appendix, Works Cited, General Index, Scripture Index and closing material. All 4,523 links also survive presentation parsing; no targets are missing. Conversion aids precede the independently checked source boundary at byte 22,630. The original PDF is unavailable, so PDF fidelity is not verified or claimed.

Actual-book browser checks in `tests/theology-book-ui.mjs` pass at 320, 390, 820, 1440 and 2560px. They check nine topic routes, read-only readings, all 1,825 Scripture Index data rows, index links opening real readings, precise passage-search positioning, unchanged source hash and zero horizontal overflow. The original file stays outside the repository; browser test copies exist only in private runtime databases. No book text is placed in public assets, fixtures or screenshots.

`tests/theology-sync.mjs` passes against a mock, using three isolated browser contexts and 504 annotations. It checks single immutable source upload/readback, metadata re-derived from verified bytes, deletion versus stale edits, equal-clock convergence, edits during GET and POST, pagination and bounded batches, missing-table retention, wrong-vault/corrupt-source rejection, unpairing during a pull, timeout/recovery, scoped device caches and notebook-export exclusion. A queued follow-up pass preserves edits made during an in-flight request. This is not a claim of live cloud import or live access testing.

Dashboard and reading preview screenshots contain synthetic text. Refreshed topic-overview captures at 1440, 2560, 820 and 390px show the verified source's topic titles and counts only, with no reading excerpts. The desktop Library item was replaced as version 1 to preserve its identity; the additional viewport captures are new items. The phone opening is condensed so the first topic card is visible without shrinking reading text.

## Exact prepared cloud action — approval pending

Migration `supabase/migrations/20261020161815_theology_private_study.sql` targets Supabase project `ihzuhlhspuuevuwswkky`. It is prepared only and has not run live.

Creates `public.study_editions` (immutable source, checksum and navigation metadata), `public.study_annotations` (separate immutable anchors with mutable color/tombstone state), and `public.study_places` (edition reading location). All three use vault-scoped composite primary keys; annotations and places reference an edition in the same vault.

Enables RLS on these new tables and revokes all their default privileges from PUBLIC, anon and authenticated. Grants SELECT/INSERT on editions and SELECT/INSERT/UPDATE on annotations and places to anon/authenticated. No browser DELETE permission exists, and no edition UPDATE permission exists.

Adds eight operation-specific policies: two edition policies, three annotation policies and three place policies. Every USING/WITH CHECK predicate is exactly `vault = public.vault_of()`. This reuses the existing vault header/key boundary. It adds no linked-account/assistant access policy and changes no existing policy, table, credential, bucket or authentication configuration.

Adds two SECURITY INVOKER trigger functions, each with its own UPDATE trigger. One rejects annotation-anchor rewrites and guards annotation clocks/tombstones; the other guards reading-location clocks. The checksum constraint calls the existing pgcrypto digest function. No SECURITY DEFINER function is introduced.

Current paired devices can read ordinary vault notes. Proposed study access is limited to that same vault-key scope; a linked assistant session without the vault header receives no book rows. Stored content and device caches follow the existing plaintext data model. No new credentials or broader persistent access are introduced.

If the cloud action is approved, apply this specific migration, test allowed and denied live access, then perform only the authorized narrow book import and verify readback/hash/reconstruction. A rollback should stop the client while preserving rows, not drop the source tables.

## Remaining before a publication decision

Local revisions and regression verification are complete. Obtain approval for the unchanged cloud policy action before any migration; only after that approval, verify allowed/denied live access and the authorized narrow private import/readback. Publication remains a separate held decision. No commit, push, migration, function deployment or site deployment has been performed by this work.


## October 20 recovery checkpoint — local work complete

The interrupted session continued farther than its last conversational update. Read-only recovery found no active regression/test runner. The old full-run log ended with 36 of 37 suites passing; its sync failure was resolved by waiting for visible local-save completion before hard navigation in the test. The targeted sync rerun exited 0. `work/check-results/verified-report.json` combines that run, affected-suite reruns after the UI changes, and the new contextual-selection suite: **38 of 38 suites pass**, with **5,623 controls assertions**. This is aggregate verification, not a newly repeated full run during recovery.

The requested filler sentences, devotional call to action and decorative card arrows are removed, with no replacement copy. Theology entry cards, devotional, Prayer Log and study topic cards are native links; the Church reminders card uses a full-card link while its filters and actions remain individually operable. Prayer Log resolves the existing uniquely titled record in Field Notes; it creates no page. Spurgeon source pages remain unchanged.

The highlighter is absent before selection, preserves selection through pointer/touch and keyboard toolbar use, and hides on deselection, outside click or Escape. Desktop selection uses a native mouse drag; touch activation is Chromium emulation with a programmatically created range, not a physical iPhone/Safari selection-handle test. Highlight reload/reflow and immutable source checks pass. Actual-book UI passes at five widths; mocked sync still reports three devices and 504 annotations. Typecheck and build passed after the UI changes; the existing bundle-size warning remains.

Refreshed screenshots were already successfully written to native Library before the stream failed. Recovery read back all 11 Library identities and confirmed their names, byte sizes and native provider, then visually reviewed desktop dashboard, phone topics and both contextual-toolbar captures. Existing Library items were replaced rather than duplicated. Dashboard/reading/selection captures use synthetic text; actual-book overview captures show topic titles/counts only.

| Capture | Native Library ID |
| --- | --- |
| 1440 dashboard | `[private Library identity]` |
| 390 dashboard | `[private Library identity]` |
| 1440 topic overview | `[private Library identity]` |
| 820 topic overview | `[private Library identity]` |
| 390 topic overview | `[private Library identity]` |
| 2560 topic overview | `[private Library identity]` |
| 1440 reading | `[private Library identity]` |
| 820 reading | `[private Library identity]` |
| 390 reading | `[private Library identity]` |
| 1440 desktop selection | `[private Library identity]` |
| 390 touch selection | `[private Library identity]` |

Local screenshot paths and successful write receipts are in `work/check-results/theology/revised-library-writes.json`. No source import, duplicate runner, reset, commit, push, live migration or deployment was performed during recovery. The unrelated existing Vite process at port 5188 belongs to the original app checkout and was left untouched. Migration SHA-256 was rechecked and remains `ad6287354baebab99e3848ae26ae48abc2cb9de440dd3de1f38ce89df092ced9`.
