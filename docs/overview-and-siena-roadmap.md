# Overview and From Siena

## Local dashboard

The app opens to Overview (`/` or `/overview`). The established rail keeps the large date, month, current weather, and notebooks. The main area offers a new page, today's note, search, today's Field Notes events, a seven-day forecast, and a separate From Siena section. The former page-count and checkbox summary remains in the code but is no longer the front page.

Events belong to Field Notes. Add one from Overview, a day, or the calendar; edit it on its own screen. Date, optional times, location, and note are stored in IndexedDB first. The calendar and day view read the same rows. The editor can copy readable details for pasting into Apple Calendar. There is no calendar account connection or background import.

Weather uses the saved place and unit settings. Open-Meteo supplies seven daily conditions, highs, lows, and precipitation probabilities. The rail still uses the current reading. A cached reading remains visible if a refresh fails; an old cache without daily data triggers a refresh.

From Siena is a durable inbox, separate from notebook pages. The newest note appears in full on Overview. Reminders due today and older unseen reminders appear there, as do recent unseen task updates. Every item stays in `/from-siena`, and an unread badge persists until the user explicitly chooses **Mark seen** or **Mark all seen**. Merely opening either screen does not acknowledge anything. There are no device notifications.

## Sync and publishing

Dexie version 5 adds `events` and `sienaItems`. The existing mirror worker syncs events with conflict copies and merges inbox seen timestamps across devices. The SQL migration is [`supabase/migrations/20260922231119_add_events_siena_inbox.sql`](../supabase/migrations/20260922231119_add_events_siena_inbox.sql). It creates `public.events` and `public.siena_items` with vault-key RLS; the latter also lets a linked Auth account read and insert items. The Auth account cannot mark an item seen through that policy.

The MCP function adds `list_siena_items` and `create_siena_item`. Publishing requires the existing linked account. `create_siena_item` accepts a full body, optional title and source, and a due timestamp for reminders. A `source_key` makes retries idempotent. Its tool description asks Siena to publish meaningful notes, due reminders, completed-task results, or useful links, rather than routine runs with nothing new. No automation has been created to publish items yet.

Deployment order when approved: apply the existing base schema and `assistant-access.sql` if the project lacks them; apply the new migration; deploy the updated MCP function; deploy the app. Do not deploy the new app before the tables exist, because a paired device would otherwise report a sync error when it queries them.

The Whole shelf ZIP export contains pages and images as Markdown folders plus a `field-notes-data.json` file for events and From Siena items. Import restores those records by ID and only replaces a local record when the backup is newer. Individual notebook exports remain page and image exports.

## Later assistant interaction

The next useful step is an explicit **Ask Siena** handoff from a page or notebook with a source reference, followed by a review surface for any proposed edits. Keep local writing immediate and show source pages for summaries. The existing plugin reads, searches, creates, and updates pages; it cannot run an assistant inside Field Notes, fetch image bytes, or manage notebooks. Decide whether the linked account should retain whole-vault access before adding one-click requests about a notebook.
