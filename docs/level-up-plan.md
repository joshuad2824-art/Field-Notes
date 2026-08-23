# The Level-Up Plan

*Companion to `architecture.md`, `teardown.md` and `visual-system.md`. Written August 2026
against the five App_Design research phases and against the code as it actually stands.*

---

## What this document is

The App_Design research library — Phase 01 *The Personal Tool*, 02 *Capture & Retrieval*,
03 *Structure & Trust*, 04 *Density, Surface & Feel*, 05 *Teardowns* — was read in full and
every finding that bears on this app was pulled out. Then every finding was checked against
`src/`, because a research document written about a category is not evidence about a
particular build, and four of the things the research would have had us build turned out to
be built already.

So this is not a catch-up list. The app is further along than the literature assumes a
personal notes tool gets. What follows is the short list of things genuinely missing, the
shorter list of defects that can be measured rather than argued about, and one structural
hole that is worth more than the rest of the list combined.

Claims are graded the way the libraries grade them: **empirically supported**, **craft
consensus**, **convention**, or **inference**. Where a phase is honest that something is
untested, this document says so rather than borrowing the strength of the diagnosis for the
treatment.

---

## 1. What the check found

**Four things the research would have prescribed are already in the code.** Worth recording,
because each is a place where an instinct beat the literature and the record should say so.

- **Titles and title-weighted search.** Phase 02 calls titles "the highest-leverage retrieval
  investment" and asks for fuzzy matching and recognition snippets. `src/lib/model.ts` has
  `titleOf()` deriving a title from the first non-table line; `src/lib/search.ts` runs
  MiniSearch with `prefix: true`, `fuzzy: 0.2`, and `boost: { title: 3, tags: 2 }`, and
  `excerptFor()` returns a 180-character window around the first match rather than the top of
  the page. That is the whole of what Phase 02 asks for, built before it was asked.

- **`prefers-reduced-motion`.** Phase 04 opens its application spec with "honour it from day
  one." `base.css:157` already zeroes every transition and animation under it.

- **The day is computed in local time, not UTC.** Phase 03's sharpest technical warning is the
  `new Date('2026-05-22')`-parses-as-UTC-midnight bug, which files an evening entry on
  tomorrow's square for anyone west of London. `isoDay()` in `format.ts` builds the string from
  `getFullYear`/`getMonth`/`getDate` — local parts. The bug does not exist here.

- **Pictures are not base64 in the archive.** They live in their own Dexie blob table and export
  as real files at `images/<id>.<ext>`, which is exactly the path the markdown references, so
  the links resolve wherever the folder is opened. Base64 is transport only, inside sync. Every
  phase that worried about inline data URIs in a portable file was worrying about something
  this app doesn't do.

**Everything else the research flagged, the code confirms.** No resurfacing. No importer. No
command palette. Fonts from a CDN. Unquoted YAML in the export. The highlighter and cover
palettes, with numbers in §4.

---

## 2. The structural hole: export runs one way

There is no importer. Grepped across the whole repository — not a snapshot — the only file input
and the only drop handler both accept `image/*` and route to `onDropFile`, which inserts a picture
(`StyleTray.tsx:333`, `Editor.tsx:122/146`, `PageScreen.tsx:133`). There is no `unzipSync`, no
`FileReader`, and nothing anywhere that parses frontmatter on the way *in*. `export.ts` writes
zips; nothing reads them.

Four separate things are downstream of that one absence, and they have been showing up in the
open-items list as four unrelated problems:

1. **The monthly export cannot be restored.** Phase 03 states the rule flatly — "a backup that
   has never been restored is not a backup." Here it is stronger than untested: the app has no
   code path that could restore it. The folder of markdown is readable by a human and by any
   editor, which is real and is the point of decision 3 — but it cannot be poured back into the
   app it came from. *(Craft consensus, multiply sourced: Krogh's 3-2-1, endorsed by CISA;
   graded in Phase 03 as a rule of thumb, not an empirical finding.)*

2. **The commonplace book has no mechanism.** The ~97 quotes and 40 aphorisms are listed as
   "on hold, possibly dropped." They are neither — there is nothing to hold them with.

3. **Apple Notes never migrates.** Phase 01's §4 is blunt that a personal archive tool is at
   its least rewarding exactly when enthusiasm is decaying: "seed with real data on day one…
   migration is not a nice-to-have; it is what buys you past the empty-value trough." *(Graded
   in Phase 01 as reasoned inference specific to that phase, not an established finding — the
   reasoning is strong and the evidence is thin, and it should be held that way.)*

4. **A device rebuild is a re-pair, not a restore.** Today the only way onto a fourth device,
   or back onto a wiped one, is the vault key and a full pull from the mirror. Which works —
   until the day it is the mirror that is wrong.

All four are the same function. Read a zip or a set of `.md` files, parse the frontmatter, upsert
on a rule. One piece of work closes four holes, and it is the thing that makes decision 3 literally
true rather than aspirationally true.

On ranking, so this document doesn't quote four different superlatives at you: **capture is the most
urgent** (every phase says so, and §3.3 is small), **the importer is the most leveraged** (one build,
four holes), and **resurfacing is the most valuable thing the app doesn't do at all** — which is a
different claim from either. §7 sequences them by cost and by which windows are closing, not by
those three labels.

**Three things it has to get right.**

- **Upsert by `id`, not by filename.** Frontmatter should carry the page id on the way out so
  a restore is idempotent — restore twice, get one copy. Today `frontmatter()` writes notebook,
  created, updated, and optionally date/pinned/pen/stock, and no id. Adding it is one line and
  it is what separates "restore" from "import a second copy of everything."
- **Import is not sync.** An imported page is a local write like any other and the mirror
  catches up on its own. Nothing about the importer should know a network exists.
- **A round-trip test in `check`.** Export → wipe → import → assert deep-equal. That single
  test is what turns §4's YAML quoting and the private-syntax question from theory into a red
  build. It is also, per Phase 03, the difference between having a backup and believing you do.

**Size: medium.** A week of evenings, most of it in the parser and the test.

---

## 3. Features, ordered by what they add

### 3.1 Resurfacing — one quiet line from the archive

Phase 02 calls this the highest-novelty, highest-potential feature available to the app. Phase 05
wants it too, ranks it **fifth** in its own application list behind capture, and grades it soberly:
"resurfacing works, but its evidence is mostly the maker's own." So — the most valuable thing this
app does not do at all, and not the most urgent thing on this list. §7 sequences it fifth, which is
where Phase 05 puts it.

The two phases want it for different reasons, which is why it survives the demotion.

Phase 02's reason is retrieval. Search cannot rescue what you don't remember you have, and the
evidence on that failure mode is the hardest in the phase: Bergman, Whittaker & Schooler (2021),
50 participants and 250 bookmarked targets, found **only 16% were ever retrieved via the
bookmark facility and 4% via the menu hierarchy** — bookmarked sites "were not better retrieved
than those that had not been bookmarked." Whittaker's 2011 *Annual Review* synthesis puts it
structurally: exploitation — actually re-using what you kept — is the weakest, least-supported
stage of the whole cycle. (The n=345 / 85,000-action study is a separate 2011 CHI paper by
Whittaker, Matthews, Cerruti, Badenes & Tang, and it is the one §6 leans on for filing. Same year,
different evidence.) *(Empirically supported, in directly analogous domains.)*

Phase 05's reason is the collector's fallacy. Tot's answer is a hard cap of seven notes; a journal
cannot have a cap, so Phase 05 offers "aggressive resurfacing that forces triage" as the
substitute. **Be honest that the version specified below is not that one** — it forces nothing, and
what it buys is re-contact rather than triage, which is what Phase 05 says you actually get. Dan
Shipper's line about Roam is still the shape of the failure — "a garbage dump full of crufty links and pieces of text we hardly ever
revisit. And we feel guilty and sad about it."

**Grade the treatment honestly.** The problem is well-evidenced; the cure is not. Phase 02 files
automatic resurfacing under *craft consensus — experienced practitioners agree, untested*, and
lists "whether automatic resurfacing actually reduces abandonment or adds burden" as an open
question. Build it small and removable.

**Do not frame it as review.** The spaced-repetition literature is genuinely strong — Adesope et
al. 2017, 118 experiments and over 15,000 participants, *g* = 0.61 — and it is strong *for
deliberate memorization of defined material*, not for handing back a note. Phase 02 says the
transfer is untested; Matuschak keeps his prompts separate from his notes for exactly this
reason. Design for re-contact. Never say "review," never show a queue, never show a count.

**The spec follows the weather line, which is already the working prototype of this pattern.**
Decision 22 is reusable almost verbatim: one line, no icons, renders nothing at all until there
is something to render, no placeholder and no spinner, because nothing here is allowed to look
like it is waiting.

- Placement: under the masthead in the rail, or on the date at the top of the list where the
  rail is a drawer. Same slot the weather already occupies, same discipline.
- Selection, in order: a page whose `dayOf` is this day in a prior year; else a page from a
  notebook untouched for 90 days; else an old page not surfaced within the last N. `dayOf`
  already exists and this is a Dexie query.
- Dismissal costs nothing and is not remembered as a judgement.
- One line at a time. Never two.
- **Never a count, never a streak, never a gap.** See §6.

**Kill criterion, pre-specified because Phase 02 supplies it:** if it starts to feel like an
obligation rather than a gift, it has become upkeep — make it more passive or take it out.

**Size: small.** A Dexie query, a selection rule, and one line of chrome.

### 3.2 Append to today

The cheapest thing on this list and possibly the most used.

One action that appends a timestamped line to today's page rather than creating a new one. No
new page type, no new field, nothing added to the envelope — it is decision 1 taken to its
conclusion. Phase 02 calls the append-only daily log "extremely low friction (no 'where does
this go?'), and chronological order is itself a retrieval cue," and Phase 05's first stealable
mechanism is Drafts' open-to-a-blank-page, whose whole content is that classification is
deferred and never demanded.

The app already has `dayOf`, a day screen, and one page type. What it doesn't have is a path
where a fleeting thought never has to be judged worthy of its own page.

**Size: small.**

### 3.3 A `/new` route, and a real capture path

Today the fastest capture is: icon, shell, list, new page, type. There is no route that lands a
live caret — `router.ts` has `shelf | notebook | page | search | tag | day | calendar | trash |
settings` and nothing that creates.

Phase 05's number-one application for this app is "make capture beat Apple Notes or don't
bother," on the grounds that it is the single most predictive survivor trait in the corpus, with
a stated threshold: **if capture-to-stored latency exceeds about one second, redesign the capture
path before anything else.** Phase 01 says the same thing in stronger language — a capture path
slower than the incumbent is "a red-alert defect, not a polish item."

Be honest about the evidence underneath that. Phase 02 concedes there is *no credible
measurement* of how fast an uncaptured thought decays, and grades the capture-speed case as
craft consensus rather than a behavioural law. The real mechanism is narrower and better
supported: **when capture is costly, people rationally decline to do it.** That is a claim about
the decision to open the app at all, not about milliseconds once you are inside it.

**Build:** `/new` and `/new/:notebook` — create a page, focus the editor, replace the history
entry so back doesn't strand an empty page.

**Then test the entry points, in this order, and write down what happens.**

- **Mac.** Bind it in the palette (§3.4). Trivial once `/new` exists.
- **iPhone / iPad.** A Shortcut on the Action Button or in Control Centre that opens the `/new`
  URL. **Caveat that has to be stated rather than assumed:** iOS does not support the web
  manifest's `shortcuts` array, and whether a URL opened from the Shortcuts app lands in the
  installed standalone app or bounces to Safari depends on scope handling and needs testing on
  the actual phone. This is an afternoon of testing, and the answer is genuinely unknown until
  it is run.

That test is also, incidentally, the measurement that would settle the native question — but it
is worth doing for its own sake regardless of what it settles.

**Size: small for the route, an afternoon for the testing.**

### 3.4 A command palette over local state

Phase 05 calls the command palette "the highest-leverage single mechanism in the corpus" — the
corpus being twenty-odd shipped tools, most of them keyboard-first and desktop-first, which is
worth holding against the fact that two of your three devices have no keyboard. It arrives from
five directions at once: Linear, Superhuman, Raycast, Things' Magic Plus and
Drafts' action menu all converge on one keystroke, fuzzy search over local state, act, done.

It fits the settled decisions unusually well. Decision 17 keeps the toolbar at five marks at
rest; a palette is *how* you keep it at five while still reaching everything. Decision 12 wants
nothing on screen but tools and text while the keyboard is up; a palette makes the tools
reachable without being visible. And the index it needs already exists — MiniSearch over
`titleOf` plus the page text.

Scope it to the desk and to an iPad with a keyboard. The phone doesn't get it and doesn't need
it; there is no keystroke there.

What it should reach: jump to a page, jump to a day or month, switch notebook, toggle stock and
pen, new page, append to today, export, and search. Verbs, in the interface's own register —
labels, not sentences.

**Grade it honestly:** platform convention, not empirical. And Phase 04 is specific that the
usual justification is bad — the "Hick's Law says fewer menu items" argument is named as one of
the most stretched laws in UX and does not apply. The real argument is the one Phase 04 makes
on health grounds: keyboard-first reduces mouse travel and repetitive precision pointing, which
is an ergonomic choice as much as a speed one.

**Size: medium.**

### 3.5 Drag a new page onto a day

Things' Magic Plus, translated into this app's vocabulary. Most of what Magic Plus does is *filing across
types*, which decision 1 abolished. Two filing decisions remain — the notebook, which decision 19
already sites correctly by putting the new-page button at the foot of the list it will join, and
`entryDate`, which has no gesture at all. A "new page" control dragged onto a day in the month
grid, creating the page dated to that day, is the whole mechanism with nothing added.

It respects decision 14 — the calendar stays a lens. The drop sets an attribute; the page still
lives in its notebook and is only *looked at* by date. And it turns the masthead from something you
read into something you can act on, which is the one thing the month grid currently can't do.

**Flag against decision 19.** The month grid is in the rail, and decision 19 says the rail's foot is
Trash and Settings "and nothing else." The way this fits rather than breaks it is for the drag
*source* to stay where decision 19 put it — the new-page control at the foot of the list — and the
rail's month grid to be only a drop target. If that reads as the rail growing a creation
affordance anyway, this one should be dropped rather than argued.

*(Craft consensus. Small-to-medium, high delight, low risk.)*

### 3.6 Local backlinks

Phase 02 and Phase 05 both endorse the backlink and both explicitly reject the graph. Phase 02
is precise about the split: "the value is in local backlinks (what points here), not the global
graph… most links are never traversed," and the graph view is "largely decorative." Phase 05's
"what to leave" for Obsidian is "treating the graph as a feature rather than an ornament."

A `[[title]]` token, hidden and atomic like every other marker, resolving on click, with a
"linked from" list in the page foot beside the tags.

**This is a sixth private convention** and belongs in §5's inventory, not outside it. `[[…]]` is not
CommonMark; it degrades to visible brackets around readable text, which is the mild end of the
scale — but it is the same class of decision as `{center}` and should be made in the same breath.

**The honest cost, and it is a real one:** a link is a decision made at capture time, and
removing capture-time decisions is the thing Phase 02 argues for hardest. So it must never be
required, never prompted, and never suggested. Build it as something available to a page being
*revisited*, not to a page being written.

*(Craft consensus. Medium. Genuinely optional — it is the one item here I would be comfortable
seeing dropped.)*

### 3.7 Natural-language entry dates

"last Tuesday" instead of a grid. Phase 02 grades natural-language parsing as convention that
"genuinely reduces friction when it works, with a nonzero silent-error rate."

**One non-negotiable rule if it gets built: show the parse.** The named failure is Todoist
highlighting "monthly" in *Create monthly report* and making you un-highlight it. A visible,
reversible token, never a silent commit.

*(Small. Low priority — `entryDate` is optional and rare.)*

### 3.8 Version history, via append-only mirror rows

The app has undo and it does not have history, and Phase 03 is emphatic that these are two
different safety systems: "undo protects against the mistake you just made; version history
protects against the mistake you made last Tuesday and only noticed today."

The exposure is specific. Decision 20's conflict copy protects the *concurrent* case
beautifully. But Phase 03 also points out that the concurrent case is the rare one — the common
case is sequential, where there is no conflict to detect and last-write-wins simply overwrites,
correctly and by design. A page cleared on the phone, saved, and synced converges on three
devices and the mirror. Undo saves you within the session. Nothing saves you on Tuesday. And
decision 21 — tombstones on the mirror kept forever — is right for sync correctness and means a
mistaken deletion is architecturally designed to be permanent.

**The cheap version — cheap in dependencies, not in blast radius.** Phase 03 names the substrate:
append-only logs. Insert a row per write rather than updating in place, keyed `(id, version)`;
current state is `max(version)`. No new service, no new dependency, and the editor is genuinely
untouched. But be clear about what it *does* touch: `schema.sql:68` declares `primary key (vault,
id)` on `pages`, so this is a primary-key migration on the mirror, a change to the cursor pull, and
a change to `reconcile.ts` — whose entire truth table assumes one row per id, and which is the one
pure function `npm run check` proves without a server. That reconciler is the most load-bearing
forty lines in the app. This is the item on the list most deserving of being done slowly.

What it buys: the mirror stops being four copies of one state and becomes a genuine second,
versioned copy.

*(Craft consensus. Nielsen's reversibility heuristic and Norman's are design heuristics, not
controlled experiments, and Phase 03 files them there deliberately. There is no counter-argument
on the other side. Medium.)*

---

## 4. User-friendliness — the measurable ones

These are not preferences. Every number below was computed from the actual token values in
`src/styles/tokens.css`.

### 4.1 The writing is under-sized on the laptop, and the dial that fixes it is pointed elsewhere

ISO 9241-303 and ANSI/HFES 100 specify legible type as **cap height in arcminutes at the eye**:
minimum 16, recommended 20–22. Phase 04's instruction is to aim at the upper band at each
viewing distance, not the minimum.

At Spectral 17px (assuming a cap height around 0.66em and default OS scaling):

| | distance | arcmin | |
|---|---|---|---|
| iPhone | ~320 mm | **≈20** | centre of the recommended band |
| iPad | ~450 mm | **≈16.5** | at the floor, not the recommendation |
| MacBook | ~550 mm | **≈14** | **below the ISO minimum** |

**Two things I had wrong before checking, and they change the recommendation.** The zoom is
*already* per-device — it lives in the `Settings` object in `localStorage` under
`field-notes.settings`, nothing syncs it, and the mirror has no settings row (`settings.ts:24`,
`schema.sql`). And decision 6's control is explicitly not for this. `settings.ts:20–23` says so in
as many words: *"Not a browser zoom and not a preference about eyesight — it is for standing a page
on a big screen in front of a room."*

So the mechanism is shipped and the only thing missing is what it opens at. But taking the laptop
from 100% to a standing 150% converts a presentation control into a permanent reading-size
preference, which is a change to what decision 6's dial *is for*. **Flagging that rather than doing
it quietly**, because the arithmetic that makes the steps quarters — 28 × {1, 1.25, 1.5, 1.75, 2}
= 28, 35, 42, 49, 56, and the dot grid never drifts — was built for the room, not for the eye.

Two honest ways to take it, and the choice is yours:

- **Overload the dial.** Set the default zoom by device class on first run — 1.5 on a desk, 1.25 on
  a tablet, 1 on a phone — and amend decision 6 to say the control now does both jobs. Cheapest,
  and it costs the decision its clean single purpose.
- **Leave the dial alone and move the base.** Make `--text-base` itself device-class-aware at the
  three widths the app already knows about, keeping every block a multiple of the *scaled* 28. More
  work, keeps decision 6 intact, and is arguably the more honest fix since this is a typography
  default and not a zoom.

**Caveat on my numbers:** the arcminute figures depend on Spectral's actual cap height and on
viewing distances I assumed rather than measured. The direction — the phone is right, the laptop is
under-sized — holds across any reasonable range. The exact step is worth setting by eye.

*(Specification-grade, reinforced by the presbyopia gerontology Phase 04 calls "real gerontology,
not speculation." Small either way. This is the biggest everyday-comfort change available.)*

### 4.2 `--text-quiet` on paper stock is 2.27:1

`[data-stock='paper']` sets `--text-quiet: var(--cream-500)` — `#a6a39c` on `#f6f3ec`. That
computes to **2.27:1**, below WCAG AA for body text (4.5:1) and below even the 3:1 large-text
floor. It is used in seven places in `leaf.css`, the page foot among them — word count, edited
time, tags.

The cause is straightforward: `cream-500` was chosen as a *frame* quiet colour, where it sits on
teal and works. On cream paper it nearly vanishes. Night stock is fine — `teal-300` on
`teal-900` is comfortable.

A paper-specific quiet token fixes it:

| candidate | contrast |
|---|---|
| `#8c8880` | 3.19:1 |
| `#7e7a72` | 3.86:1 |
| **`#6f6c66`** | **4.72:1** |
| `#605d58` | 5.91:1 |

`#6f6c66` clears AA and still reads as quiet. Smallest change in this document, and the one most
likely to be noticed at six in the morning.

### 4.3 The highlighters do not separate

Five colours, and colour is the entire meaning. Composited as the tokens actually specify —
`multiply` at α .20–.26 over `#f6f3ec` on paper, `screen` over `#051b1c` on night:

**Paper.** The page itself is OKLCH C 0.0098.

| mark | composite | chroma | ink contrast |
|---|---|---|---|
| oxblood | `#d5c4c4` | 0.019 | 9.0:1 |
| forest | `#c8cdc7` | 0.010 | 9.3:1 |
| navy | `#c6cac9` | **0.004** | 9.1:1 |
| driftwood | `#d0ccc5` | 0.010 | 9.4:1 |
| brass | `#d5ccaf` | 0.040 | 9.4:1 |

Navy composites *less chromatic than the paper it sits on*. Forest and driftwood match the paper
exactly. Lightness across all five spans 0.012, which is correct — none of them shouts — but
with no chroma to separate them they read as five slightly different greys. Driftwood (hue 84)
and brass (hue 94) additionally sit within ten degrees of the paper's own hue of 87.

**Night is wrong in a more concrete way.** Screening a light tint over a teal ground drags every
hue toward the ground's own:

- oxblood → `#2f3137`, **hue 275**. The red highlighter renders blue-purple.
- brass → `#384433`, **hue 137**. The gold highlighter renders green.

That is not a matter of taste. On night stock the mark named oxblood is not oxblood.

**The failure this causes is the one Phase 04 names:** hue guidance is coarse and categorical,
and at these chromas there is no guiding channel at all. You cannot find the green one by
pop-out; you have to read every mark. Treisman & Gelade's single-feature pop-out runs at 1–3 ms
per item and a conjunction search at **28.7 ms per item** — which is the arithmetic behind "one
amber element per view," a rule this app holds everywhere except here.

**The fix is Phase 04's own recipe, with one correction: solve for the composite, not the
tint.** Fix lightness and chroma, vary only hue, and derive the tint backwards through the blend
mode. At L 0.845 / C 0.055 on paper and L 0.340 / C 0.055 on night:

| | paper composite | night composite | ink |
|---|---|---|---|
| rose (H 22) | `#eebfbc` | `#512c2b` | ≈9.2:1 |
| brass (H 95) | `#d7cca4` | `#413713` | ≈9.4:1 |
| forest (H 150) | `#b4d7ba` | `#224028` | ≈9.2:1 |
| navy (H 248) | `#b1d0ef` | `#1f3a53` | ≈9.4:1 |
| plum (H 320) | `#ddc1e3` | `#452e4a` | ≈9.2:1 |

Five separable hues, identical perceived lightness so none of them shouts, ink above AAA on both
stocks. C 0.055 is a confident lift; C 0.035 is the conservative version and still four times
the current worst case. That is a dial to set by eye — the principle is that all five sit on the
same one.

**Keep the names.** They are written into the markdown and cannot change once there is content.
Keep the pigment craft too — the layered angled gradients, the uneven radii, the hand-drawn
edge. Only the values move.

**The window closes with content.** The open item already says "decide before there's a lot of
content"; that was written about the syntax and it applies at least as much to the values.

*(Afternoon's work.)*

### 4.4 The notebook dots don't separate — but the fix is one number

The six covers are `COVER_COLORS` in `model.ts:61` — navy `#082744`, driftwood `#3a342e`, oxblood
`#530a28`, forest `#123737`, spruce `#24332a`, pine `#1b261f`. (Brass is a highlighter, not a
cover. I had it in this table on the first pass and it was the only row that looked healthy.)

They render as a 9px dot in three places, and the one that matters is the rail's notebook list,
where all six sit under each other against `--frame-card` `#051b1c`:

| cover | vs the rail | vs the list head |
|---|---|---|
| navy | **1.17:1** | 1.01:1 |
| pine | **1.14:1** | 1.04:1 |
| oxblood | 1.22:1 | 1.03:1 |
| spruce | 1.34:1 | 1.13:1 |
| forest | 1.38:1 | 1.17:1 |
| driftwood | 1.45:1 | 1.23:1 |

Pairwise against each other: **1.03:1 to 1.27:1**. WCAG 1.4.11 asks 3:1 of a UI component that
carries meaning. As fills, these are mud, and at 9px they were never going to be anything else.

**Two things already save it, and both were in the design before the research asked.** The dot is
always immediately followed by the notebook's name — `Rail.tsx:86–87`, `PageList.tsx:120–121` — and
Phase 04 names *label* as a qualifying second channel, twice. And `visual-system.md` prescribed the
cream hairline, which ships: `frame.css:322`, `border: 1px solid rgba(246, 243, 236, 0.3)`.

**So the recommendation is one value, not a redesign.** At the shipped 0.30 alpha the hairline
clears 3:1 against the rail on four of six covers and falls short on oxblood (2.80) and pine
(2.90). At **0.34** all six clear it — worst case 3.17:1. One number, and the dot goes from
decorative to load-bearing.

| hairline alpha | worst cover, vs rail |
|---|---|
| 0.30 *(shipped)* | 2.80:1 |
| **0.34** | **3.17:1** |
| 0.38 | 3.57:1 |

Worth an assertion in `npm run check` so a future chip can't ship as a bare fill — the hairline is
now the channel, not the trim.

*(The colour-vision argument doesn't apply and is worth keeping anyway: red-green CVD affects up to
8% of males, a coin-flip already resolved for you. Phase 04's point is that the habit is what you
build correctly, not the gamble.)*

### 4.5 Self-host the fonts

`index.html` lines 17–20 load Playfair Display, Spectral, Archivo, Oswald, Courier Prime, Grape
Nuts and Caveat from `fonts.googleapis.com`.

An app whose editor "has zero awareness a network exists" currently gets its *type* from a CDN.
First paint on a fresh device with no network falls back to Georgia and Arial — and the feel of
this app is almost entirely type. Phase 04: "do not load fonts from a CDN in a tool you want to
still work in ten years."

Vendor the woff2 files, `@font-face` them locally, drop the two preconnects. Half of this is
already the policy — `--font-pen` names a locally *installed* Linotype Feltpen before its
fallbacks. It removes the last runtime third party besides the weather and the mirror, and both
of those are named leaf modules that fail to nothing.

*(Hours. The cheapest durability win in the whole review.)*

### 4.6 Tap targets

`frame.css` carries controls at `min-width: 30px` and `34px`. The platform floor is 44 (Apple)
to 48 (Material).

Phase 04 spends most of Part A arguing that the large-target default is an accommodation a
solo pointer-and-keyboard user doesn't need — and that argument is explicitly premised on
pointer and keyboard, which describes one of three devices. On the iPhone and the iPad, the
finger is the input.

Material's own technique resolves it without touching the design: **expand the hit area with
transparent padding, not the visual size.** The 28px rhythm survives, the target is legal, and
the marks in the leaf's top margin — where hit areas get squeezed hardest — stop being a
guess. Set it as a token so it can be asserted.

*(Convention. Small.)*

### 4.7 Quote every scalar in the export frontmatter

`export.ts` writes `notebook: ${notebookForPage(page.notebook).name}` bare, and notebooks are
user-editable data.

A notebook named `No`, `On`, `Off` or `Null` parses as a boolean or a null in any YAML 1.1
reader, PyYAML included — Phase 03 cites the documented breakage in Matrix Synapse and
OpenStreetMap Nominatim. Version-shaped titles ending `.0` become floats.

Quote every scalar unconditionally, including the dates. Fifteen minutes, and it becomes
load-bearing the moment the importer exists — an unquoted value that changed type on the way out
is a silent corruption that a round-trip test would catch and a human never would.

---

## 5. Three decisions that are yours

Not recommendations. Each of these is a choice the research can inform and cannot make.

**The private syntax.** `=={forest}`, `{center}`, `{right}`, `{table 70}`, the `<` merge cell,
and two-space nested ordered lists — plus `[[title]]` if §3.6 gets built, which is why §3.6 says
to decide it here rather than separately. Phase 05 names this exact pattern in its anti-pattern
catalogue — "plugin/proprietary syntax embedded in your data… the convenience now is a lock-in
later" — and notes that Obsidian "both embodies and violates the creed depending on how many
plugins you adopt." The open item already says decide before there's content.

What matters is not whether to keep them — most of them have no alternative — but **how each one
degrades.** `=={forest}word==` degrading to visible markup is survivable. A `{table 70}` line
that corrupts a table's parse is not. Two-space nested ordinals silently flatten to siblings,
which is a loss of structure rather than a cosmetic one. One pass through an export, read in
another editor, settles all of it. And a short key block in the frontmatter naming the
conventions turns a private dialect into a documented one for a few lines of cost.

**The name.** Phase 05's Reeder case-file is the argument for deciding it sooner rather than
later: renaming a habit-forming tool is itself a trust event, and "no amount of 'it's better
now' recovers the user for whom the old cue was the value." At n=1 that user is you. The
manifest placeholder is fine while nothing has attached to it; it stops being fine once
something has.

**The native question.** Decision 9 is marked provisional and due for revisit after sync, which is
now. Three phases put pressure on it and all three do it through capture.

**That is a re-ranking and it should be said out loud.** `CLAUDE.md`'s own open item calls the iOS
keyboard accessory bar "the strongest concrete argument for the native path." The research
disagrees — five phases, and not one of them mentions a keyboard accessory bar, while capture is
Phase 05's number-one application and Phase 01's red-alert threshold. I think the research is right
and the brief should be amended, but that is an argument to have rather than a change to slip in.

Phase 05 also argues the other way, hard: "rewriting instead of maintaining" is its own
anti-pattern, and "at n=1 the rewrite is usually the collector's fallacy in disguise."

The way out of a taste fight is §3.3's measurement. Build `/new`, test the iOS entry paths, time it
against Apple Notes on the same phone, write the number down. **The number is a benchmark, not a
verdict** — Phase 05's one second is the point at which it says to redesign the capture path, not a
measured threshold at which an app dies, and Phase 02 is explicit that no such threshold has ever
been measured. What the number does is turn "does native feel better" into "is Field Notes slower
than the incumbent on the axis the incumbent is strongest on," which is a question with an answer.

---

## 6. What not to build

Straight from the anti-pattern catalogues, and worth keeping where it can be re-read.

- **No graph view.** Backlink list yes, graph never. Phase 02 and Phase 05 agree it is decorative
  and that most links are never traversed.
- **No counts, badges, or "N to review"** — including on resurfacing. The app has none anywhere
  today and Reeder's removal of the unread-count obligation is named as a genuinely calming
  move. Don't add the first one.
- **Never read the calendar rings as a streak.** Never count them, never show a streak length,
  never colour a gap differently, never surface "you missed four days." SDT's over-justification
  effect: turning voluntary use into a scored obligation can undermine the intrinsic motivation
  that was carrying it. The ring is a record, and a record is how you re-enter after a gap. The
  line between a ledger and a scoreboard is one label.
- **No due dates, defer dates, or someday.** Decision 1. Phase 03 is unusually clear that this
  needs no defence — "no controlled evidence on the right task/calendar unification model at
  n=1; it's all craft and product opinion."
- **No second organizing layer.** No saved searches, no smart notebooks, no tag hierarchies, no
  nesting. Whittaker 2011's finding is that elaborate filing does not improve retrieval success,
  and every organizing affordance is an invitation to groom. Three already coexist — notebooks,
  tags, pinning. Don't add a fourth.
- **No hard cap.** Tot's seven-note limit is a real mechanism and it does not transfer to a
  journal. Resurfacing is the substitute.
- **Don't import a methodology with the commonplace book.** PARA, Zettelkasten and BASB are
  graded across two phases as practitioner frameworks, not tested interventions — "useful but
  unproven; adopt for personal fit, never cite as evidence." Import the quotes as pages.

**And four claims not to make, even in a commit message.** Phase 04 grades each of them down and
this project's standing commitment is to not launder folk wisdom as science:

- Hick's Law does not justify the command palette.
- The aesthetic-usability effect will not keep this app. Tuch et al. 2012 found that after use,
  poor usability *lowered* aesthetic ratings — "what is beautiful is usable" reversed. You ran
  that experiment at n=7 already: the best-looking one died of session logouts and the plainest
  one survived.
- Doherty's 400ms is not a law; it is routinely overstated.
- Skeleton screens do not feel 20–30% faster. That figure traces to a marketing claim, and a
  controlled 2017 study found skeletons performed *worst* of skeleton, spinner and blank. The
  app's existing rule — render nothing until there's something — is the better-evidenced one.

---

## 7. Sequencing

Not a schedule. An order, with the reasoning attached.

**First, because they are cheap and they are wrong today.** The paper quiet token (4.2), quoted
YAML (4.7), self-hosted fonts (4.5), and the hairline alpha (4.4). Four changes, three of them one
value each, none architectural — all things you would rather have fixed before writing a month of
pages on top of them.

**Second, because the window closes with content.** The highlighter values (4.3). Colour *names*
are written into the markdown and can never change; the values are not, and they are the half still
free to move. This is the only item on the list with a deadline that isn't yours to set.

**Third, whenever you want to have the argument.** The reading size (4.1). It is a small change and
a real decision — whether decision 6's dial does two jobs or the base size becomes
device-class-aware. Nothing downstream waits on it, and you will feel it every day it isn't done.

**Fourth, because it closes four holes at once.** The importer (§2), with the id in the
frontmatter and the round-trip test in `check`. This is the piece of work that makes "markdown
is the storage format" true in both directions and makes the monthly export a backup rather
than an archive nobody can open.

**Fifth, the capture path.** `/new`, then the iOS entry-point testing (3.3), then append-to-today
(3.2). Small, and it is the axis every phase says decides whether a notes app survives.

**Sixth, resurfacing** (3.1) — and the commonplace book import immediately after it, never
before. Phase 02's argument is sharp: 137 items of other people's words with no episodic hook
attached to any of them are a graveyard in a system that cannot hand them back, and the best
possible fuel in one that can.

**Then, as they earn it:** the command palette (3.4), drag-to-day (3.5), append-only history
(3.8), and — genuinely optional — backlinks (3.6) and natural-language dates (3.7).

**Where the month goes is yours.** Every one of the five phases lands on the same instruction and
it is already in `CLAUDE.md`: the next move is not a feature. Phase 01 puts it as a rule — no
feature work until the tool has been used, unimproved, for a fixed period — and adds one thing
worth taking whenever the month happens: **name the cue first.** Wood, Quinn & Kashy (2002) found
roughly 43% of everyday actions are enacted habitually while thinking about something else; the
place does the remembering. A month of deliberate daily use driven by the intention to test the
app measures enthusiasm, which is real and temporary. A month welded to something that already
happens without a decision — the first coffee, sitting down at the desk, closing the laptop —
measures the thing you actually want to know. *(Phase 01 is honest that transferring habit
science from fruit-eating to opening an app is plausible extrapolation and not tested fact. It
costs one decision and no code.)*

---

## 8. The through-line

Seven apps, and none of them died of missing features. That sentence opens `CLAUDE.md` and it
survives the whole research library intact — five phases, and not one of them found a feature
whose absence explains an abandonment.

What they found instead is that the things which decide it are capture, trust, and return.
Capture is where this app is structurally handicapped, and §3.3 replaces an
argument about it with a measurement — not a threshold, but a comparison against the thing it has
to beat. Trust is where §2 found the one real hole — an export that runs one way
is a promise, not a property. Return is what §3.1 is for, and it is the only operation of the
three that this app currently does not perform at all.

Everything else on this list is comfort, and comfort is not nothing — 4.2 and 4.1 are the two
you would feel every day. But the order above is the order it is because those three are the
ones the evidence says decide whether there is a day two hundred.

---

---

## 9. Four requested features

*These came from Joshua, not from the research. They are graded the same way anyway, and two of
them turn out to be partly built already.*

### 9.1 Swipe a row to reveal delete

Straightforward, and three specifics decide whether it feels right.

**Right-to-left only.** A drag that starts at the left edge is Safari's interactive back gesture,
and it survives into an installed PWA. A delete that competes with it will fire by accident, which
is the worst possible failure for a destructive control. Reveal on the right, drag leftward — which
is also the platform convention, so it costs nothing to obey.

**No confirmation.** Delete already tombstones for thirty days and Trash sits at the rail's foot, so
the act is already reversible and a dialog would be protecting nothing. Phase 01 is direct about
this: at n=1, "undo, versioning, and backups protect you from the one hostile user who exists —
future-you at 2 a.m.," and confirmation machinery exists to protect software from strangers. What it
*does* need is for the row to say where the page went — a brief `Moved to Trash · Undo` in the row's
own place, which is the one moment in this app where a transient line earns its keep.

**The row is a `<button>` today.** `PageList.tsx` renders each page as a button, and a swipe
container inside a button fights the tap. It wants to become a `<div>` with the button inside, a
movement threshold of about 10px below which the gesture is still a tap, and `touch-action: pan-y`
so vertical scrolling always wins over a half-committed horizontal drag.

**Desktop gets nothing, and that is fine.** There is no swipe with a mouse, and a hover-revealed
mark on every row adds a permanent affordance to a dense list for a rare action. The page's own `⋯`
menu already covers the desk.

*(Convention. Size: small.)*

### 9.2 Changing a notebook's colour — half of this exists, and the missing half is one function

`notebooks.ts` exports `addNotebook(name, color)`, `renameNotebook(id, name)` and
`deleteNotebook(id)`. There is no `recolorNotebook`. So a notebook's colour is chosen once, at
creation, and can never be changed afterwards. That is the gap, and it is four lines in the shape
of `renameNotebook` — put the row, re-sort the cache, call `changed()`. Notebooks already carry
`updated`, so it crosses the wire on the next sync with no schema change and no reconciler change.

**Keep the swatches to `COVER_COLORS`.** A free colour picker would let a notebook be any hex, and
§4.4 is the reason not to: most arbitrary dark colours vanish against the rail exactly as these six
nearly do, and the palette discipline is what makes the whole app read as one object. If six isn't
enough, the honest move is to add a seventh and eighth *chosen* value to the constant — not to open
a wheel.

*(Size: one function.)*

### 9.3 The notebook's colour in the list head — it is already there and you cannot see it

`PageList.tsx:120` already renders the dot beside the notebook's name in the list head:

```
<span className="book-dot" style={{ background: book.color }} />
<span className="list-title">{book.name}</span>
```

So the feature is built. The reason it doesn't register as an identifier is §4.4, from the other
end: the list head sits on `--frame-bg`, and navy against `--frame-bg` computes to **1.01:1** —
the single worst pairing in the app. It is, almost exactly, invisible. Your instinct that the
identifier isn't doing its job found a measured defect from the outside.

Three ways to make it read, cheapest first:

1. **The hairline fix from §4.4** — 0.30 to 0.34. Makes the dot *visible*. It is still a 9px dot.
2. **A colour rule under the head.** A 2px full-width band in the notebook's colour along the bottom
   edge of the list head, where a border already is. It reads from across the room, costs no height
   that isn't already spent, and because it is a band rather than a 9px dot the contrast stops being
   marginal — a wide block of colour is identified by hue at a glance in a way a dot never is.
3. Both.

I would do 2 for the head and keep 1 for the rail, where the six dots sit together and have to be
told apart from each other rather than merely noticed.

*(Size: one rule and one token.)*

### 9.4 Weather symbols — this overturns decision 22, and it is worth doing deliberately

Decision 22, verbatim: *"No icon and no emoji; every mark in this app is a typed character and a
little coloured cloud would be the only picture in it."*

It is your app and your decision to reverse. But reverse it knowing what it was protecting, because
that part is real: the chrome of this app is made entirely of typed characters — `☰`, `‹`, `⋯`, a
brass dot — and a colour weather icon would be the only *picture* in it. It would look like it came
from somewhere else, which is the specific thing the rule was written against.

**The version that gives you the glyph without that cost:** draw the conditions as monochrome line
marks in `currentColor`, sized to the cap height of the Courier metadata line, in the same hand the
app already draws its table rules and its felt-pen underline. Inline SVG in the repo — one path
each. Not emoji, not a colour icon set, and specifically not an icon font like Weather Icons, which
would be a CDN dependency in the same week §4.5 argues the type off the CDN.

Seven marks cover the whole WMO code table Open-Meteo returns:

| Codes | Condition | Mark |
|---|---|---|
| 0 | clear | sun — a circle and rays |
| 1–2 | mainly / partly clear | sun behind a cloud |
| 3 | overcast | cloud |
| 45, 48 | fog | cloud over three short horizontal strokes |
| 51–57, 61–67, 80–82 | drizzle, rain, showers | cloud with strokes falling |
| 71–77, 85–86 | snow | cloud with three dots, or one six-point flake |
| 95–99 | thunderstorm | cloud with a bolt |

**On the line itself,** you asked for the symbol plus a plain Fahrenheit number, dropping the word
and the range. Three things to hold while doing it:

- **The Fahrenheit half already exists.** `open-meteo.ts:56` sets `temperature_unit=fahrenheit`
  when the unit is `F`, the unit is a real setting kept at `field-notes.weather.unit`, and
  `degrees()` renders it. Nothing to build — just confirm yours is set to F. One thing to decide
  while you are there: you asked for "the numerical value," and `degrees()` currently draws the
  degree sign. `78` or `78°` is a real choice, and with a symbol beside it I would drop the sign.
- **What actually changes is one function.** `WeatherLine.tsx` renders
  `degrees(temp)` + `conditionWord(code)` + the range. Swap `conditionWord` for a `conditionMark`
  returning the SVG, drop the word, and drop the range in the docked version the way `compact`
  already drops it in the masthead.
- **Keep the other half of decision 22.** Render nothing at all until there is a reading. A symbol
  slot held open and empty is worse than no symbol — it makes the app look like it is waiting, which
  is the thing nothing here is allowed to do.
- **One colour, and it is the text's.** The moment the sun is amber it becomes a second glowing
  thing in the view, and "one amber element per view" is the rule §4.3 spends a page defending.

*(Size: small — seven paths and a lookup. It amends a settled decision, so amend it in `CLAUDE.md`
rather than leaving the file disagreeing with the app.)*

### 9.5 Free-moving pictures with text wrap — I had this wrong, and the truth is better

**Correction first.** In the version of this section published before the bridge came back, I said
the picture was drawn as a block widget that needed to become an inline float. That was wrong, and
I inferred it from `CLAUDE.md`'s prose rather than from the code. The facts:

- `block: true` appears exactly once in `src/editor/`, at `table.ts:898`. The table is a block
  widget. The picture is not.
- `PictureWidget.toDOM` builds a **`<span>`** with `class="md-plate md-plate-<placement>"` and sets
  `--plate-width`, delivered as an ordinary `Decoration.replace`.
- `leaf.css:736–749` already floats it: `.md-plate { display: block; width: var(--plate-width, 44%) }`,
  `.md-plate-right { float: right; margin-left: 24px }`, `.md-plate-left { float: left; margin-right: 24px }`.

So the float is already there. Text wrap is not a feature to add — it is a feature that is built and
is not reaching you. There are two reasons, and which one you are hitting depends on the screen.

**Reason one: below 820px, wrapping is switched off on purpose.** `leaf.css:758`:

```
@media (max-width: 819px) {
  .md-plate-left, .md-plate-right { float: none; width: 100%; margin: 6px 0 12px; }
}
```

with the comment *"On a phone a picture takes the measure and the writing runs above and below it —
there isn't room for a column beside it."* **If you are seeing this on the iPhone, that is the whole
story, and it is a decision rather than a bug.** It is also a defensible one: at 44% of a phone
measure the column left for text is roughly twenty characters, which is unreadable. But it is worth
revisiting as a *choice* now that you have asked for the opposite. The middle position: keep
full-width as the phone default, and allow the smaller sizes — 25% and 33% — to keep their float,
where the remaining column is still thirty-five characters or so. A picture that small beside text
works on a phone; a 44% one does not.

**Reason two, on the desk: the line boundary defeats the float.** CodeMirror renders every document
line as its own block element, and the picture's markdown sits on a line of its own. A float inside
that line has no text *in that line* to flow around it, and the paragraph beneath is a different
block that begins below. That is precisely why the picture lands *between* a bullet and its text
rather than inside the item — it is not coming between them, it is a line between them.

**The fix, and it is smaller than what I proposed before.** Anchor the picture to a *text* line
rather than giving it one of its own. Insert `![](images/x.png){right 44}` at the head of the
paragraph or list item it belongs to, and the float finally has writing to wrap.

The reason this works well in markdown specifically: **a markdown paragraph is one document line
that soft-wraps.** A float at the head of a paragraph-line therefore has the entire paragraph
flowing around it — which is the behaviour you are after. And a list item is its own line, so a
float at the head of `- The tent held…` leaves the `-` marker exactly where it belongs and wraps
that item's text around the picture. The bullet and quote problem dissolves, for a reason different
from the one I gave before but with the same result.

**The honest limit, and it is architectural rather than a matter of effort:** the wrap ends where
the line ends. A tall picture beside a short paragraph will have the *next* paragraph begin below
it rather than continue the wrap, because the next paragraph is a different line and therefore a
different block. Escaping that means leaving CodeMirror's line model, which is the engine the whole
no-visible-syntax design rests on. I would take the limit.

**What actually has to change:**

- The insert and the drop currently put the picture on its own line. Both should insert at the
  start of the nearest text line instead.
- `dropmarker.ts` shows where the picture will land as a caret *between* lines. It should instead
  show which line it will anchor to and which side it will take — a rule down the edge of the line,
  not a caret in the gap.
- Nothing in the format changes. Nothing in the CSS changes on the desk. The phone media query is a
  separate decision (reason one).

**Arbitrary x/y — the refusal stands, unchanged.** There is no markdown for a coordinate; it would
be the seventh private convention and the first *layout* one, where every existing one is semantic
and degrades to legible text. It is meaningless across three widths and five zoom steps. And a
picture at an arbitrary y is a picture off the 28px pitch.

**And what "free movement" reduces to is three values the format already carries:** which line,
which side, what width. Drag re-anchors live — the anchor line and the side update under your finger
and the text reflows around it as you move — so it lands where you drop it, and what gets stored is
a sentence. That is how Word and Pages behave, and it is why their documents reflow rather than
shatter.

*(Size: small-to-medium, and smaller than I said. No format change. The phone question is a separate,
one-line decision.)*

### Where these sit in the order

- **§7 step 1**, with the cheap-and-wrong-today batch: the `recolorNotebook` function (9.2) and the
  colour band in the list head (9.3). One function and one rule.
- **§7 step 3 or anywhere**: swipe to delete (9.1) and the weather marks (9.4). Both small, neither
  blocking anything, and 9.4 wants a line changed in `CLAUDE.md` rather than worked around.
- **§7 step 5 or later**: the float-and-wrap picture (9.5). Medium, high effect on the feel, and no
  deadline.

*Strategy before the mark. Voice before the volume. Measure twice, mark once.*
