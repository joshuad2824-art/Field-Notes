/* WMO weather codes, which is what Open-Meteo answers in, turned into the one
   word the chrome is allowed to say.

   No icons and no emoji, deliberately. The marks in this app are all typed
   characters — ☰, ‹, ×, ● — and a little coloured cloud would be the only
   picture in the whole interface. A word in tracked Courier is already the
   register metadata speaks here, and `OVERCAST` reads at a glance from further
   away than a 12px glyph does.

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

/* Whether this is the kind of day worth knowing about before you look out of
   the window. Nothing uses it yet; it is here because the alternative is
   scattering code-number ranges through the components later. */
export function isWet(code: number): boolean {
  return code >= 51 && code !== 77
}

/* Rounded, and with the degree on it. A temperature with a decimal in it is a
   measurement; a temperature without one is the weather. */
export function degrees(value: number): string {
  return `${Math.round(value)}°`
}
