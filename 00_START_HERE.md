# Field Notes — Start Here

Updated October 7, 2026 for Joshua’s Workshop/calendar/plugin request.

- App source: this repository (`src/`); established production origin: https://timber-inkfieldnotes.netlify.app.
- Current decisions: `CLAUDE.md`; Workshop and Davis integration behavior: `docs/project-desk.md`; plugin tools and release order: `docs/siena-plugin.md`.
- Published changes: unified Workshop, compact owned-tools card, plan image upload and back navigation, one calendar projection across dashboard/month/day, connection controls in Settings, eight additional MCP tools.
- Local plugin source: `/Users/joshuadavis/plugins/field-notes`; installed local version: 0.3.0. Hosted MCP version 9 is active; ChatGPT refreshed and lists 17 tools.
- Server migration: `supabase/migrations/20261007170122_workshop_images_calendar.sql`; Edge Function: `supabase/functions/field-notes-mcp/index.ts` plus `workshop.ts`.
- Verification: build and MCP typecheck pass; pure plugin tests, disposable SQL/RLS tests, and local browser checks pass. All regression suites passed, with the last navigation suite rerun after correcting an asynchronous test wait. Five viewport widths (320, 390, 768, 1024, and 1485px) passed.
- Release: GitHub commit 3235405cb6e1c8eefef92b57c3ff6f302a94b753; Netlify deploy 6ac67c3e619bcb00084a7d64 ready; service worker v25. Earlier Oct. 7 dashboard layout was preserved. Live Workshop, image/back controls, and tool discovery verified. Real Davis integration remains unconfigured; no real family calendar read or consent change was performed.
- Workshop project-index navigation was updated and read back. Next: configure the existing Davis OAuth client when requested; real calendar display and physical phone behavior remain unverified. The separate ChatGPT Field Notes skill was also updated in place; its identity and supporting files were preserved.

The working tree already contained substantial earlier changes when this request began. Preserve them. A before-change archive is held in this chat’s `work/baseline/field-notes-before-workshop.tgz`.
