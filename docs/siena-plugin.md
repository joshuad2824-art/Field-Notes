# Siena plugin

The Field Notes plugin connects ChatGPT and Codex to the existing Supabase sync
mirror. It exposes nine narrow actions: connection status, notebooks, recent
pages, search, read, create, edit, list From Siena items, and publish a From
Siena item. It does not expose deletion or raw SQL.

## One-time setup

1. Apply `supabase/assistant-access.sql` after the base schema, then the migrations
   in `supabase/migrations/`, including events/Siena items and reminder pages.
2. Deploy `supabase/functions/field-notes-mcp` with `verify_jwt = false` from
   `supabase/config.toml`. The function verifies OAuth tokens itself; its
   discovery request must be available before sign-in.
3. In Supabase Authentication, enable OAuth 2.1 Server and dynamic client
   registration. Set the Site URL to the deployed Field Notes origin and the
   authorization path to `/oauth/consent`. Allow that origin as an Auth redirect.
4. Open Field Notes on a paired device. In Settings → Siena, sign in by email
   and link the archive. This proves possession of the existing vault key.
5. Create a personal plugin in ChatGPT developer mode with this MCP URL:
   `https://<project-ref>.supabase.co/functions/v1/field-notes-mcp`.
   Complete the account consent screen when the plugin first connects.

The email account is only for the assistant connection. Field Notes editing
and device sync remain local first and do not require signing in.

## Access boundaries

`vault_links` associates one Auth user with one vault. Its insert policy checks
the vault key header, while its select and delete policies check the signed-in
user. The plugin uses a user-scoped Supabase client and the page/notebook RLS
policies; it has no service-role key or vault key. Unlinking the archive in
Settings removes access immediately at the database policy layer.

The `update_page` tool requires the exact `updated` value from `get_page`. A
stale edit fails, allowing the assistant to reread and reconcile the text. The
app's normal sync still preserves conflict copies for simultaneous offline
edits. Notes with pictures can be read as Markdown, but the first plugin
version does not return image bytes.

`create_siena_item` publishes a full message, due reminder, meaningful task
result, or saved link into From Siena. For a reminder, pass the intended
notebook ID from `list_notebooks`. The function creates or reuses that
notebook's pinned Reminders page, and the same reminder appears on Overview.
The page is a view of reminder rows, so checking an item off there or on
Overview completes it in both places. Completed reminders leave the active
list and remain in From Siena's history. Mark seen only acknowledges reading;
it does not complete a reminder. A `source_key` avoids duplicates on retry.
The linked account can publish but cannot acknowledge or complete reminders.
No recurring publication is configured by this code.

## Tool discovery and skill installation

The server advertises nine tools. A connection exposing only the seven page
tools is missing `list_siena_items` and `create_siena_item`; creating an ordinary
page is not a substitute for publishing a reminder.

For a ChatGPT developer-mode connection, open Field Notes in ChatGPT Plugins,
select **Refresh**, confirm both Siena tools appear, then start a new
conversation. This refresh updates the connection's stored tool metadata; it
does not require a database change. See the official
[connection refresh guidance](https://developers.openai.com/plugins/deploy/connect-chatgpt).
Refreshing an MCP connection does not install a local Codex skill into ChatGPT.

On September 23, 2026, the ChatGPT Field Notes connection was refreshed and its
settings visibly listed both `create_siena_item` and `list_siena_items`. The
same `SKILL.md` from the local plugin was separately uploaded through ChatGPT's
Skills directory and appeared under Installed. Future skill edits must be
updated in both installations; refreshing tools alone does not update the skill.

Joshua's local Codex plugin source is `~/plugins/field-notes`, installed as
`field-notes@personal`. It includes `skills/field-notes/SKILL.md` and connects
directly to the MCP endpoint, without a tool allowlist. Its skill routes ordinary
writing to pages and dated dashboard tasks to structured reminders. It also
covers notebook selection, timezone-aware due dates, idempotent retries, and
the distinction between reading and completing a reminder. Start a new Codex
task after reinstalling to pick up the new skill.

## Reminder verification

- `create_siena_item` with `kind: "reminder"` requires an existing notebook and
  `due_at` in Unix milliseconds. Omit `source_url` to use the managed page link.
- Read back the item with `list_siena_items`; verify its notebook, due time,
  and source key. Reuse the source key for the same request when retrying.
- Today and overdue reminders appear on Overview until completed. Future
  reminders in the next seven local calendar days appear in Coming up.
- The notebook Reminders page and Overview read the same record; marking done
  on either removes the active reminder from both and preserves its history.
- `entry_date` plus Markdown checkboxes does not publish a reminder. Neither a
  heading nor a page's `purpose` or `pinned` field converts Markdown tasks.
- External writes arrive through incremental sync, not a Realtime subscription.
  Returning to the app requests a sync; the foreground interval is five minutes.
  A successful MCP write confirms server storage, not immediate screen refresh.

For local UI regression coverage, start the development server and run
`BASE=http://127.0.0.1:5173 npm run check:dashboard`. The suite uses a separate
browser context and verifies shared reminder completion and retained history.
