/* WMO weather codes, which is what Open-Meteo answers in, turned into the two
   things the chrome says about them: a word, and a drawing.

   The word came first and used to be the whole of it. The argument then was
   that every mark in this app is a typed character, that a little coloured
   cloud would be the only picture in the interface, and that `OVERCAST` reads
   at a glance from further away than a 12px glyph does. That decision is
   reversed as of August 2026 — the rail shows a symbol — and the reasoning
   that replaced it is worth having next to the code rather than in a commit
   message:

   The obvious implementation is a typed character, and it does not work. None
   of the vendored subsets — Courier Prime, Oswald, Spectral, latin and
   latin-ext — contains U+2600–26FF (☀ ☁ ☂ ⚡), U+2744 (❄) or U+25CF (●), so a
   weather character would fall back to whatever the operating system has. On
   Apple platforms several of those render as full-colour emoji unless forced
   to text presentation, and the shapes differ per platform regardless. That is
   both the coloured picture the original decision was avoiding *and* a break
   in the reason the type is vendored at all.

   So the drawing is an inline SVG in the app's own hand — see
   `components/WeatherGlyph.tsx`. Hairline strokes, `currentColor`, in the
   bundle, identical everywhere.

   The word does not go away. It becomes the accessible name, so the line does
   not get worse for a screen reader than it was when it was text, and it is
   still what Settings shows.

   Short, because the rail is 264px wide and this sits under a month grid.
   Where the scale has three grades of the same thing, only the ends get an
   adjective — LIGHT RAIN, RAIN, HEAVY RAIN — because "moderate" is a word no
   one has ever needed to read. */

const WORDS: Record<number, string> = {
  0: 'Clear',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Freezing fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Freezing drizzle',
  57: 'Freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Showers',
  81: 'Showers',
  82: 'Heavy showers',
  85: 'Snow showers',
  86: 'Snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm',
  99: 'Thunderstorm',
}

/* Never empty. An unknown code is the forecaster's problem, not something the
   rail should go blank over — and a blank where a word was is more alarming
   than a vague word. */
export function conditionWord(code: number): string {
  return WORDS[code] ?? 'Weather'
}

/* ── the families ──────────────────────────────────────────────────────
   Twenty-seven codes, ten drawings. Intensity stays in the data and in the
   word; it does not become a third variant of the same picture, because the
   difference between light rain and rain at 15px is two pixels of stroke and
   nobody has ever read it.

   Three of these change between day and night — a sun at nine in the evening
   is simply wrong — and the rest are the same drawing whatever the hour. */
export type Family =
  | 'clear'
  | 'mostly-clear'
  | 'partly-cloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'showers'
  | 'thunder'

/* The families that have a sun in them, and therefore a moon after dark. */
const NIGHT_FAMILIES: Family[] = ['clear', 'mostly-clear', 'partly-cloudy']
export const NOCTURNAL: ReadonlySet<Family> = new Set(NIGHT_FAMILIES)

/* Every family there is, so a test can walk them and a drawing can't quietly
   go missing. */
export const FAMILIES: Family[] = [
  'clear',
  'mostly-clear',
  'partly-cloudy',
  'overcast',
  'fog',
  'drizzle',
  'rain',
  'snow',
  'showers',
  'thunder',
]

export function conditionFamily(code: number): Family {
  if (code >= 95) return 'thunder'
  if (code >= 85) return 'snow'
  if (code >= 80) return 'showers'
  if (code >= 71) return 'snow'
  if (code >= 61) return 'rain'
  if (code >= 51) return 'drizzle'
  if (code >= 45) return 'fog'
  if (code >= 3) return 'overcast'
  if (code === 2) return 'partly-cloudy'
  if (code === 1) return 'mostly-clear'
  return 'clear'
}

/* Whether this is the kind of day worth knowing about before you look out of
   the window. It sat unused from the day it was written until the glyphs
   arrived; it is the family map's own sanity check now, which is the honest
   use for it — the two ways of asking the same question have to agree. */
export function isWet(code: number): boolean {
  return code >= 51 && code !== 77
}

/* Rounded, and with the degree on it. A temperature with a decimal in it is a
   measurement; a temperature without one is the weather. */
export function degrees(value: number): string {
  return `${Math.round(value)}°`
}
