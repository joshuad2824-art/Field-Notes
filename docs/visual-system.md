# The Notebook App — Visual System Brief

*v0.1. Written against `colors.css` v2.2, `typography.css` v2.1, `surfaces.css` v2.0, `spacing.css`, `base.css`, and Content Fundamentals v2.0. Where those files and this one disagree, those win.*

---

## The finding: the system already contains the app's central idea

`data-stock="paper"` is the whole design, and it was written before we needed it.

The system is night by default — deep teal room, cream type, one lantern — and it already has a scoped daylight mode that turns any subtree into printed matter. It even names the seam: `--surface-paper` is described in the file as *paper set into the dark.*

That is exactly what a notebook on a desk at night is.

**So the app is not light mode or dark mode. It is one scene.** The frame — shelf, app bar, search, settings — is night stock. The page you write on is `data-stock="paper"`, a cream leaf set into that dark room. Both are always visible at once on desktop and tablet. Nothing toggles. The theme *is* the metaphor.

This resolves the biggest open question in the project — how a warm paper notebook lives inside a dark brand — with tokens that already exist and have already been contrast-checked.

**Signature element:** the lit page. A cream leaf carrying `--shadow-lift`, with `--wash-lantern` falling across the top of the surrounding night. Your central metaphor is a lantern in the woods; this is the interface being that, once, quietly, rather than saying it.

---

## The page

Everything here is inherited, not invented.

| Property | Token | Value |
|---|---|---|
| Surface | `--surface-page` under `data-stock="paper"` | `--cream-100` |
| Body text | `--text-body` (paper) | `--teal-800` |
| Reading face | `--font-body` | Spectral |
| Size | `--text-base` | 17px |
| Measure | `--measure-prose` | 64ch |
| Page titles | `--font-editorial` | Playfair Display, `--text-2xl` |
| Rules and dividers | `--rule-accent` (paper) | `--brass-700` |

The blockquote treatment in `base.css` — Playfair, italic, `--border-brass` on the left — is already the right presentation for a commonplace-book quote. No new component needed; a markdown blockquote *is* the quote card.

### The dot grid, and one adjustment worth making

Proposed new token:

```css
[data-stock="paper"] {
  --grid-dot: rgba(20, 42, 43, 0.16);
  --grid-pitch: 28px;
  --page-grid: radial-gradient(circle at 1px 1px, var(--grid-dot) 1px, transparent 0);
}
```

Here's the craft detail that makes it worth doing properly. Body text is 17px at `--leading-relaxed` (1.62), which computes to 27.54px — an awkward number that would put the dots on a drifting offset against every line of type.

**Recommend a page-specific leading of 1.647**, which lands the line box at exactly 28px. Set the grid pitch to 28px and every dot row falls on a text baseline. The difference from 1.62 is invisible as reading rhythm and the difference in the grid is the difference between a texture and a *ruled page*.

```css
--leading-page: 1.647;  /* 17px × 1.647 = 28px exactly */
```

On the night frame the grid does not appear at all. Dots belong to paper.

---

## The frame

Night stock, default tokens, no exceptions.

- **App bar / chrome:** `--surface-chrome` (`--driftwood-800`). This is the sanctioned driftwood role — chrome, never a card. Text on it is `--text-on-chrome`.
- **The shelf and all panels:** `--surface-page` (`--teal-800`) and `--surface-card` (`--teal-900`).
- **Search field and any input in the frame:** `--control-well` (`--teal-950`) with `--control-inset`.
- **UI labels, tabs, buttons:** `--font-ui` (Archivo), sentence case per Content Fundamentals.
- **Metadata — edit times, word counts, sync state, dates:** `--font-mono` (Courier Prime) at `--type-meta-size`, tracked. This is the single best inherited fit in the whole system. `EDITED 3:14 PM · 412 WORDS` in tracked Courier is precisely the field-note register the app wants, and it costs nothing.

---

## The four covers

This is the one place the palette actively resists us, and the resistance is instructive.

The obvious move — four notebooks, four flat colors — is forbidden by the rule in §2b. Teal, spruce, and driftwood sit at the same value; as adjacent flat fills they read as one color that has gone wrong. Four flat covers side by side on a shelf is the exact failure case the rule was written to prevent.

**The legal and better answer: the covers are washes, not fills.** `surfaces.css` sanctions spruce and driftwood *inside a gradient*, where the eye reads them as light rather than as panels. Four washes are genuinely distinguishable where four fills are mud.

| Notebook | Cover | Reading |
|---|---|---|
| Field Notes | `--wash-overcast` | teal into deep spruce — cold morning |
| The Workshop | `--wash-driftwood` | barnwood into dark — the bench |
| The Hearth | `--wash-lantern` over `--teal-900` | the lit one |
| Church *(or its own name)* | `--wash-forest` | spruce into teal — the woods |

Each carries a brass plate: the notebook name in Archivo small caps, `--brass-400` on dark, over `--shadow-plate-brass` — the letterpress offset already in the system. The engraving mark sits blind-embossed on one cover at low opacity, not all four.

**Note the amber constraint.** The Hearth's lantern wash is the lit element on the shelf screen. If it's glowing, nothing else on that screen may. That's the rule doing its job: it tells you which notebook the eye lands on.

---

## The one lit thing, once you're writing

Inside a page, the lantern is **the caret**.

```css
[data-stock="paper"] { --caret: var(--amber-700); }
```

Nothing else on the page glows. Not the save state, not the toolbar, not the active tag. The lit thing in the room is the point where you are writing, which is both literally true and the most restrained possible reading of "one amber element per view."

`--focus-ring` on paper is already `--amber-700`, so keyboard focus and the caret are the same warmth without adding a token.

---

## Two places the brand and the app pull against each other

Worth naming plainly, because both will cause bugs if left implicit.

**1. The brand is slow. The app must be instant.**

`surfaces.css` specifies weighted motion with no bounce — `--duration-base` at 240ms, `--duration-fog` at 900ms. That's right for a shelf turning over and completely wrong between a keystroke and a glyph.

The rule: **nothing between the tap and the text is ever animated.** Opening a page, placing the caret, saving, switching notebooks — `--duration-instant` (90ms) or nothing at all. The brand's slowness lives in the *look* — deep color, wide margin, a serif that takes its time — never in the response. Slow is an aesthetic here, never a latency.

**2. The voice has a first person. This app has no audience.**

Content Fundamentals is emphatic that the voice is "I," never "we," because a "we" makes one person sound like a company. That rule protects a publication with readers. This app has exactly one person in it, and he's the one who wrote the copy — an interface that says *"I'll need a title for this"* to its own author is a small, strange piece of theater.

**Recommend: in this app the interface barely speaks at all.** Labels, not sentences. No first person, no second person, no personality in the chrome. `Export`, `New page`, `Field Notes`, `Nothing here yet.` The warmth is carried entirely by the paper, the type, and the light — which is a higher-confidence way to carry it than copy.

The one exception worth keeping is the empty-state register from the microcopy table: *"Nothing here yet. Plenty of time."* Four words, no first person, and exactly the posture the brand wants.

**And a carry-over from your own open items:** the sign-off is podcast-exclusive. It doesn't go in the app — not on a splash, not in a footer, not as a loading line. Your color-tokens doc already flags it appearing where it shouldn't; let's not add a second place.

---

## New tokens this app needs

Small, and all derived. Nothing invents a color.

```css
[data-stock="paper"] {
  --grid-dot: rgba(20, 42, 43, 0.16);
  --grid-pitch: 28px;
  --page-grid: radial-gradient(circle at 1px 1px, var(--grid-dot) 1px, transparent 0);
  --leading-page: 1.647;
  --caret: var(--amber-700);
}

:root {
  --page-lift: var(--shadow-lift);          /* the leaf on the dark desk */
  --page-margin-x: var(--space-11);         /* 64px — real margin, not padding */
  --page-margin-x-sm: var(--space-6);       /* 20px on phone */
  --sidebar-width: 268px;
  --cover-ratio: 3 / 4;
}
```

Note `--tabbar-height: 62px` and `--header-height: 76px` already exist in `spacing.css`, which suggests the system was already anticipating an app.

---

## Three widths

**Phone.** Page only, full bleed, night chrome reduced to a thin bar. Margins drop to 20px; the measure is whatever the screen gives. The dot grid stays — it's what makes a phone screen read as paper rather than a text field.

**Tablet.** Page centered at 64ch on the night ground, with real dark margin on both sides. This is the scene at its best: a lit leaf on a dark desk. The sidebar is a swipe away, not pinned.

**Desktop.** Sidebar pinned at 268px on `--surface-card`, page centered in the remaining space at 64ch, dark ground visible around it. The measure never widens past 64ch no matter how large the window — the page is a page, not a canvas that stretches.

---

## Palette extension — the five named hues

Five colors named for the app. Two of them are already in the system, which is worth catching before we add near-duplicates.

| Asked for | Value | Status |
|---|---|---|
| Brown | `#3a342e` | **Already `--driftwood-700`.** Exact match. Use the existing token. |
| Yellow | `#7b6200` | **One digit off `--brass-700` (`#7a6201`).** Visually identical. Use brass; a second near-anchor would quietly split the system. |
| Red | `#530a28` | New. Deep oxblood. |
| Green | `#123737` | New. Saturated forest-teal. |
| Blue | `#082744` | New. Deep navy. |

So three genuinely new hues, and they should be scoped as tightly as spruce and driftwood were, or the six-family discipline in `colors.css` stops meaning anything.

```css
:root{
  --oxblood-800:#530a28;
  --forest-800:#123737;
  --navy-800:#082744;
}
```

**The role: these are cover and marker colors, not surfaces.** They never become a page, a card, or body text.

### What they solve

They solve the notebook covers better than the wash approach did. Four gradient washes were the legal answer when the only available families sat at the same value; five distinct hues are simply distinguishable, which is what a shelf needs.

| Notebook | Cover |
|---|---|
| Field Notes | `--navy-800` |
| The Workshop | `--driftwood-700` |
| The Hearth | `--oxblood-800` |
| Church | `--forest-800` |
| *(spare)* | `--brass-700` |

**One caution, and it's the §2b rule again.** `--forest-800` (`#123737`) against the teal page (`#142A2B`) is a low-contrast pairing — not the 1.0 mud of spruce, but close enough that a flat green cover on the teal shelf will read as a smudge rather than an object. Every cover therefore carries a hairline edge in `--cream-100` at low alpha and the brass plate label. The edge is what makes it a *bound object* sitting on the shelf rather than a rectangle painted on it.

### The second use: highlighters

Five hues, five highlighter colors — which is exactly the Apple Notes affordance and a much better fit for the brand than the default neon set. On paper stock they appear as a tint wash behind the text (roughly 14% alpha), never as a solid fill, so the ink stays readable and the page still looks like paper someone marked up.

The amber rule survives this: highlights are pigment, not light. Nothing here glows, so the one-lit-element budget is untouched.

---

## Text formatting

The gap in the plan so far, and correctly caught. Two questions: what the controls are, and how they're reached.

### The reconciliation

Markdown is the storage format, which was decided for export and durability. A formatting bar is what makes formatting *reachable*. These are not in tension — **the bar writes markdown.** Tapping Heading inserts `## `. Selecting a phrase and tapping bold wraps it in asterisks. The person who wants the fast path types the characters; the person on a phone with one thumb taps a button; the file on disk is identical either way.

### The controls, mapped to your type system

| Apple Notes | Ours | Renders as |
|---|---|---|
| Title | `# ` | Playfair, `--text-2xl` |
| Heading | `## ` | Playfair, `--text-xl` |
| Subheading | `### ` | **Archivo small caps**, tracked |
| Body | *(none)* | Spectral 17/1.647 |
| Monostyled | `` ` `` | Courier Prime |
| Bulleted list | `- ` | — |
| Numbered list | `1. ` | — |
| Block quote | `> ` | Playfair italic, brass rule |
| Bold / Italic | `**` / `*` | — |
| Strikethrough | `~~` | — |
| Highlight | `==text==` | five-color tint wash |
| — | `- [ ] ` | checklist |

Two deliberate departures:

**Subheading goes to Archivo small caps rather than a third Playfair size.** Your system already assigns h4/h5 to tracked Archivo uppercase, and it's a genuinely better subheading than shrinking Playfair a third time — it reads as a *label* inside prose, which is what a subheading is. It also breaks up a long page far better than another serif line.

**Underline is dropped.** It has no markdown equivalent, and on a screen an underline means a link. Bold, italic, and the highlighter cover everything underline was doing, and the highlighter does it more like paper.

**Checklists are added**, because Apple Notes has them and quick capture wants them. `- [ ]` is standard markdown and survives export intact.

### Access — the part that actually matters

The complaint about Apple Notes on mobile is that formatting hides behind the `Aa` button. That's a solvable problem and worth solving properly, because it's one of the few places where we can be plainly better than the app you keep returning to.

**Phone: a docked strip above the keyboard.** Always visible while the keyboard is up. No `Aa` gate, no menu to open. Archivo labels, `--surface-chrome` ground, one row, horizontally scrollable:

```
 Title  H  Sub  |  B  I  S  ⌷  |  •  1.  ☑  |  "  #tag
```

The rightmost items are the ones a menu usually buries. Highlighter opens a five-swatch row in place — one tap, not a submenu.

**Desktop: a selection bar plus shortcuts.** The bar appears on text selection near the selection; block styles live in a small `Aa` menu in the chrome. Everything has a keyboard shortcut, which is the real desktop answer — `⌘1/2/3` for the three heading levels, `⌘B/I`, `⌘⇧H` for highlight.

**Tablet: the phone strip when the keyboard is up, the desktop bar when it isn't.**

### Attachments — noted, scoped out of v1

Your second screenshot is the attachment menu: photo, audio, file, scan, sketch. Photo and file were already in the v2 list and stay there. Audio is genuinely interesting for a student minister and is genuinely a large amount of work (recording, storage, sync of binary blobs, playback). Scan and sketch are out — sketch reopens the handwriting canvas we deliberately closed.

Recording this so it's a decision rather than an omission.

---

## The pen — a second hand for the page

A seventh face, scoped narrowly enough that it doesn't break the six-role discipline.

**The framing: choosing a font here is choosing a pen, not changing the theme.** Ink (Spectral) is the default and the reading face. Felt (Linotype Feltpen) is the second hand — for a journal entry, a scribbled list, a page that wants to feel written rather than typeset. It's a **per-page attribute**, stored with the page like `entryDate` or `pinned`, never a global setting. Someone who keeps fountain pens shouldn't have to pick one pen for the whole notebook.

Only the running text changes hand. Metadata stays Courier, code stays Courier, subheadings stay Archivo small caps. The felt page is a page written in a different pen, not a different design system.

**The licensing constraint, which is real.** Linotype Feltpen is a commercial Monotype face by Lutz Baar. A desktop license does not cover embedding it in a web app — that needs a separate webfont license, sold on an annual basis. The many "free download" mirrors are unlicensed copies and aren't an option.

Three honest paths:

1. **Buy the webfont license** and self-host the woff2. Works on every device, no fallbacks, an annual cost.
2. **Install the desktop font locally** on the Mac, iPhone, and iPad (iOS takes fonts via a configuration profile). The app names the font in its stack and it renders wherever it's installed. Legitimate for a single-user app you never distribute, and free if the desktop license is already owned — but it's three installs, and it silently falls back on any device you haven't set up.
3. **Ship a free stand-in.** Caveat is the closest Google face in spirit — a felt-tip hand with a similar slant and informality, though rounder and less angular than Feltpen.

**Recommend path 2 with path 3 underneath**, which is what the spike implements: the stack names Feltpen first and Caveat behind it, so the real face appears wherever it's installed and the page still looks handwritten where it isn't. If the felt page becomes something used daily rather than occasionally, the webfont license is worth buying then.

Size compensation: Feltpen and Caveat both run small against Spectral, so the felt page sets at 21px against 17px. The 28px line box is unchanged, so the dot grid holds.

---

## What Phase 0 has to prove

One screen. No notebooks, no storage, no sync. A cream page with the dot grid, set into the night ground, Spectral at 17/1.647 over 64ch, Playfair title, amber caret, Courier metadata line at the foot. Live markdown rendering.

The only question it answers: *do you want to write in this?*

Everything in this document is reversible except that.
