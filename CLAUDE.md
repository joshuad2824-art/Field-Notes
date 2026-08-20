# CLAUDE.md — the notebook app

*Working brief. Drop this at the root of the repo. It's the context a fresh session needs before touching anything.*

---

## What this is

A personal notes and journal app for one person, Joshua Davis. It carries the Timber & Ink design system. It replaces Apple Notes, which he keeps returning to and never enjoys.

Seven apps have been tried and abandoned over the years: Apple Notes, Day One, Moleskine Planner, Google Keep, Evernote, Bear, Timepage. **None of them died of missing features.** Moleskine was the best-looking and died of session logouts. Apple Notes is the plainest and survives on reliability. That asymmetry governs every decision below.

Companion documents, all of which should be read once at the start:

- `docs/teardown.md` — the seven apps, what each got right, what killed it
- `docs/architecture.md` — sync, storage, backup, risks, cost
- `docs/visual-system.md` — palette, type, grid, formatting, the pen
- `spike/phase0.html` — the working editor prototype this repo grows out of

The app itself is at the root: `src/`, `index.html`, `netlify.toml`. `npm run dev`.

---

## Settled decisions

Do not relitigate these without being asked. Each was argued through.

1. **One page type.** Not notes-and-entries-and-tasks. A page, plus light attributes: notebook, tags, pinned, optional entry date. The four uses (capture, long-form, journaling, reference) come from attributes, never from separate sections.
2. **No login, ever, after first run.** Device pairing with a non-expiring key. No sessions, no email, no password. The editor has no awareness a network exists — writes go to local storage and return immediately. Sync may fail without ever blocking the page. **Built now, and the key is the whole of it**: the first device generates 256 bits, its SHA-256 is the vault id every row is stamped with, and the server compares that hash against the one it computes from the request's own header. There is no accounts table, no token to refresh and nothing that can expire — which is the structural answer to what killed Moleskine rather than a longer timeout.
3. **Markdown files are the storage format.** Export is trivial because storage *is* the export format. No proprietary document tree.
4. **Notebooks: exactly one level.** Seeded as Field Notes, The Workshop, The Hearth, Church. They are *data* now, not a constant — any notebook can be added, coloured from the palette, or deleted, and deleting one tombstones its pages for the usual thirty days. Still no nesting, ever. Tags cut across notebooks.
5. **The syntax is never shown.** Not on hover, not on the active line. He will never want to see markdown. It lives in the file, not on the page.
6. **No pinch zoom; a deliberate one instead.** `user-scalable=no` stands — a pinch that rescales the layout wrecks the measure and the grid together. But a page standing on a big screen in front of a room is a different need, and the tray now steps the writing from 100% to 200%. The type and the 28px pitch scale as one, and the steps are quarters *because* of that: at 1.3 the line box is 36.4px, the browser rounds it to 36, and the dots walk out from under the writing a third of a pixel a line. 1, 1.25, 1.5, 1.75 and 2 give 28, 35, 42, 49 and 56 exactly.
7. **No handwriting / Pencil canvas.** Closed deliberately; removed the project's largest engineering risk.
8. **Solo use.** No sharing, no collaboration, no permissions. Conflicts are only ever between his own three devices.
9. **Web, not native — provisionally.** All three devices are Apple, so Swift + CloudKit is technically the better answer to the "never sign in" requirement. Web wins on iteration speed, which is what an app whose success is about *feel* actually needs. Revisit at the end of Phase 1, not before.
10. **Pen and stock are per-page attributes with an app-wide default behind them.** Settings holds the default; a page only stores its own value once it has been given one deliberately, so changing the default moves every page that never disagreed with it. This is still not light/dark mode — the frame stays night either way, and the setting chooses what stock the leaf is cut from.
11. **The page screen has no banner.** The leaf starts at the top of the screen and its own top margin carries the tools: back, the formatting row, undo/redo, and the ⋯ menu. Pin lives in that menu. The only thing above the page is a thin band behind the status bar, which exists so white status text stays legible over a cream leaf. It is the frame's own teal and it is the *whole* standoff — where the desk would otherwise add its own margin above the leaf, that margin is reduced by whatever the band already gave, so a device with an inset gets one band and not two stacked.
12. **While the keyboard is up, nothing on screen but the tools and the text.** The page foot — word count, edited time, tags — is for looking at a finished page, not for writing one, so it gives its line back while you type and returns when the keyboard goes.
13. **Three widths, three columns.** Past 1120px the app is a rail (264px), a page list (372px) and the desk. **Each column folds on its own** and both choices are remembered: the `☰` on the desk takes the list (⌘\), the `‹` in the rail's wordmark row folds the rail, and the `☰` in the list head brings the rail back (⌘⇧\). Every column carries the control for the one beside it, so no state is a dead end. Below 1120 nothing is docked — the list is the whole window, a page replaces it, and the rail slides over as a drawer that starts closed. Crossing the boundary reconciles the drawer.
14. **The date is the masthead.** There is no chrome bar anywhere. The rail opens with the wordmark, the day numeral in Playfair at 76px, and a **full month** below it. Two marks, and a day can carry both: an unfilled ring means something was written that day, and the one filled brass dot is today — the only thing on that grid that glows. The numeral opens the month whole, at `/calendar/YYYY-MM`, with that month's pages listed under it in the order they were written. Any day opens at `/day/YYYY-MM-DD`. All of it is a lens over the same pages and never a place they live. The shelf screen and the four cover cards are retired.
15. **A page sits on the day it was written** — `entryDate ?? created`, in one helper, `dayOf`. Not `updated`: a journal whose March page jumps to August because a typo was fixed in it is telling you about the typo, not about March. The rail's marks, the day view and the month view all go through that one function so they can't drift apart.
16. **The leaf fills the desk.** `max-width: none`; what's capped is the *measure*, fluid up to 900px, so the text widens with the window but a 27" monitor can't produce a 200-character line. Under 1120px the page is edge to edge — no desk, no shadow, no radius.
17. **The toolbar at rest is five marks, not eleven.** `☰`, undo, redo, `Aa`, `⋯`, with `Saved` among them. Undo and redo earned their place back by daily use; nothing else did. Everything that *shapes* the page still lives behind `Aa`.
18. **The tray is a strip, not a box.** It opens along the top of the leaf rather than dropping a tall rectangle over the writing, so the page being shaped stays in view while it is shaped. Past the width it has it scrolls sideways, and the order is deliberate: styles, blocks, marks and colours first, because what scrolls off the end should be the occasional things. Placement moved out of it entirely — a picture's own plate already carries those three marks, and in the strip they only ever set the side the *next* picture would land on.
19. **New page belongs to the list, not the rail.** The button sits at the foot of the column showing the pages it will join, at every width. The rail's foot is Trash and Settings — the app's two back rooms and nothing else.
20. **A conflict costs a duplicate page, never a paragraph.** Last-write-wins decides which version keeps the page's id; the losing one is written as its own page in the same notebook, opening with a `> Conflicting copy · <date> #conflict` line so it is both visible in the list and findable under a tag. Never a merge dialog. The whole decision is one pure function in `src/sync/reconcile.ts` with no Dexie, no fetch and no clock in it, which is why `npm run check` proves the truth table on node without a server.
21. **The mirror keeps tombstones forever; the device keeps them thirty days.** A page purged locally after its thirty days leaves its marker on the server, so a device that was switched off for a month cannot walk the page back in when it returns. Tombstone rows are a few bytes and permanence is worth more than the space.
22. **The weather is chrome, not a feature.** One line under the month in the rail, and on the date at the top of the list where the rail is a drawer — a temperature, one word, and the day's range. Open-Meteo, because it needs no key: a key in a client-side build is a key in public, which would have meant a server, for weather. No icon and no emoji; every mark in this app is a typed character and a little coloured cloud would be the only picture in it. It renders nothing at all until there is a reading — no placeholder, no spinner, no dash — because a slot held open for information that hasn't arrived makes the app look like it is waiting, and nothing here is allowed to look like it is waiting.
23. **The one prompt.** Weather asks this device where it is, once. An app whose whole identity design exists to avoid asking for anything now asks for exactly one thing, and it is worth being honest that this is a cost rather than pretending it isn't. It takes no for an answer permanently — a refusal is remembered so it is never raised again — and Settings can name a place instead, which also pins the weather to home while you are away from it. Refusing costs one line of chrome and nothing else.
24. **Nothing reads `env(safe-area-inset-*)` directly.** `--safe-top` and `--safe-bottom` in `tokens.css` are the only two places it appears. A desktop browser always reports zero for both, so the notch and the home indicator are invisible to us unless we can set them — and `npm run check` sets them to what an iPad reports and asserts on the bands that come out.
25. **The app is the screen, and nothing measures it unless a keyboard is up.** There is no band along the bottom because there is nothing there for a band to be: `#root` is pinned to the bottom of a body that is already `position: fixed; inset: 0`. Sizing the app to `visualViewport.height` was the band — the viewport stops short of whatever the browser is holding back, and the frame showed underneath. That was closed for an installed app first and left open in a browser on purpose, so the foot of the list wouldn't hide under Safari's toolbar; the honest reckoning is that a band you look at every day is worse than a button that needs a toolbar tapped away. So the overlay is now a *token*, `--browser-bottom`, and `--safe-bottom` takes whichever of it and the home indicator is deeper. **What has something to tap in it pads itself; nothing shortens the app.** A trailing `.scroll` pads itself the same way, because a column that ends in a scroll has no foot to do it.

---

## The stack

- **Vite + React.** Not Astro — the Timber & Ink site is Astro, and it's the wrong tool for an offline-first app with a service worker and live local state. Same tokens, different framework.
- **Dexie over IndexedDB** for local storage. Primary store, not a cache.
- **MiniSearch or FlexSearch** for full-text search, entirely on-device. Search never touches the network.
- **Netlify** for hosting; he already ships there.
- **Supabase** for the sync mirror, and it is three tables and one function — `supabase/schema.sql`, run once in a fresh project. No edge function, no server code, no sync endpoint of ours: the reconciliation is on the device and the server is PostgREST with a row policy. The policy is the whole of the auth, and it reads `current_setting('request.headers')` for the vault key rather than any JWT, because a JWT is a session and a session is the thing that must not exist here.
- **Design tokens** come from his real files — `colors.css` v2.2, `typography.css` v2.1, `surfaces.css` v2.0, `spacing.css`, `base.css`. Copy them in; don't reinvent values. Three added hues: oxblood `#530a28`, forest `#123737`, navy `#082744`.

## Data model

```
id         uuid, stable
notebook   one of the four
title      derived from first heading or first line, never required
body       markdown
tags       derived from inline #tags in body
created    timestamp
updated    timestamp
pinned     bool
entryDate  optional — the date this page is "about"
pen        ink | felt
stock      paper | night
deleted    tombstone, 30 days, never a hard delete
```

Sync added nothing to that envelope, deliberately. What this device and the mirror last
agreed on for each row lives in its own Dexie table (`synced`), keyed `p:`/`n:`/`i:`, so
nothing sync-shaped can leak into an export or into what a page *is*. Notebooks did grow
two fields — `updated` and `deleted` — because they are rows on three devices now, and a
notebook that merely vanished would be handed straight back by the next device to sync.

## Layout rules that are load-bearing

- Body: Spectral 17px, line-height **28px exactly** (1.647), measure 64ch.
- **Every block height is a multiple of 28px**, headings included, so the dot grid never drifts out from under the text. Break this and the page stops looking like paper.
- Dot grid pitch 28px. Paper: `rgba(20,42,43,.10)`. Night: `rgba(246,243,236,.06)`.
- Two stocks on the leaf itself: `paper` (cream page) and `night` (teal-900 page). The frame is always dark. This is not light/dark mode — it's one scene.
- One amber element per view. Inside a page that's the caret. Nothing else glows.
- Highlighters are pigment, not light: layered angled gradients, uneven radii, multiply on paper and screen on night. Five colors, `=={color}text==`.
- Motion: nothing between the tap and the text is ever animated. `--duration-instant` (90ms) or nothing.

## Voice in the interface

The Timber & Ink brand voice is first-person singular. **This app is the exception** — it has an audience of one, and that one wrote the copy. The chrome barely speaks: labels, not sentences. No "I", no "we", no personality in the buttons. The warmth is carried by the paper, the type, and the light. The podcast sign-off never appears anywhere in this app.

---

## Build order

**Phase 1 — the single-device notebook.** Everything below, no sync at all.

- ~~Real editor core.~~ **Done — CodeMirror 6.** It was evaluated and it wins on the one thing that mattered: `Decoration.replace` hides a marker *and* registers it as an atomic range, so the cursor steps over `**` in one move and backspace takes both asterisks. Writing that by hand on contenteditable is the spike's technique with more bugs. The grammar in `src/editor/markdown.ts` is the spike's, line for line; only the mechanism changed. `npm run check` asserts the two rules that quietly break — the syntax never showing, and every block height being a multiple of 28px.
- Four notebooks, the shelf screen, covers with brass plates and cream hairline edges.
- Capture, search, tags, pinning, checklists, the full formatting set.
- Export: a notebook or the whole shelf as a folder of `.md`.
- Then **live in it for a month before writing a line of sync code.** Every one of the seven apps failed at daily use, not at features. This is the phase that tells us whether ours will too.

**Phase 2 — sync and device pairing. Built.** Three devices against one Supabase project,
paired by a code and never by a login. `src/sync/` is the only place in the app that knows
a network exists, and it is imported by exactly three things: `main.tsx` to start it, the
Settings panel to configure it, and the rail's foot to read one word off it. The store, the
editor and every screen are written as though it were not there.

The shape, in one pass: pull the rows stamped at or after this device's cursor, decide each
one against what the two sides last agreed, apply everything inbound to IndexedDB *first*,
then push. Failing at any step leaves the device exactly as it was. Pictures go last and one
at a time — the text is the archive, and if the connection is only good enough for one of
them it should be the writing.

**Phase 3 — reordered, August 2026, and shorter than it was.**

The order now runs: the wide layouts (done), then sync (done), then the native question.
What was Phase 3 gets picked over rather than built wholesale:

- **Resurfacing** — a quiet "from your archive" on open, no notifications. Still wanted.
- ~~**Entry dates and a calendar lens.**~~ **Done.** The rail carries a full month, any day opens its own pages, and the month opens whole with its pages beneath it and steps to past and future months. A lens, never a container — nothing is filed by date, it is only looked at that way.
- **The commonplace book import** — the ~97 quotes and 40 aphorisms in Word. On hold and possibly dropped; it was a one-time migration of an existing collection, not a capability, and it is only worth doing if resurfacing is.
- **Scheduled monthly export** — on hold. It was called the highest-value safety feature here, and the reasoning still holds: the realistic threat to this archive is loss, not intrusion. But an installed web app cannot write to iCloud Drive on a schedule, so on this stack it degrades to "offer the export on the first open of the month" and needs a tap. Manual export already covers the same ground. Revisit it if the native path is taken, where it becomes genuinely unattended.

**The native question, after sync.** Two concrete things now argue for it rather than one: the keyboard accessory bar, and unattended scheduled export. A real Apple app would also let the formatting strip dock above the keyboard on iOS while staying at the top of the page on the desktop.

---

## Known open items

- **The name.** Still undecided, deliberately. It should come from the thing once it has a shape.
- **Colored highlights use a custom extension** (`=={forest}...==`). Plain `==` is the portable convention; the brace tag is readable but non-standard. Decide before there's a lot of content.
- **Export writes a small YAML frontmatter block** — notebook, created, updated, and any entry date, pin, pen or stock. Storage is still plain markdown; this is the one thing added on the way out, because a filename can't carry a created date and losing it would be worse. If it turns out to be clutter in another editor, drop it and accept the loss.
- **The manifest says "Field Notes"** because a PWA needs *some* name on a home screen. That's a placeholder standing in for the undecided one, not a decision.
- **The felt pen is Grape Nuts now**, with Linotype Feltpen still named first for the machines where it's installed and Caveat behind it. 20px against Spectral's 17; the 28px line box is unchanged.
- **A table is a GFM pipe table, and two things ride in it that GFM has no word for.** Column width is the number of dashes in the delimiter row — already how an eye reads a hand-aligned table, entirely valid GFM, and no other editor has to know we meant anything by it. A merge is a cell holding nothing but `<`, meaning "joined to the one on my left". That one *is* a convention rather than a standard, and it's the same class of decision as `=={forest}`. The obvious alternative — an empty cell meaning merged, which is what MultiMarkdown does — costs the ability to leave a cell blank, and a spreadsheet needs blank cells far more often than merged ones.
- **The table is the one block that isn't decorated text.** Widths, per-row merges and a wrapping cell are all things a row of independent lines can't do: the moment a cell runs to two lines, the cells beside it have no way to know. So the whole table is replaced by one atomic block widget drawing a real `<table>`, and every edit dispatches markdown back into the document so CodeMirror's history still owns undo. Two things this forces: `ignoreEvent` must stay `true`, exactly as for the picture plate, and `updateDOM` must keep the existing DOM — rebuilding it on each keystroke takes the caret out of the cell being typed in. Block decorations also can't come from a view plugin, so tables live in their own `StateField` while everything else stays in the plugin.
- **A table's rules are drawn over it, never set as borders.** A border takes up height, and one pixel between every row would walk the table off the 28px grid. Both hands are drawn into the SVG every time and CSS shows whichever pen the page is holding, so switching pens needs nothing to redraw. The felt hand's wander is seeded from the line's own index and never from a random number — a table that re-drew itself differently on every keystroke would shiver as you type.
- **The column grips are only as deep as the head row.** Running them the full height of the table put an invisible strip over every cell they passed, and a click near a column edge started a drag instead of placing the caret — which looks exactly like the cell being dead.
- **Indent is two spaces a level, four levels deep**, hidden like every other marker and said again as padding. Two spaces is exactly what a nested markdown bullet list is, so `- ` nesting resolves correctly in any other editor. Ordered lists don't: CommonMark wants a child of `1. ` indented three spaces to clear the marker, and ours gives two, so another editor reads a nested numbered list as siblings. Four spaces would fix that and break something worse — a plain indented paragraph would become an indented code block, which changes what the text *is* rather than how it's grouped. Two spaces is the smaller lie. Revisit only if nested numbered lists turn out to matter during the month.
- **Tab always reports handled**, at the fourth level and at the first. Letting it fall through when there's nowhere left to go sends the focus out of the editor mid-sentence, which is a far stranger thing for a key to do than nothing. Escape blurs the editor, so the keyboard still has a way out.
- **All caps changes the letters, it doesn't mark them.** There is no markdown for "shouted" and inventing one would be a private convention in a file meant to open anywhere, so the text itself changes and undo is what takes it back. It toggles, which is the only way back once the caret has moved on.
- **Underline is the tag itself: `<u>text</u>`.** There is no markdown for it and both candidates for inventing one are taken — `__x__` is bold in CommonMark and `_x_` is italic — so this is the one thing every markdown reader already agrees about. `u` isn't a block tag, so it stays inline, the writing inside it is still parsed as markdown, and the line renders underlined anywhere that renders HTML at all. That makes it the *least* private of the three conventions in here, unlike `=={forest}` and the merge mark. Seven characters of syntax to hide instead of four; the mechanism doesn't care. It is also the one mark in the grammar that **nests**: every other paired mark claims the whole run it wraps, so a second mark inside it is skipped and its markers end up showing — which is why `=={brass}**a**==` draws its asterisks. The underline can afford to leave the run open because nothing else in the grammar is looking for a `<`, and it has to, because tapping U then B gives `<u>**a**</u>` and B then U gives `**<u>a</u>**` and both are two taps away. It is drawn rather than decorated: a fine rule in ink, and with the felt pen one quick stroke — fattest in the middle, lifting to a thin tip on the right the way a pen leaves the paper. Not a wobble function, which draws a slow rough line and is the wrong gesture. Both are backgrounds, so the underline costs no height and the 28px grid never moves, and both are cloned across a line break so a phrase that wraps is underlined on both lines. The felt stroke's colour is baked into its data URI, because a background image is its own document and can't see `currentColor` — which is why there are two of them, one per stock, and why nothing else in the leaf needs that treatment.
- **Where a line sits is a brace tag: `{center}` or `{right}`.** This one *is* private, and it is the same class of decision as `=={forest}`: there is no markdown for alignment and nothing another editor would honour, so what it costs elsewhere is one legible word at the front of the line. It reads after the indent and before the block prefix, so `{center}## A heading` is both a heading and centred, and it is hidden and atomic like every other marker. Left is said by taking the tag off rather than by writing one, which is also what tapping the mark a second time does — a mark that can only be put on traps the line it was put on. It never goes near a table: a table is one block widget standing in for a run of lines, and a tag in front of any of them would take it apart.
- **A table's own width is one line above it, `{table 70}`, and only when it is narrower than the measure.** The other two things a pipe table has no word for ride inside its own syntax because they could. This one can't: the delimiter row is the only place with a number in it, and its dashes already mean the columns' *shares*. Reading a total out of them as well would mean a table hand-aligned in another editor arrived here two thirds the size it was written at — a silent corruption of somebody else's file, which is a different and worse thing than a private convention. So the width goes on a line of its own, in the app's own brace-tag shape, and it is part of the table's replaced range rather than a paragraph in front of it. A table at full width — nearly all of them — is exactly the GFM it always was. The edge grip that drags it is the only grip allowed to run the table's full height: it hangs off the outer edge, past the last cell, so there is nothing underneath it whose clicks it could swallow.
- **The strip fits on a desk, and that is a promise it keeps.** Three marks were added to it — an underline and the two alignments — and they were paid for in a pixel of gap and a pixel of button padding rather than in a second row, which is the one thing the strip is not allowed to become. `npm run check` asserts it doesn't scroll at 1800px.
- **A highlight never spans a line break.** The grammar reads one line at a time, so an opening `=={brass}` on one line and its `==` on the next can never be hidden — which is exactly how four characters of markdown end up showing on the page. A selection across three lines becomes three highlights, one per line.
- **A mark with no word under the caret does nothing.** The tray now carries the blocks and the inline marks, so bolding a word on a phone is a tap rather than two asterisks typed by hand. Tapping **B** with nothing selected takes the word the caret is in; tapping it on an empty line is a no-op, deliberately. An empty pair of markers has no content between it, the grammar's `[^*]+` can't hide it, and four asterisks sitting on the page would break the rule that the syntax is never shown. Doing nothing is the smaller failure.
- **Pictures are markdown.** `![caption](images/<id>.<ext>){left|right|full 44}` — the placement says which side the writing runs down and the number is percent of the measure. The bytes live in Dexie beside the page and the export writes them at exactly that path, so the link resolves in any other editor. Floats wrap because CodeMirror's lines are ordinary sibling blocks; if that ever stops being true, the margin plate becomes a full-measure one.
- **A picture with transparency loses its frame.** Whether a plate gets a border and a shadow is worked out from the file when it arrives — an SVG, or a bitmap with real alpha, is drawn bare. It is not guessed from the extension, because a cut-out PNG looks exactly as wrong in a box as an SVG does.
- **`ignoreEvent` on the picture widget must stay `true`.** Letting CodeMirror see `mousedown` inside the plate makes it start a text selection, which stops the browser ever beginning the native drag. That regression is invisible in the UI and only shows up as "dragging does nothing".
- **Pairing is a paste, not a scan.** The architecture note said "a QR code or a recovery phrase" and this is the phrase. A QR would need an encoder to show it and a camera plus a decoder to read it — two dependencies and a permission prompt — to save a copy-paste that happens three times ever, on devices that already share a clipboard. Revisit only if pairing turns out to happen more often than it should.
- **The pairing code carries the vault key in the clear.** It is a ~250-character block that anyone holding can read and write the whole archive. That is the honest cost of having no account to recover: there is nothing else to prove you are you. It is shown only when asked for, behind a button that has to be pressed.
- **No end-to-end encryption, still.** Unchanged from the architecture note and worth restating now that there is actually a server: the realistic threat to this archive is loss, not intrusion. Server-side encryption at rest comes free; a lost key that makes the mirror unreadable would be a catastrophe bought to protect notes already decided not to be sensitive. Wrong trade.
- **Pictures ride as base64 in the `images` table, not in a storage bucket.** One transport and one row policy rather than two services with two ways of asking the same question — and the bucket's policy would have to answer the header question through a different code path that can't be tested the same way. The cost is real: base64 is a third larger than the bytes, and the free tier's database is 500MB. If the archive ever grows enough pictures for that to bite, the fix is a bucket, not a bigger row.
- **The pull cursor is `gte`, not `gt`, and widens rather than skips.** Applying a row twice is a no-op; missing one is not, so the boundary row is always re-read. The failure that shape has is a whole batch of rows sharing one stamp, which would leave the cursor nothing to advance to — hence `clock_timestamp()` in the trigger rather than `now()`, and hence the engine doubling its window rather than stepping past. It gives up loudly at 6400.
- **`Offline` means unreachable, and it is checked rather than assumed.** A browser reports a blocked request and an unreachable host as the same one-word `TypeError`, so the first version of this called both of them "offline — it will catch up" and a permanently broken setup got to look like weather. When a request fails to leave, the transport now asks a second, plainer question — same project, same anon key, no vault-key header — and what comes back separates the four cases that need quite different things done about them: no network, no project, no `pages` table, or a browser refusing to send `x-vault-key`. Only the first two are weather.
- **The strip iOS keeps is coloured from what is actually at the bottom, and that had to be measured rather than assumed.** `<meta name="theme-color">` fills it, and the rule was always "whatever is at the bottom of the screen" — but only the page screen ever did the work. Everywhere else it was hardcoded to the frame's teal, and on a phone the bottom of the screen is the list's foot, which is `rgba(5, 27, 28, .92)` and lands at about `#061c1d`. Twenty points darker in every channel, which is a plainly visible band. `surfaceColor` composites an element's real background — `getComputedStyle` reports the colour that was asked for, not the one that landed — and the list sets the strip from its own foot whenever it is the whole window. Docked, it doesn't: the foot is then one column of three and has no claim on the width of the screen.
- **A key going into a header is cleaned of whitespace, not trimmed of it.** An anon key is a JWT and a vault key is base64url, so neither can legitimately contain any — but both are pasted by hand, and one copied out of a display that wrapped it arrives with a newline *in the middle*, where `trim()` doesn't look. That newline never reaches the network: `fetch` refuses to build the headers and throws before it opens a socket, which from inside the catch block is indistinguishable from a host that isn't there. It cost an afternoon of blaming a Supabase project that was healthy the whole time. Cleaning takes out the invisible characters too — zero-width spaces and joiners, which `\s` does not match and which nobody can delete by hand because nobody can see them. An ellipsis is the one mark that is deliberately *kept*: it means the key is partial rather than damaged, and stripping it would turn an honest failure into a 401 nobody could explain, so it is named as truncation instead. Keys are now cleaned on the way in, on the way out of storage (so a device already paired with a damaged key heals itself rather than needing setting up again), and checked against what a header may actually hold before the network is blamed for anything.
- **A free-tier Supabase project pauses after a week of inactivity.** It shows up here as `Offline` in the rail's foot and nothing else — no blocked write, no lost keystroke — which is the whole point of the design, but it does mean the mirror can be quietly stale for as long as nobody notices. The monthly export is still the actual backup.
- **The iOS keyboard accessory bar** — the up/down arrows and the Done tick — cannot be removed from a web app. It's the strongest concrete argument for the native path and should be weighed at the end of Phase 1. It's also the reason the formatting row sits at the top of the page rather than docked above the keyboard: two bars stacked on the keyboard would be worse than one bar at the top. If the accessory bar ever goes, the strip should move down.

---

## Where the build actually is

Phase 1 stands up end to end: the shelf and four covers, notebook lists with pinning,
the leaf editor, search, tags, trash with 30-day tombstones, export, and an installable
shell. It's been through two rounds on a real phone and now carries the tablet and
desktop layouts.

Phase 2 stands up too. Two files in the app call `fetch` and no others may:
`src/sync/transport.ts` and `src/weather/open-meteo.ts`. The rule that used to read
"nothing in `src/` talks to a network" now reads: a network lives in a leaf module named
for the service it talks to, nothing above it knows, and every failure it can have costs
nothing that was written. Grep for `fetch(` before believing otherwise — two hits are
correct, three is a regression until it is argued for here.

`npm run check` drives a real browser and is the fastest way to know nothing has
rotted: 304 assertions in three files. `tests/editor.mjs` has 216 covering the editor,
the grid, indent, tables and how wide they sit, the calendar, the keyboard, zoom, the
three widths, the folding columns, the safe-area bands, the bottom edge of the screen,
the underline, line alignment, the notebook manager, pictures and the tray.
`tests/sync.mjs` has 64, in two halves — the reconciler's truth table and the pairing
code run on node with nothing around them, and then two real browsers are driven
against a fake mirror held inside the test file, through pairing, a page crossing, a
picture crossing byte for byte, the mirror vanishing mid-sentence, a mirror that is
reachable but refuses the vault header, both devices editing the same page while
apart, a deletion crossing, and unpairing. `tests/weather.mjs` has 24 — the code
lookup on node, and then a browser told where it is by Playwright, driven against a
weather service faked in the test file.

**Sync runs against a real project now.** August 2026: three devices paired and
carrying the same pages. That settles the load-bearing half `tests/sync.mjs` could
never reach — PostgREST does populate `request.headers` the way `vault_of()` assumes,
so the row policy works and the whole no-account design stands up outside the fake
mirror. The rest of the engine was already proven against that mirror; this was the
half that needed a server.

Two smaller things about it are still only *probably* right, and both want time
rather than another test:

- **The stamp trigger under a bulk first sync.** `clock_timestamp()` rather than
  `now()` is what stops several hundred pages pushed in one transaction from sharing
  one stamp and leaving the cursor nothing to advance past. A first sync of a few
  pages does not exercise it. The engine widens its window rather than skipping and
  gives up loudly at 6400, so the failure would be visible — but it has not happened
  yet, which is not the same as it working.
- **A conflict in the wild.** The truth table is proven on node and two real browsers
  are driven through a divergence against the fake mirror, but nothing has yet gone
  wrong between the actual three devices. The first real conflict copy is worth
  looking at properly when it appears.

Two things are built but unproven, because only daily use proves them:

- **The iOS keyboard.** Two rounds on a real phone found two separate moves: iOS
  scrolls the document (a fixed body stops that) *and* scrolls the visual viewport
  (it doesn't). `src/lib/viewport.ts` positions the app at `visualViewport.offsetTop`
  and sizes it to `visualViewport.height`, so it covers exactly what can be seen.
  `npm run check` feeds that handler the numbers iOS reports, which proves our
  reaction; only the phone can prove iOS reports them.
  **Only while a keyboard is up. The rest of the time the app is not sized at
  all — in a browser as well as installed.** `#root` is pinned `top: 0;
  bottom: 0` inside a body that is already `position: fixed; inset: 0` — the
  viewport itself, whatever the device thinks that is. Nothing measures
  anything, so nothing can disagree. Whatever a browser holds back at the foot
  is `--browser-bottom`, which pads what has something to tap in it rather
  than shortening the app. See decision 25.

  What that does *not* fix is the strip iOS keeps for itself. Measured on a
  real iPad, the web view is handed 712pt of an available 744 — `innerHeight`,
  `visualViewport.height` and `clientHeight` all agree on 712, and `#root` and
  `body` both reach it. The app is not short; the viewport is, and the 32pt
  outside it is the system's to paint. It fills it from
  `<meta name="theme-color">`, so that follows whatever is at the bottom of the
  screen — the leaf's stock on a page, the frame's teal everywhere else. The
  band stops reading as a band because it stops being a different colour.

  That took three goes to see. The band of frame under the app on an iPad came
  first from `visualViewport.height` being short of the home indicator, then
  from `window.innerHeight` being short as well; `100dvh` would only have been
  a third number with an opinion. The mistake each time was treating it as a
  measurement problem. It was a structural one: two independent height
  calculations that had to agree, and no reason they would. An iPhone reports
  them equal, which is why only the tablet ever showed it.
- **The felt pen** falls back to Caveat everywhere Feltpen isn't installed.

The next move is not a feature. It's the month.

## How to work in this repo

Ship small and often — feel comes from fifty revisions, not one big build. When a choice is between beautiful and instant, instant wins; the slowness in this brand is aesthetic, never latency. When something in this file turns out to be wrong, say so plainly and change it here rather than working around it.
