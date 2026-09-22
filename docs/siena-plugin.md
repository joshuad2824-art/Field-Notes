# Siena plugin

The Field Notes plugin connects ChatGPT and Codex to the existing Supabase sync
mirror. It exposes seven narrow actions: connection status, notebooks, recent
pages, search, read, create, and edit. It does not expose deletion or raw SQL.

## One-time setup

1. Apply `supabase/assistant-access.sql` after the base schema.
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
