# Daily Use Review — November 10, 2026

Joshua asked for an in-depth look at how well Field Notes works day to day: bugs,
gaps, and anything that makes the app less pleasant to live in. **This is a review,
not a change.** Nothing in `src/` was touched. Every item below is a proposal
waiting for his go-ahead.

## How it was checked

- **The production build** (`npm run build`), served locally, with a made-up
  archive loaded straight into the app's own IndexedDB: 420 pages across the five
  notebooks (St. John included), some up to 2,300 words, ten tags, 45 events,
  18 reminders and 6 From Siena notes. One search test used 2,000 pages. None of
  Joshua's real notes were read or changed. His live, synced browser was not
  touched.
- **Every main route at four sizes:** desk 1440×900, iPad landscape 1133×744,
  iPad mini upright 744×1133, iPhone 14. That is 64 page loads, with a screenshot,
  console errors, sideways overflow and tap-target sizes recorded for each.
- **Timed flows:** cold open, + → new page, typing on a long page, search, quick
  note, the path to a notebook, and how long an edit takes to leave for the mirror
  after the app goes to the background (against a fake mirror, the same way
  `tests/sync.mjs` builds one).
- **The app's own regression run** (`npm run check`, 47 suites), plus a read
  through the code for storage, saving, sync, search, quick note, the page menu
  and the Today board.

## What is already solid

- **No errors anywhere.** 64 loads across four sizes: no console errors, no failed
  requests, no sideways scrolling.
- **Writing is fast.** + to a live caret takes about 0.45 s. A keystroke takes about
  15 ms, even on a 2,300-word page. Today paints in about 0.1 s on a warm load.
- **Search is fast enough for years of writing.** The first keystroke after a save
  rebuilds the index, and that took 78 ms with 2,000 pages. No change is needed
  there.
- **Saving is careful.** The editor saves to IndexedDB before the tab can hide, and
  a remote change that arrives mid-sentence becomes a conflict copy rather than a
  lost paragraph (`saveEditorBody` in `src/lib/db.ts`).

The problems below are about finding things again, about the last few seconds
before the phone is put down, and about information that is there but can't be
seen. They are not about missing features. That fits the teardown: none of the
seven earlier apps died of missing features.

---

## 1. Bugs, verified

### 1.1 Filtering search by notebook hides most of the matches
`src/lib/search.ts:63` keeps the top 60 results across **all** notebooks.
`src/screens/SearchScreen.tsx:50` applies the notebook filter **after** that.
So tapping *Church* only shows Church pages that happened to rank in the overall
top 60. In the 2,000-page test, 368 Church pages matched and **13 were shown**.
The "N found" count has the same flaw: it counts the capped list, so it is
never the real number.

*Fix:* pass the notebook as MiniSearch's `filter` option so the cap comes after the
filter. Show "60+" (or let the list keep going) when there are more.

### 1.2 Adding a second search word widens the results instead of narrowing them
MiniSearch joins words with OR by default. "dovetail walnut" finds every page that
has either word. Most people add a word to narrow, so this works against them.
The highlight (`Match` in `SearchScreen.tsx`) only marks the whole query as one
phrase, so multi-word, prefix and fuzzy hits show no highlight. Events and From
Siena are matched a third way: the exact phrase as a substring.

*Fix:* `combineWith: 'AND'`, falling back to OR only when AND finds nothing.
Highlight each matched term. Match events and Siena items word by word, the same
way as pages.

### 1.3 There is no way to find a word inside a long page
The app has no find-in-page of its own. The browser's ⌘F can't stand in for it:
CodeMirror only draws the lines near the screen. On the 2,293-word page, **436
words were in the DOM**, and the last line could not be found with ⌘F.

*Fix:* add CodeMirror's search extension (`@codemirror/search`) with its panel
styled for the app: ⌘F on a desk, and a "Find in page" item in ⋯ for touch.
Its match highlight is a decoration, so the "syntax never shows" rule is not
affected.

### 1.4 The last edit before you put the phone down is late reaching the iPad
When the app goes to the background, the editor saves to IndexedDB at once. That
part is correct. But the push to the mirror goes through the ordinary 3-second
wait (`DEBOUNCE`, `src/sync/engine.ts:60`). Measured: the push left **3,018 ms
after the app was hidden**. iOS usually suspends a backgrounded web app sooner
than that. So the note just written on the phone most likely stays on the phone
until the app is opened again. That is the same "I wrote it and it isn't here"
feeling that ended earlier apps. `onVisible` (`engine.ts:508`) only reacts to
the app *becoming* visible. Nothing reacts to it hiding.

*Fix:* on `visibilitychange` → hidden and on `pagehide`, skip the wait and push
at once, using `keepalive` on the request where the transport allows it. This
can be tested against the fake mirror the same way as above.

### 1.5 Overdue reminders look the same as upcoming ones
On November 10, "Due Nov 6, 6:43 PM" sits in the same list, in the same type, as
reminders due later that day. `DueLabel` takes a `completed` flag but no idea of
"late", and nothing anywhere styles a past due time.

*Fix:* "Overdue · Nov 6" in quiet oxblood rather than brass, which keeps the
one-amber-per-view rule. List overdue items first.

### 1.6 Today's tiles hide what doesn't fit, with no sign there is more
On the desk, Coming Up is cut off mid-line. From Siena hides about 1,300px and
Reminders about 730px behind an invisible inner scroll. The same happens at 1792
wide. With scrollbars removed everywhere (October 14), nothing tells you the
seventh reminder exists.

*Fix:* a short fade at the bottom edge of any tile that has more below it. That
is a cue, not a scrollbar.

### 1.7 Small: the day view's weather draws a broken tile when no place is set
In `/day/…` with no weather place, the right column shows a squashed "WEATHER"
pill and a stray half-circle. It only shows when no place is set, so it is
probably not on Joshua's devices, but it is still broken.

---

## 2. Things that work as designed, and the design works against you

### 2.1 There is no way back to what you were just writing
This is the biggest daily-use gap. Getting back to yesterday's page today:

- **Today has no recent pages.** No tile at any width lists what was last
  written or opened.
- **Opening the app always lands on Today.** The manifest's `start_url` is `/`
  and nothing remembers the last page. iOS often unloads a home-screen app in
  the background, so coming back mid-thought means starting over. Apple Notes
  reopens to the last note, and that is the habit Field Notes has to beat.
- **On a desk, opening a notebook shows an empty leaf** rather than the page you
  were on.
- **On a phone, Today → a page in Church is five taps:** room name → Notebooks →
  notebook name → Church → page.

*Proposal:* a quiet **Continue** line on Today with the three to five most
recently edited pages, one tap each. Reopen the last page when the app is
relaunched within a few hours. On the desk, open a notebook to the page last
viewed in it.

### 2.2 Resurfacing is built and tested, but nothing shows it
`pageToRevisit` (`src/lib/resurface.ts:4`) picks a page from this day in an
earlier year. `tests/experience.mjs` passes it. No screen calls it. The Phase 3
plan still lists "a quiet 'from your archive' on open" as wanted. It could be
one line on Today, or the last row of the Continue line above.

### 2.3 A quick note that isn't filed never leaves the device
An unfiled quick note is kept in the `meta` table (`src/lib/quick-note.ts:23`).
It is not synced, not searchable and not in an export. Only one exists at a
time, and nothing on screen says where it lives. A thought jotted on the phone
with no notebook tapped will never be seen on the iPad. The notebook dots carry
no names until one is chosen, and Field Notes and St. John are both blue.

*Choice for Joshua:* (a) file to the remembered notebook on ✓ unless another is
chosen, or (b) keep unfiled notes but sync them and make them searchable.
Either way, put names under the dots.

### 2.4 Deleting a page has no undo
⋯ → Delete page tombstones the page and leaves at once. It is recoverable from
Trash, but nothing on screen says so. *Proposal:* a "Deleted · Undo" line for a
few seconds, in the same voice as the rest of the chrome.

### 2.5 Sending a page from a phone means downloading a .md file
The only way out of a page is "Export as markdown", which on an iPhone ends in
Files. *Proposal:* a "Share" item that uses the system share sheet with the
page's text (`navigator.share`), and "Copy text" where sharing isn't offered.

### 2.6 An open iPad can be up to five minutes behind the phone
A device sitting open pulls new writing when it is changed, refocused, comes
back online, or every five minutes. If the iPad stays on Today while the phone
writes, the new note can take up to five minutes to show. *Options:* check every
60 seconds while visible (cheap), or use Supabase Realtime on the `pages` table
(nearly instant, and one more moving part). This is lower priority than 1.4.

---

## 3. Fit and finish on the iPad and phone

- **Touch targets below comfortable size** (measured on the iPad sizes): tags in
  a page's foot are 13px tall, rows in the day agenda 15px, Today's agenda rows
  on the iPad mini 19px, St. John's notebook switcher 22px, its Archive link
  14px, and month-view day cells 30×30. Apple's guidance is 44pt. The look
  stays; the hit area grows with padding.
- **Line length on the iPad mini.** Below 1120px the page runs edge to edge, so
  upright on the iPad mini a line carries about 100 characters. The 64ch measure
  that keeps the desk readable is not applied there. *Proposal:* cap the measure
  on tablets as well and let the leaf's margins absorb the rest.

## 4. Under the hood

- **Everything loads at once.** One 1.0 MB JavaScript chunk (311 KB compressed)
  plus 379 KB of CSS loads on every open: Theology, Workshop, Siena, OAuth,
  Settings and all. It is quick on a laptop. On an iPhone, parsing it is most of
  a cold start. *Proposal:* lazy-load Theology, Workshop, the OAuth screens and
  Settings. Keep the editor eager for the offline reason in the October 14 notes.
  Bump the service worker so offline still has every chunk.
- **Eighteen stylesheets, 481 KB of CSS source** (`redesign.css` alone is 171 KB).
  `app-design.css` has 58 rules for `.dashboard-app`, which no screen renders
  any more. Rules from several eras overriding each other is why visual fixes
  have needed several passes. *Proposal:* prune dead selectors, with
  `tests/pixel-compare.mjs` showing nothing moved.
- **Checked and fine for now:** every write makes each open view re-read the
  pages table, and search rebuilds its index after any write. At 2,000 pages both
  are well under 100 ms, so neither needs work yet.

---

## Suggested order

| Pass | Items | Size |
|---|---|---|
| **1 · Trust** | 1.4 push on hide · 1.1 + 1.2 search · 1.5 overdue · 1.6 fades · 2.4 undo delete | small, each a few lines plus a test |
| **2 · Finding your place** | 2.1 Continue line + reopen last page · 2.2 resurfacing · 1.3 find in page · 2.5 share | medium |
| **3 · Polish** | §3 touch targets and iPad measure · 2.3 quick-note decision · §4 bundle split and CSS prune · 2.6 freshness | medium |

## Decisions that are Joshua's

1. **Quick note:** file to the remembered notebook by default, or keep unfiled
   notes but sync them (2.3)?
2. **Reopening:** go back to the last page on relaunch, and within how many hours (2.1)?
3. **Overdue colour:** oxblood text, or a small mark beside the time (1.5)?
4. **Freshness:** a 60-second check, or Realtime (2.6)?
