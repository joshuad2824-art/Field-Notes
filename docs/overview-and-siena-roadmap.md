# Overview and Siena: product direction

## What is in the first dashboard

`/overview` is a separate screen reached from the notebook rail or the list footer. It reads the local Dexie store, so it works offline and updates when local pages change. It shows recent pages, pinned pages, notebook counts, open Markdown checkboxes, and the existing capture and search routes. The checkbox list opens the source page; it does not edit a task from the dashboard. The sync label describes the device state, not a guarantee that Siena has seen every local edit.

The Siena card links to the existing connection settings. It does not claim that an in-app assistant is running. The current plugin can check connection status, list notebooks and recent pages, search, read, create, and update. It cannot delete pages, manage notebooks, retrieve image bytes, or call an assistant from within the app. Edits require the page's current `updated` value so a stale assistant write fails.

## Next useful slices

1. **Resume by context.** Add notebook filters to recent pages and open checkboxes, and preserve the chosen scope when leaving Overview. This matters when work, church, and personal writing should be viewed separately.
2. **Task navigation.** Take an open checkbox directly to its position in the editor. Keep the Markdown line as the source of truth; do not create a second task database just to power the card.
3. **Siena connection state.** Show whether this device is paired, whether the signed-in account is linked, and when the mirror last synced. Make “available to Siena” depend on both the link and completed sync. This requires a deliberate status read, not an inference from local pages.
4. **Ask Siena from a page.** Pass a page or notebook reference into a conversation so the user can request a summary, find related notes, or draft a revision. The app needs an explicit conversation handoff or a purpose-built assistant service before this button can do real work.
5. **Review proposed changes.** For multi-page or consequential edits, show the proposed Markdown changes and affected pages before applying them. Use the existing stale-write check, preserve a clear source and timestamp, and keep the app's normal sync conflict behavior.
6. **Assistant activity.** Make assistant-created and assistant-edited pages findable, with a short account of what changed. Add durable activity data only when a real assistant write flow exists; a decorative activity feed would be misleading.

## Decisions for a later integration

- The current link grants access to the whole vault. Decide whether Siena should be limited to selected notebooks before adding one-click “ask about these notes” actions.
- Decide whether assistant requests should run in Codex/ChatGPT through the existing plugin or inside Field Notes. An in-app assistant needs its own interface, server path, and cost controls.
- Keep local edits usable without sign-in or network access. A dashboard action must never make writing wait for Supabase or an assistant response.
- Treat assistant summaries as suggestions tied to source pages. Do not present generated conclusions as facts about the archive without showing which notes they came from.
