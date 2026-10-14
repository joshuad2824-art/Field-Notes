# October 14, 2026 — scrollbars, toolbar flicker, and offline

Joshua's three asks, from his own screen and a screen recording of the notebook
screen.

## 1. No scrollbars anywhere

**What was there.** Two deliberate bars. `base.css` gave `.scroll`, `.manager` and
`.sheet` a thin cream-on-transparent bar ("chrome is where a bar belongs"), and
`app-design.css` gave `.scroll`, `.manager`, `.sheet` and `.cm-scroller` a 5px one
under `.approved-application`. The day agenda's two scrollers are both `.scroll`:
`div.agenda-days.scroll` and `aside.agenda-sheet.scroll`. That is the bar in the
screenshot.

**What is there now.** Nothing speaks about scrollbars except one rule at the end
of the scrolling section of `base.css`:

    * { scrollbar-width: none }
    *::-webkit-scrollbar { display: none; width: 0; height: 0 }

Both hands, because Firefox and current Safari read the property and older Safari
and Chromium read the pseudo-element. The star is at specificity zero on purpose —
no other file declares a bar that shows, so there is nothing for it to lose to —
and the test below fails the moment one does. Scrolling itself is untouched: a
wheel, a trackpad and a finger never used the slider.

**Proof.** `tests/no-scrollbars.mjs` — eleven routes (Today, overview, a notebook,
a page, the month, the day agenda, Workshop, From Siena, Search, Trash, Settings)
at 1440×900, 900×700 and 390×700, with a fourteen-event day and an eighty-heading
page seeded so the scrollers truly overflow. It reads *every* element's computed
`scrollbar-width` and `::-webkit-scrollbar` display, and then measures the gutter
of every scroller that overflows. The browser is launched without Playwright's
`--hide-scrollbars`; its control scroller costs 15px, so the gutter half is not a
free pass here. Run against the old styles it fails on every route and names the
agenda's scrollers at 10px; against the new styles it passes everywhere.

## 2. The toolbar blinking while a note scrolls

**Cause.** The pill answered every scroll event by itself: down by more than 2px
receded it, up by more than 2px returned it, and 260ms without an event returned
it. A mouse wheel arrives in notches further apart than 260ms; a trackpad's
momentum has gaps; and CodeMirror draws only the lines in view and estimates the
rest, so it moves the editor's `scrollTop` a few pixels either way each time it
measures a line it had guessed at. Each of those used one or more of the three
rules, and nothing remembered what it had just done. The editor is the scroller
(`div.cm-scroller`), so the long-note case is exactly where it shows.

**Counted before the change**, on a long uneven note, flips of the pill's
`receded` class: 24 for twelve wheel notches down and twelve up; 32 for a
slow read (30px every 450ms) with the mouse jostled; 40 for twenty slow notches
with the mouse still. **After:** 2, 2 and 2 — away once as you read down, back once
when you stop or scroll up.

**What changed** (`src/lib/pill-scroll.ts`, wired in `ApprovedFrame.tsx`):

- A run, not a nudge: travel in one direction, measured to its furthest point.
  Down needs 64px, up needs 48px. A step back shorter than a line (24px) neither
  ends a run nor adds to one.
- A verdict holds 500ms before a scroll may reverse it.
- The pill returns 800ms after the scrolling stops (was 260ms).
- A mouse move within 500ms of a scroll, or under 6px from where the pointer last
  reached, is not reaching for the pill.
- Typing cancels the pending return, so what the page scrolls to keep the caret in
  view never brings the pill back mid-sentence.
- The resting dim now waits for the scrolling to stop too, instead of counting from
  the last time the pill was shown.
- Scroll positions are held between 0 and the scroller's end before they are read,
  so iOS's spring past either end is not read as scrolling up.

**What did not change.** The design: it still recedes while you scroll down or
type and returns on scroll up, at the end of a scroll, when the mouse reaches for
it, or on a tap on the bar. Nothing about the pill's layout or look moved.

**A bug caught on the way.** The first version of the rule restarted the count at
every nudge back, so a page read down 30px at a time with a 6px correction between
each never said anything and the pill never tucked away. The rule now measures to
the furthest point of the run. `tests/pill-scroll.mjs` carries that case by moving
the editor's own `scrollTop` forward 30 and back 6, forty times.

**Proof.** `tests/pill-scroll.mjs`: the rules' truth table on node, then a real
browser counting class flips on a seeded long note under wheel notches, a
continuous scroll, a slow read with a jostled mouse, a still mouse, and the
forward-30/back-6 case; then typing, a trembling pointer, and a pointer that goes
somewhere. `tests/controls-review.mjs` still asserts "recedes while scrolling down"
and "returns after the scroll".

## 3. Does Field Notes work offline?

**Yes, and it was checked rather than assumed.** A copy of the production build
with the https-only guard lifted (the worker is registered only over https, so a
local preview never exercises it) was served locally, loaded once online, reloaded
so the worker controlled the page, given a note, and then the network was switched
off in the browser:

| Offline | Result |
| --- | --- |
| Today opens, fonts and layout intact | yes |
| An earlier note appears in its notebook list | yes |
| An earlier note opens and shows its text | yes |
| A new note can be created and written | yes |
| The new note is still there after a reload | yes |
| Both notes present after reconnecting, no page errors | yes |

**Why it works.** Notes live in IndexedDB on the device (the primary store, not a
cache) and the editor never waits on a network. The worker caches the shell and
every file under `/assets/` and `/fonts/` as they are fetched; navigations are
network-first with the cached shell behind. The editor is not a lazy chunk —
`manualChunks` makes it a vendor chunk loaded at boot — so there is no screen
that needs a file the worker never saw.

**What still needs a network**, as it always did: sync (pulls and pushes when the
connection returns), weather, the Apple Calendar feed, the work calendar and Siena
items. Written down, not blocked.

**Two soft spots**, neither seen to bite, neither triggered by this release (the
worker was left at v55 on purpose):

1. The first-ever visit loads its files before the worker takes control, so a
   brand-new device needs a second online load before it is offline-ready.
2. A worker version bump deletes the previous version's asset cache at activation,
   which leaves the HTTP cache (`immutable`, a year) to cover until one controlled
   online load refills it. Open the app once online after an update before relying
   on it offline.

**Not tested here:** sync against the real Supabase project after an offline
stretch (the repo's `tests/sync.mjs` covers it against a fake mirror, including a
mirror that vanishes mid-sentence), the Home Screen app on a real iPhone, and iOS's
own clearing of storage for sites that have not been opened in a long while (an
installed Home Screen app is the safer place for notes either way; the app asks the
browser to persist its storage).
