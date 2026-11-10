# Daily Use Pass — November 10, 2026

Joshua's answers to the four decisions in `2026-11-10 - Daily Use Review.md`,
plus three requests of his own. Built on `claude/youthful-cerf-tmme2q`. Not
released: merging to `main` publishes, and that is Joshua's call.

## What he asked for, and what was built

### Quick Notes — "a quick notes folder that syncs"
- **Quick Notes is a notebook** (`quick-notes`, rust cover, on the shelf after
  the others). It is seeded on boot and stamped `updated: 0`, like Journal, so
  three devices meet with nothing to argue about.
- **A quick note with no notebook picked files into Quick Notes on ✓.** It is
  an ordinary page from then on: it syncs, it is searched, it exports, and it
  is moved to another notebook (⋯ → Notebook) or deleted like any page.
- **The choices are named.** The quick note's notebook dots became named
  chips, with Quick Notes first and chosen by default. Field Notes and St. John
  were both blue dots; now they say which is which.
- **It can be renamed and recoloured, not deleted** (`isKept` in
  `notebooks.ts`; the manager's trash is disabled with a reason). Quick note
  files into it by id.
- **Nothing left behind.** An unfiled draft from an older build is filed into
  Quick Notes once on boot (`fileLeftoverQuickNote`). An empty quick note
  closed with ✓ now leaves nothing, so the next one starts fresh.

### Reopening — "stays where I left it"
- An installed app launched at Today within **two hours** of being put down
  somewhere else goes back there (`src/lib/resume.ts`). Later than that it
  opens on Today. iOS gives no way to tell "unloaded in the background" from
  "closed on purpose", so the rule is a window rather than a guess; Joshua said
  Today is fine after a deliberate close.
- Only in the installed app (a browser tab keeps its own address), never over
  a deep link or a widget link, and never back into `/new` or `/today`, which
  would make the page again.

### Overdue — "a small mark"
- `DueLabel` draws a small coral dot before "Due …" when the time has passed
  and the reminder is open. Its accessible name says how late it is ("Overdue,
  2 days late"). Not a colour on the words, so one-amber-per-view stands. It
  shows everywhere a due time does: Today, the Reminders room, From Siena, the
  St. John desk and the per-notebook Reminders pages.

### Live updates — "near-instant"
- **A device rings when it pushes; the others pull at once.** `src/sync/
  realtime.ts` is a Realtime *broadcast* channel, the doorbell. It carries no
  writing, not even an id. Row-change subscriptions were ruled out: the rows'
  policy reads the vault key from request headers, and a socket has none.
  The channel name is a hash of the vault key under its own label.
- **A write made as the app is put down is pushed at once,** pages first, with
  `keepalive` when the request is small enough. Measured: 3,018 ms before,
  13 ms after (`tests/live-sync.mjs`). This is the review's item 1.4. It is
  what makes "near-instant" true from a phone, which iOS freezes seconds after
  it leaves the screen.
- **The heartbeat is a minute while the doorbell is down,** five while it is
  up. If the project ever refuses the channel, nothing breaks: devices fall
  back to the one-minute check.
- **Not covered:** Siena's own writes come from the hosted publisher, which
  does not ring. They arrive on the next heartbeat or when the app is opened,
  as before. Ringing from the publisher is a server change and wants its own
  approval.
- **Unverified against the real project.** The protocol is proven against a
  fake socket. Whether the live project accepts public broadcast channels can
  only be seen on Joshua's devices. If it doesn't, the fallback is the
  one-minute heartbeat.

### From Siena on Today — "I don't want to miss any important notes"
- The tile shows the **newest unread note in full**, then **every other
  unread note as a one-line headline** (date and title), then a line saying
  how many read-but-open notes are in From Siena. Nothing unread is ever out of
  sight; the tile just stops growing with the inbox.
- A **Mark seen** eye sits on the featured note, so working down the inbox
  from Today is one tap per note. Seen is still only ever an explicit act.
- A headline opens From Siena **at that note** (`/from-siena#siena-<id>`).

### Reminders — "their own home", St. John kept separate
- **`/reminders`**, the sixth room in the pill's sheet (⌘6; ⌘1–5 unchanged).
  The Reminders heading on Today opens it, and so does "All reminders" at the
  tile's foot.
- **Add** at the top: the words, one tap for *This evening* / *Tomorrow* /
  *Next week* (or any time), the notebook, Enter. + in the pill focuses it.
- **Grouped by when:** Overdue, Today, Tomorrow, This week, Later.
- **Tap a reminder to edit it:** words, a note, the time, the notebook.
  **Remove** is in the editor. Completing and removing both offer **Undo**
  for six seconds. *Done this week* lists what was closed, with Reopen.
- **St. John's reminders are not listed.** The room's foot says how many are
  open there and goes to the desk. Today's Reminders tile already excluded them.
- **No database change.** Siena's merge takes a reminder's words and time from
  the mirror's copy, so an in-place edit would be undone by the next sync.
  An edit is therefore a replacement: a new reminder with the new words, and
  the old one closed. *Removed* and *replaced* are said in columns that
  already existed and meant nothing for a reminder: `resolved_at`, plus
  `requires_action = false` for a replaced copy. Siena's tools only list
  reminders with no `completed_at`, so they see neither. The Archive shows
  removed reminders as "Removed" (restorable) and never shows a replaced copy.

### Today's layout — "doesn't look so odd with more or less data"
- **Desk:** the lower row (From Siena, Reminders, notebooks) is one level
  band. Tiles holding more than they show **fade at the foot** instead of
  cutting a line in half; the fade goes once scrolled to the end. The
  day card's *Today* and *Coming up* each take the whole width when the other
  is empty, and an empty week says so in a line.
- **Reminders tile:** the first six, then "N more · All reminders".
- **iPad on its side:** From Siena and Reminders stand the same height.
- **iPad upright:** the Notebooks tile is back. It had been hidden since
  October 20, when it moved inside `.board-links` and the rule that showed it
  still asked for a direct child.
- **Phone and iPad:** tiles stay as tall as their contents, as before. From
  Siena and Reminders are kept short by what they show, not by a height.

## Files

- New: `src/lib/reminders.ts`, `src/lib/resume.ts`, `src/lib/resume-boot.ts`,
  `src/lib/use-overflow.ts`, `src/screens/RemindersScreen.tsx`,
  `src/sync/realtime.ts`, `src/styles/daily.css` (loaded last),
  `tests/daily-use.mjs`, `tests/live-sync.mjs`.
- `@supabase/realtime-js` 2.117.0 is now a declared dependency. It was
  already installed through supabase-js at that version.

## Verification

- `tests/daily-use.mjs`: 37 assertions on node and in a browser. `tests/live-sync.mjs`: 5, two browsers,
  a fake mirror and a fake Realtime socket. Both are in `npm run check`.
- Today checked with an empty, a light and a heavy archive at 1440×900,
  1792×1109, 1133×744, 744×1133 and 390×844.
- The full `npm run check` result is recorded below.

## Not done here, from the review

Search (1.1, 1.2), find in page (1.3), undo for a deleted page (2.4), share
(2.5), the iPad touch targets and measure (§3), and the bundle and CSS work
(§4) are untouched and still stand as written in the review.
