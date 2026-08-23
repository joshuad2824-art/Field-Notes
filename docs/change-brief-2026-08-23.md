# Field Notes — three changes
### A brief for the code workspace · 23 August 2026

Three asks, in the order they should be built. Each one is written the same way:
what is wanted, what it collides with in the existing decisions, what has been
decided, and what is still open. Where a settled decision is being reversed,
that is said out loud — this codebase argues for itself in its comments, and a
comment left standing after the code beneath it changed becomes a lie the next
reader has to discover the hard way.

Read `CLAUDE.md` first. Nothing below is meant to override it silently.

---

## 1 · The journal

**What is wanted.** A journal that sits apart from the notebooks. Once a week it
gathers everything written across every notebook and puts it into a single
entry that retells the week — what went on, what was worked on, what was
thought. Journal entries should be findable from the full calendar view
alongside the individual pages.

**What it collides with.**

- *Decision 1 — one page type, permanently.* A journal entry is not allowed to
  be a second kind of thing.
- *Decision 4 — notebooks are data, one level.* "Separate from the notebooks"
  cannot mean a second container hierarchy.
- *`open-meteo.ts`* opens with "the second — and last — file in the app that
  calls `fetch`," and explains at length that Open-Meteo was chosen precisely
  because it needs no key, and that a key in a client build is public anyway,
  "which would have meant a server, for weather." A written summary needs a
  model. A model needs a key. That sentence is about to stop being true.

**Decided.**

**The entry is an ordinary page.** Same envelope, same markdown body, same
`dayOf`. Export, import, sync, search and tags all keep working with no change,
because nothing new has been introduced for them to learn. This is the same
move `captureToday` already made — "no new page type, no new field, nothing
added to the envelope" — and it should be made the same way.

**It lives in a reserved notebook, hidden from the shelf.** A seeded notebook,
id `journal`. Ordinary in the file; separate in the interface. The rail renders
it below the rule with Trash and Settings rather than in the notebook list, and
`NotebookManager` refuses to rename, recolour or delete it.

> **Migration, and it is not optional.** `loadNotebooks()` only seeds
> `DEFAULT_NOTEBOOKS` when the table is empty. Adding a fifth entry to that
> array does nothing on any device that has already run. The journal notebook
> needs an explicit upsert on boot — and it must be seeded at `updated: 0`, for
> the reason already written next to the other four: two devices that each stood
> it up before pairing must meet with nothing to argue about. It also must not
> resurrect after a deliberate delete, which is why it should be exempt from
> deletion rather than protected by cleverness.

**Assembly is mechanical. The prose pass is a separate, optional second step.**

Step one — *Collect the week* — is deterministic, offline, and testable. It
reads `weekOf()` (already in `format.ts`, already Sunday-first, already
matching `WEEKDAY_LETTERS` and the month grid — do not invent a second idea of
a week), gathers every live page whose `dayOf` falls inside it, excludes the
journal notebook itself, and writes one page: the week's range as a heading,
then a section per day that has pages, each page under its own title with its
notebook named, and the week's tags gathered at the foot. Full bodies, not
excerpts — this is raw material for a page that will then be pruned by hand.

Step two — *Write it up* — hands that page to a model and replaces the digest
with prose. It is a button, not a schedule. It is off unless a key has been
pasted into Settings. Until it is pressed, a week with no network still produces
a real entry.

This ordering matters: the feature that ships is the one that cannot fail, and
the model is an enhancement laid on top of it.

**Idempotence.** Collecting the same week twice updates the existing entry
rather than making a second one — keyed on notebook plus `entryDate`. The same
discipline as `once()` in `capture.ts` and "restore twice, get one page" in
`export.ts`.

**`entryDate` is the week's Sunday** — its first day, the day the week is named
by everywhere else in the app — so an entry sits at the head of the week it
covers when the month is read top to bottom.

**Manual, not automatic.** Nothing in this app writes to your pages because a
clock said so. A Settings toggle for automatic Sunday collection can come later,
once the manual path has been lived with.

**In the calendar.** Entries appear in their day group like any other page,
because they *are* pages and `CalendarScreen`'s own comment insists the calendar
is "a lens over the same pages, never a place they live." Above the day groups,
a short strip listing that month's journal entries — the direct answer to
"a place to find those as well as the individual notes."

**Still open.**

- The mark in `MonthGrid`. `daysWritten` marks any day carrying a page; a
  journal entry would put a mark on its Sunday indistinguishable from a page
  written that day. Either a second, quieter mark, or accept the collision.
- Where the model key lives. Recommended: pasted in Settings, held in
  localStorage, per device — which keeps this a static build with no account and
  nothing to be locked out of. A Netlify function would be the project's first
  server-side secret.
- The consent wording on *Write it up*. It is the first time page text leaves
  the device to anyone other than the user's own Supabase. It should say so
  plainly, once, before the first send.
- **Update the `open-meteo.ts` header comment** when the third `fetch` lands.

---

## 2 · Weather as symbols

**What is wanted.** The rail shows a symbol instead of `CLEAR` / `OVERCAST` /
`THUNDERSTORM`.

**What it collides with.** `codes.ts` argues explicitly against this: *"No icons
and no emoji, deliberately. The marks in this app are all typed characters …
and a little coloured cloud would be the only picture in the whole interface …
`OVERCAST` reads at a glance from further away than a 12px glyph does."*

That decision is being reversed. Fine — but the comment must be rewritten, not
left sitting above code that now contradicts it.

**The obvious implementation does not work, and this was checked rather than
assumed.** Every vendored subset — Courier Prime, Oswald and Spectral, latin
and latin-ext — was inspected. None of them contains U+2600–26FF (☀ ☁ ☂ ⚡),
U+2744 (❄), U+25CF (●) or U+2630 (☰). A typed weather character would therefore
fall back to whatever the operating system has. On Apple platforms several of
those codepoints render as full-colour emoji unless forced to text presentation
with U+FE0E, and the shapes differ per platform regardless. That is both the
coloured picture the original decision was avoiding *and* a break in the reason
the fonts are vendored at all: "a fresh device with no network must not open on
Georgia."

*(Footnote, for honesty: the "all marks are typed characters" claim already has
one exception — the `☰` in `Shell.tsx` is not in any vendored subset and is
being drawn by the system today. `‹`, `›` and `×` are all present and genuine.)*

**Decided: a small inline SVG set, drawn in the app's own hand.** Hairline
strokes, `currentColor`, sized to sit with the Courier line. The app already
draws SVG for the table rules and the felt underline, so this is not a new
technique — and it ships in the bundle, renders identically everywhere, and
inherits the existing colour discipline instead of introducing a second palette.

**Spec.**

- Collapse the 27 WMO codes to roughly nine families: clear, mostly clear,
  partly cloudy, overcast, fog, drizzle, rain, snow, showers, thunder. Intensity
  stays in the data, not in a third variant of the same drawing.
- **Keep `conditionWord`.** It becomes the accessible name — `<title>` on the
  SVG, `aria-label` on the wrapper — so the line does not get *worse* for anyone
  using a screen reader, and the word is still available for Settings and hover.
- **Day and night.** A sun at nine in the evening is simply wrong. `forecast()`
  does not request `is_day` today; add it to the `current` list, add `isDay` to
  `Reading`, and give `readReading()` a default so readings already cached in
  localStorage still parse — the file already does exactly this for `high` and
  `low`, so follow that pattern rather than inventing one.
- `isWet()` has been sitting unused since it was written. This is the consumer
  it was waiting for; either use it in the family map or fold it in.
- **Alignment.** `.weather` is `align-items: baseline`, and the `.compact`
  variant's comment says it "sits on the baseline of the date." An inline SVG has
  no text baseline. Both need looking at, at 1× and 2×.
- **Weight.** The line is `rgba(156,177,178,0.7)` — fine for letterforms, thin
  for a 1px stroke on teal-900. The glyph should probably take `--frame-heading`
  the way `.weather-now` does.

**A consequence worth naming:** with the word gone, `.weather-word`'s ellipsis —
"the one part allowed to be cut rather than to push the range off the end" — has
nothing left to protect, and the compact variant no longer has to surrender the
day's range for want of room. The line gets simpler and says more.

---

## 3 · The mark in the rail

**Decided: the puffin portrait is the brand.** The engraved moose-and-puffin
lockup is out entirely — not kept for the icon, not kept for the splash. One
illustrator's hand, everywhere. That is the right call: the failure mode here
was never "which picture" but "two pictures that don't know each other."

**What is there now.** `<img src="/logo-wordmark-reverse.png" alt="Timber & Ink" />`
at `height: 19px`, `opacity: .82`. The asset is 2000×573 — 3.49:1 — so it draws
at 66×19 inside a 232px row, with the fold button shoved to the far side by
`.grow`. That is the whole of "too small and oddly positioned": a small mark
floating in a wide empty row, aligned to nothing below it. It is also the wrong
brand. It goes.

**The one defect in the portrait, and how it is solved.** Measured against the
rail's teal-900, **53% of the portrait's pixels fall under 1.5:1** — the flat
cap and the coat are near-black forest green on a near-black ground, so the
shoulders dissolve and it reads as a floating head. A disc behind it fixes that
but introduces the loudest shape in the interface directly above the date.
**The crop fixes it for free:** cut below the beak and the sinking parts are
simply not in the file. No plate, no disc, no new shape. That is
`mark-puffin.png`.

The bird faces right, into the wordmark. Do not flip it.

**Sizes, measured.** The portrait survives small in a way the engraving never
did — big shapes downsample, fine hatching does not. It is legible at 32px and
readable at 24. **44px in the rail head** gives it room without letting it
compete with the 76px date numeral, which is still the masthead.

**FIELD NOTES is now typed, not drawn.** There is no wordmark artwork any more,
and that is an improvement: Oswald 500 is already vendored, uppercase and
tracked is already the register the app's signage speaks, and the wordmark
becomes real selectable text with no raster to maintain.

### The assets

All in `public/`, all quantised, all replacing a 212 KB file:

| file | size | use |
|---|---|---|
| `mark-puffin.png` | 240×176, 14 KB | the rail head, at 4× a 44px slot |
| `favicon-16/32/48.png` | 1 KB each | browser tab — cropped tighter, to face and beak |
| `apple-touch-icon.png` | 180×180, 7 KB | iOS home screen |
| `icon-192.png` | 8 KB | manifest |
| `icon-512.png` | 35 KB | manifest |
| `icon-512-maskable.png` | 25 KB | manifest, **inset for the platform crop** |

The icons keep the existing teal ground and lantern-glow gradient from
`icon.svg` and set the portrait on it, so the home screen and the rail are
recognisably the same app.

### The code

**`Rail.tsx`** — the mark is decorative once the name is real text beside it, so
it takes an empty alt rather than announcing "Field Notes" twice:

```tsx
<div className="rail-wordmark">
  <img className="rail-mark" src="/mark-puffin.png" alt="" />
  <span className="rail-name"><span>Field</span><span>Notes</span></span>
  <span className="grow" />
  <button className="mark-button tight" onClick={onFold} …>‹</button>
</div>
```

**`frame.css`** — replace the `.rail-wordmark img` rule. Note the `opacity: .82`
is gone; it was tuned for a cream wordmark and would mute a full-colour mark.

```css
.rail-wordmark { padding: 14px 12px 12px 20px; gap: 11px; align-items: center; }
.rail-mark     { display: block; height: 44px; width: auto; }
.rail-name {
  display: flex; flex-direction: column;
  font-family: var(--font-signage);
  font-size: 16px; font-weight: 500; line-height: 1.06;
  letter-spacing: 0.10em; text-transform: uppercase;
  color: var(--cream-100);
}
```

Stacking the two words as separate spans rather than relying on a `max-width` to
force the wrap — a wrap that depends on a measurement is a wrap that breaks the
first time the type scale moves.

**`index.html`** — drop the `icon.svg` link, add the PNG favicons:

```html
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png" />
<link rel="icon" href="/favicon-16.png" sizes="16x16" type="image/png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

**`manifest.webmanifest`** — the current file lists `icon-512.png` twice, once
with `"purpose": "maskable"`. That is wrong today: the platform crops a circle
out of a maskable icon, and the existing art has no safe zone, so it gets
clipped. Point it at the properly inset file:

```json
"icons": [
  { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
  { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
  { "src": "/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
]
```

**`sw.js` — two things here will bite, and both are silent.**

1. `install` calls `cache.addAll(['/', '/manifest.webmanifest', '/icon.svg'])`.
   **`addAll` rejects atomically if any URL 404s.** Delete `icon.svg` without
   editing this line and the service worker never installs — the app loses
   offline capability with no error anyone will see. Change the third entry to
   `/apple-touch-icon.png`, or drop it.
2. PNGs match `/\.(svg|png|webmanifest)$/` and are served **cache-first** from
   the SHELL cache. An old asset at a cached path is served forever. **`VERSION`
   must go to `'v4'`** — which is exactly what the comment above it already
   says to do.

### Delete

Two sets, for two different reasons.

**The old brand — dead the moment the swap lands:**

- `public/logo-wordmark-reverse.png` — the Timber & Ink wordmark, 212 KB, no
  longer referenced once `Rail.tsx` changes.
- `public/icon.svg` — the abstract lantern-and-dots placeholder. **Read the
  `sw.js` note above before removing this one**; the precache list names it, and
  `addAll` rejects atomically.

**The moose detour — working files from an earlier draft of this brief, kept
only long enough to make the decision:**

- `public/mark-moose.png`
- `public/mark-moose-solid.svg`
- `docs/mark-at-size.png`
- `docs/rail-head-options.png`
- `docs/icon-proposed.svg`

Nothing references any of the five. They exist because the engraved lockup was
the plan for about a day, and they should go with it rather than sit in the tree
looking like alternatives someone might still be considering.

**Keep:** `design_handoff_field_notes_home/assets/` has its own copy of the old
wordmark. That folder is a frozen handoff — a record of what the design was at
the time it was handed over — so leave it exactly as it is. Deleting from a
frozen record is how a record stops being one.

### Two decisions to write down, not to discover later

- **The name is settled.** `CLAUDE.md` records it as deliberately undecided.
  It is Field Notes now. Write that into the decision log rather than letting it
  arrive by asset.
- **The one-accent-per-view rule now has an exception.** `frame.css` says the
  rule "is not spent on the weather," and `codes.ts` argues there should be no
  pictures in the interface at all. The mark is a full-colour picture with a
  saturated orange beak (~5.3:1 on teal-900, close enough to brass to compete).
  That is a deliberate change, and it needs one sentence in the tokens or the
  visual-system note saying the mark is exempt — otherwise the next reader finds
  a rule and a contradiction and has to guess which one won.

## Order of work

1. **Weather symbols.** Self-contained, one component and one module, no schema
   and no migration. Rewrite the `codes.ts` comment in the same commit.
2. **The rail head and the icon set.** Assets are cut and in `public/`. One
   pass: swap the mark, retype the wordmark, repoint the manifest and the
   favicons, fix the `sw.js` precache list, bump `VERSION` to v4, delete the two
   dead files, and write the name decision into `CLAUDE.md`.
3. **The journal, step one.** The digest, the reserved notebook and its
   migration, the calendar strip. Largest surface, most tests.
4. **The journal, step two.** The prose pass, the Settings key, the consent
   line, and the correction to the `fetch` comment.

## Before it is called done

- `npm run check` clean.
- The notebook migration exercised against an existing database, not a fresh
  one — a fresh install will pass whether or not the migration works.
- Collect the same week twice; confirm one entry.
- Export a notebook after a journal entry exists and round-trip it back.
- The weather line read at 1× and 2×, in daylight and at night, with a stale
  cached reading written before `isDay` existed.
- **The service worker actually installs after `icon.svg` is deleted.** Check
  Application → Service Workers in devtools, not just that the page loads — a
  failed install looks like nothing at all until the next flight without wifi.
- The maskable icon previewed under a circular crop, not just as a square.
