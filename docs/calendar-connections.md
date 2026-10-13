# Calendar connections

October 13, 2026

- Apple: existing authenticated read-only iCloud function. Feed address remains a function secret.
- Work: vault-protected scheduled Google snapshot, displayed in memory. The calendar remains private. Only event titles, dates and times are copied. Complete replacement reconciles changed and cancelled events; failures retain the last good snapshot and show its freshness. Scheduled daily at 07:00, 10:00, 12:00, 14:00, 17:00 America/Chicago while Codex can run.
- Family: direct Davis OAuth client with PKCE and the Davis read-only agenda function. Database role is restricted to existing household events/reminders; no writes or other collections. Consent is required per user. The browser retains a rotating refresh token for reload/restart recovery. Access tokens and family records stay in memory. Web Locks serialize renewal across tabs, and disconnect removes the saved connection across this browser. Read the past 30 days through the next 365 days in complete, validated 93-day requests; only publish after every request succeeds. TalkingPoints events/reminders enter through the existing Davis school-update workflow; do not duplicate them as native Field Notes records. General school news remains in Davis at Home.

Settings displays source/freshness rather than implying continuous or two-way sync. The account owner approved the read-only family connection on October 13. Persistence and year-range updates require live reload verification after deployment.

## Where each calendar shows (October 13, 2026, evening)

- Work (Ascension): Today lists only today's work events inside Today's Schedule. The whole work calendar, today and the next two weeks, lives on the St. John desk under "Your schedule". Work events never appear in Coming up, the Next two weeks strip, or the month mini-calendar on Today (except today's own mark).
- Coming up is family (Davis), school, church, Apple and native events only.
- The gold date card on Today is the weekday and date. The countdown that briefly replaced it is retired; `src/lib/countdown.ts` is kept in case a countdown for non-work events is wanted back.
- Logic: `src/work-calendar/schedule.ts`, checked by `tests/work-schedule.mjs`.
