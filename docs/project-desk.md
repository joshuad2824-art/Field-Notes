# Project desk and Workshop

The dashboard links ordinary saved pages. Add project, Add plan, and Add equipment open visible forms: select an existing source page or explicitly create a new one, fill in its details, and Save. Cancel leaves the source untouched. Gear buttons and Edit plan details reopen the same forms. A concurrent source edit blocks Save and retains the form input so it cannot silently overwrite newer writing. These actions do not seed a vault or duplicate an existing source page.

Project details include the shared project name, status, owner, where we left off, one next step, and current artifact. The desk shows up to three active projects. Plans share the project name and record a version; numeric version labels sort newest first, with source update time as the fallback. Older revisions remain linked. Equipment requires explicit confirmation that it is already owned; brand and model are optional. Missing or explicitly unknown details are omitted.

The forms store readable labels in the source page rather than separate project records. Existing notes can also use these markers directly:

- Active projects: `#project`, `Status: active`, and optional `Project:`, `Owner:`, `Where we left off:`, `Next step:`, `Artifact:`.
- Plans: `#project-plan`, shared `Project:`, optional `Version:`.
- Equipment: `#owned`, optional `Brand:` and `Model:`.

Examples inside fenced code do not count as metadata. Saving details preserves other writing, image references, and Markdown hard breaks. Removing the owned confirmation removes the workshop link while retaining its source page.

Ask Siena opens a request composer. Write a request and optionally attach an existing saved page. The preview is the exact text copied to the clipboard. Paste it into the conversation manually; no conversation transport is connected. Failed copying retains the input and exposes selectable preview text. Work with Siena uses the same request builder and retains explicit review-before-apply and unchanged-page/picture-removal guards.

Plan pages show source text, simple headings and tables, and original image Blobs with their dimensions and file size. Use Add image to attach an original PNG, JPEG, WebP, or GIF up to 8 MB; the image and its source reference save in one local transaction guarded by the current page version. Open the source editor explicitly for writing edits. Back to Workshop returns to the complete plan list. Print / Save PDF uses the browser print dialog. Unverified physical scale remains reference material; this pass does not generate calibrated cutting templates.

## Davis connection prepared locally

The consumer reads only `https://davis-at-home.netlify.app/integrations/field-notes/agenda`, using Bearer authorization and bounded inclusive `from`/`to` dates. It validates the complete schema-version-1 snapshot and connected account/household before displaying it. Occurrence IDs and source versions remain opaque; recurrence is already expanded by Davis. Multi-day occurrences appear on each covered day, and incomplete overdue reminders retain date-only due dates.

The snapshot and access/refresh tokens stay in memory and never enter editable pages, exports, vault sync, or service-worker cache. Network failures retain a previous snapshot with an explicit stale state. Disconnect, 401/403, and identity changes clear protected data; late responses cannot restore it. A new tab or reload requires reconnection. Local disconnect does not revoke the persistent grant; Manage consent opens Davis's `/connect.html`.

OAuth uses a dedicated public client, authorization code with PKCE S256, and the exact callback `https://timber-inkfieldnotes.netlify.app/oauth/davis/callback`. The issuer is `https://bsyupmesvqwxboncwgeg.supabase.co/auth/v1`. Discovery must confirm that issuer and its endpoints. Only the short-lived, one-use PKCE transaction uses sessionStorage; callback parameters are scrubbed from the URL. Token claims are checked before use, while the Davis server remains responsible for signature verification and current permission. Token exchange alone does not establish a connection: an authorized complete agenda read must succeed.

Set `VITE_DAVIS_FIELD_NOTES_CLIENT_ID` only to the separately approved registered public client ID. It is currently unset, so the UI truthfully shows setup required. No localhost, preview, or wildcard production callback is allowed. No real client registration, binding, consent, OAuth exchange, or household read has been performed. Activation requires separate approval for the cloud-owned backend prerequisites/deployment, restricted client and initial account/household binding, matching client configuration, consent, and an authorized end-to-end test.

## Local checks

Run `npm run dev`, then `BASE=http://127.0.0.1:5173 npm run check`. The desk, metadata, and Davis consumer tests use Vite's local module boundary and disposable browser contexts with invented fixtures. They require the development server. Do not run them against production or an existing browser profile.


## October 7 Workshop and shared-calendar revision

The single Workshop route contains a compact Tools on hand card followed by plan cards. The former Plans route is a compatibility alias; primary navigation has Today, Notebooks, and Workshop. Plans still use the same ordinary source pages, revisions, and original image records. No live pages or owned-tool confirmations were created by this code change.

Family events are merged in memory with native events on the dashboard, month calendar, day view, and calendar markers. A muted teal edge and Davis / Read only tag identify the external source. Opening one goes to Davis; it never opens a native Field Notes event editor. Stale events retain a stale tag; disconnect/revocation clears the external projection without changing native events. Family reminders share the Remember card. The separate Davis agenda panel has been removed; connection and refresh controls now live in Settings. Real connection activation remains subject to the existing prerequisites above. Only fetched date ranges can be displayed; the current Davis reader supplies today and the following six days.

Local verification entrypoint: `tests/workshop-check.html` on the Vite development server. It refuses fixture actions in a paired archive and is not part of the production bundle. Its controls load invented plans/events and run image transaction, stale conflict, sync-byte, and external-calendar lifecycle checks. Manual browser checks cover image upload, return navigation, month/day views, and 390px/1485px layouts.
