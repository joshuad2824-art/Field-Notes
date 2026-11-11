# Share, Find and Search — November 11, 2026

The second pass from `2026-11-10 - Daily Use Review.md`. Joshua asked for
sharing a page from his phone first, then "what's next": the search fixes
(1.1, 1.2), find in page (1.3) and undo after deleting a page (2.4). Built on
`claude/youthful-cerf-tmme2q`. Merging to `main` publishes, and that is
Joshua's call.

## Sharing a page — ⋯ → Share

- **Share** opens the phone's or iPad's own share sheet, so a page goes to
  Messages, Mail, Notes or anywhere else iOS offers. It is the first thing in
  the page's ⋯ menu, by name, because it is the one used most from a phone.
  The menu's other actions stay as they were.
- **What goes is the page as it reads, never its markdown** (`src/lib/share-text.ts`).
  Decision 5 says the syntax is never shown, and sending it out raw would only
  show it somewhere else. Specifically:
  - No `#`, `**`, colour or alignment tags.
  - A checklist reads as ☐ and ☑, and a list as •. Nesting is kept, and
    numbered lists keep their numbers.
  - A table reads as rows of cells: `Part  ·  Qty`.
  - A link reads as its words with the address after them.
  - A picture on its own line reads as its caption.
- **Pictures go too.** The label says so ("Share with 2 pictures"). They are
  attached only when the system says it can send files.
- **Share selection** appears when words are selected, and shares only those.
  A selection that starts inside a line's hidden marker — a checklist's
  `- [ ]` — is widened to the line, so it reads `☐ two legs` and not
  `[ ] two legs`.
- **Copy text** puts the same readable text on the clipboard. It is there on a
  desk, where there is no share sheet.
- **iOS only opens the share sheet from inside the tap that asks for it.** A
  read from the database in between can lose that, so the text and pictures
  are made ready as the menu opens, and the tap only hands them over.
- Nothing leaves the device until a destination is chosen in the share sheet.
  `share.ts` calls no `fetch`.

## Find in page — ⌘F, or ⋯ → Find in page

- A bar under the page's tools: a field, "3 of 12", up and down for the match
  before and after, and close. Enter goes to the next match, Shift+Enter to
  the one before. Escape closes the bar, leaves the caret on the match that
  was showing, and does not also leave the page.
- **It finds what the browser couldn't.** CodeMirror only draws the lines
  near the screen, so the browser's ⌘F missed most of a long page. This
  searches the page's own text: 29 of 29 on a 200-paragraph page, including
  the last line.
- Case and accents don't matter. It never matches inside what the page hides:
  a link's address, a colour's name, an alignment tag, a picture's file
  (`src/editor/find-ranges.ts`).
- The marks are backgrounds only, so the 28px grid doesn't move. The test
  measures the marked lines.

## Undo after deleting a page

- ⋯ → Delete page now says **Page deleted · Undo** beside the pill for six
  seconds. Undo restores the page and opens it again. It was always in Trash
  for thirty days; this is the quicker road back. Any later action can use the
  same notice by raising `field-notes:undoable`.

## Search

- **A notebook filter finds everything in that notebook.** The filter is now
  applied inside the index's own search, before anything is cut. Before, the
  screen applied it after keeping the top 60 across every notebook: 13 of 368
  Church pages.
- **The count is true.** "103 found" means 103. Pages are shown up to 200, and
  past that a quiet line says "First 200 of N pages".
- **A second word narrows.** Words are joined with AND, falling back to OR
  only when all of them together find nothing. Events and From Siena items
  match the same way: every word, in any order.
- **Every matched word is marked,** including prefix and near-miss matches,
  not only the whole query as one phrase.
- **Notebooks are listed by their best match**, so the best page is at the
  top. A From Siena result opens at that note.
- **One search per pause, not per letter.** It waits 90 ms after the last
  keystroke. A single search over 2,000 pages takes about 70 ms.

## Files

- New: `src/lib/share-text.ts`, `src/lib/share.ts`, `src/editor/find.ts`,
  `src/editor/find-ranges.ts`, `src/components/FindBar.tsx`,
  `tests/share-find.mjs`.
- Changed: `src/screens/PageScreen.tsx`, `src/components/Sheet.tsx` (a named
  action), `src/components/ApprovedFrame.tsx` (the Undo notice),
  `src/lib/search.ts`, `src/screens/SearchScreen.tsx`,
  `src/editor/Editor.tsx`, `src/components/Icon.tsx` (a share mark),
  `src/styles/daily.css`.
- No new dependency. Find is about a hundred lines of its own rather than
  `@codemirror/search`, whose panel would have needed restyling anyway.

## Verification

- `tests/share-find.mjs`: 34 assertions.
  - On node: the share text and where find looks.
  - In a browser: a phone with the share sheet replaced by a recorder. It
    checks what Share, Share selection and Copy text hand over; Undo; find on
    a long page, including the grid; and the search counts, filter, AND and
    marks.
- The full `npm run check` result is recorded below.
- **Unverified on a real iPhone:** that iOS opens the share sheet from the
  installed app, and which apps keep both the text and the pictures. Mail and
  Messages do on recent iOS; some apps keep only one.

## Still open from the review

- §3, the iPad touch targets and line length.
- §4, the bundle split and CSS prune.
