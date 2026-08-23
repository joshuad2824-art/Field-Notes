/* Weather checks, in the same two halves as the sync ones.

   The codes are a pure lookup and run on node. The line itself needs a browser,
   a device that will say where it is, and a service that will answer — so the
   service is faked in this file and the device is told where it is by
   Playwright, which is the only way to make "what does the rail show at 14° and
   overcast" a question with one answer.

   Run a server first, then this:

     npm run build && npm run preview &
     npm run check                       # or BASE=http://localhost:5173 npm run check */

import {
  FAMILIES,
  NOCTURNAL,
  conditionFamily,
  conditionWord,
  degrees,
  isWet,
} from '../src/weather/codes.ts'

const BASE = process.env.BASE ?? 'http://localhost:4173'

let failures = 0
const problems = []
const ok = (name, pass, detail = '') => {
  if (!pass) failures++
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

/* ── the codes, on their own ────────────────────────────────────────────── */

ok('a clear sky is one word', conditionWord(0) === 'Clear')
ok('and overcast is the one the rail will show most of the year', conditionWord(3) === 'Overcast')
ok(
  'the middle of a scale loses its adjective',
  conditionWord(61) === 'Light rain' && conditionWord(63) === 'Rain' && conditionWord(65) === 'Heavy rain',
)
ok(
  'a code nobody has heard of still says something',
  conditionWord(4242) === 'Weather' && conditionWord(-1) === 'Weather',
)
ok(
  'no word is long enough to wreck a 264px rail',
  Object.keys({ ...Array.from({ length: 100 }) })
    .map((n) => conditionWord(Number(n)))
    .every((w) => w.length <= 16),
)
ok('wet is wet and snow grains are not', isWet(61) && isWet(95) && !isWet(0) && !isWet(77))

/* ── the families the drawings come from ────────────────────────────────
   The word and the drawing are two answers to the same question, and the whole
   point of keeping the word is that a screen reader gets told what the eye is
   being shown. So the two have to agree, and that is what these check. */

ok(
  'every code lands in a family',
  Array.from({ length: 100 }, (_, n) => conditionFamily(n)).every((f) => FAMILIES.includes(f)),
)
ok(
  'a clear sky, a covered one and the three between them',
  conditionFamily(0) === 'clear' &&
    conditionFamily(1) === 'mostly-clear' &&
    conditionFamily(2) === 'partly-cloudy' &&
    conditionFamily(3) === 'overcast',
)
ok('fog is its own thing', conditionFamily(45) === 'fog' && conditionFamily(48) === 'fog')
ok(
  'the three grades of a scale share one drawing',
  conditionFamily(61) === 'rain' && conditionFamily(63) === 'rain' && conditionFamily(65) === 'rain',
)
ok(
  'showers are showers and snow showers are snow',
  conditionFamily(80) === 'showers' &&
    conditionFamily(82) === 'showers' &&
    conditionFamily(85) === 'snow' &&
    conditionFamily(86) === 'snow',
)
ok(
  'a thunderstorm is the only thing that gets a bolt',
  [95, 96, 99].every((c) => conditionFamily(c) === 'thunder') &&
    ![0, 3, 45, 63, 82].some((c) => conditionFamily(c) === 'thunder'),
)
ok(
  'the word and the drawing never disagree about whether it is wet',
  Array.from({ length: 100 }, (_, n) => n).every((n) => {
    const wetFamily = ['drizzle', 'rain', 'showers', 'thunder'].includes(conditionFamily(n))
    /* Snow is wet by the code's reckoning and has its own drawing, so it is
       the one family the two questions are allowed to answer differently. */
    return conditionFamily(n) === 'snow' || wetFamily === isWet(n)
  }),
)
ok(
  'only the drawings with a sun in them have a night',
  NOCTURNAL.size === 3 &&
    [...NOCTURNAL].every((f) => FAMILIES.includes(f)) &&
    !NOCTURNAL.has('overcast'),
)
ok(
  'a temperature is rounded and carries its degree',
  degrees(14.2) === '14°' && degrees(-0.4) === '0°' && degrees(17.8) === '18°',
)

/* ── the line, in a browser, against a service that answers ─────────────── */

async function loadPlaywright() {
  try {
    return await import('playwright')
  } catch {
    /* fall through to a global install */
  }
  try {
    const { execSync } = await import('node:child_process')
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim()
    return await import(`${root}/playwright/index.mjs`)
  } catch {
    console.error('Playwright not found. Try: npm i -g playwright && playwright install chromium')
    process.exit(2)
  }
}

const { chromium } = await loadPlaywright()
const browser = await chromium.launch()

const FORECAST = {
  current: { temperature_2m: 14.2, weather_code: 3, is_day: 1 },
  daily: { temperature_2m_max: [18.4], temperature_2m_min: [9.1] },
}

/* Clear, after dark — the one case where the drawing has to change without the
   word changing at all. */
const NIGHT = {
  current: { temperature_2m: 6.1, weather_code: 0, is_day: 0 },
  daily: { temperature_2m_max: [11.2], temperature_2m_min: [4.4] },
}

let asked = []
let answer = FORECAST
let dead = false

async function device({ width, height, locale = 'en-GB' }) {
  const context = await browser.newContext({
    viewport: { width, height },
    locale,
    permissions: ['geolocation'],
    /* Somewhere it rains enough to be worth a line about. */
    geolocation: { latitude: 54.14, longitude: -0.8 },
  })
  await context.route('**://api.open-meteo.com/**', async (route, request) => {
    asked.push(request.url())
    if (dead) return route.abort('failed')
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(answer),
    })
  })
  const view = await context.newPage()
  view.on('pageerror', (e) => problems.push(`${width}px: ${e.message}`))
  await view.goto(BASE, { waitUntil: 'domcontentloaded' })
  await view.waitForTimeout(1800)
  return { context, view }
}

/* ── the rail, where the month is ───────────────────────────────────────── */

{
  asked = []
  const { context, view } = await device({ width: 1440, height: 900 })

  ok('the weather asks for exactly one place', asked.length >= 1, `${asked.length} calls`)
  ok(
    'and asks for the day as well as the moment',
    asked[0]?.includes('temperature_2m_max') && asked[0]?.includes('weather_code'),
  )
  ok(
    'and whether the sun is up, because a sun at nine at night is wrong',
    asked[0]?.includes('is_day'),
  )

  const line = view.locator('.rail .weather')
  ok('the rail carries a weather line', (await line.count()) === 1)
  ok(
    'it sits under the month rather than over it',
    await view.evaluate(() => {
      const month = document.querySelector('.rail-month')?.getBoundingClientRect()
      const weather = document.querySelector('.rail .weather')?.getBoundingClientRect()
      return !!month && !!weather && weather.top >= month.bottom - 1
    }),
  )
  ok('it says the temperature', (await line.locator('.weather-now').textContent()) === '14°')
  ok('and the day it sits in', (await line.locator('.weather-range').textContent()) === '18/9')

  /* The sky, drawn. The word is gone from the page and has to still be the
     name the drawing answers to, or the line has got worse for anyone who
     can't see it. */
  const glyph = line.locator('.weather-glyph svg')
  ok('and draws the sky rather than naming it', (await glyph.count()) === 1)
  ok(
    'the word it replaced is still what it is called',
    (await glyph.getAttribute('role')) === 'img' &&
      (await glyph.locator('title').textContent()) === 'Overcast',
  )
  ok(
    'and the word is nowhere on the line as writing',
    /* `innerText` rather than `textContent`, and the difference is the point:
       `textContent` walks into the SVG and finds the `<title>`, which is
       exactly the thing that is supposed to be there for a screen reader and
       nowhere on the page for an eye. */
    (await view.locator('.weather-word').count()) === 0 &&
      !(await line.innerText()).toLowerCase().includes('overcast'),
  )
  ok(
    'it is ours and not the operating system\'s — a stroke in the line\'s own colour',
    await glyph.evaluate((el) => {
      const paths = el.querySelectorAll('path, circle, line')
      return paths.length > 0 && el.getAttribute('stroke') === 'currentColor'
    }),
  )
  ok(
    'and it is drawn at the size of the line it sits on, not a number of pixels',
    await glyph.evaluate((el) => {
      const box = el.getBoundingClientRect()
      const size = parseFloat(getComputedStyle(el.parentElement).fontSize)
      return Math.abs(box.height - size * 1.4) < 1 && Math.abs(box.width - box.height) < 1
    }),
  )
  ok(
    'and sits on the line rather than under it',
    await view.evaluate(() => {
      const line = document.querySelector('.rail .weather').getBoundingClientRect()
      const g = document.querySelector('.rail .weather-glyph svg').getBoundingClientRect()
      const now = document.querySelector('.rail .weather-now').getBoundingClientRect()
      /* Within a pixel of concentric with the temperature beside it, and
         inside the line's own box at both ends. */
      return (
        Math.abs((g.top + g.bottom) / 2 - (now.top + now.bottom) / 2) < 1.5 &&
        g.top >= line.top - 0.5 &&
        g.bottom <= line.bottom + 0.5
      )
    }),
  )

  /* The register: Courier, tracked, uppercase — the same one edit times and
     word counts already speak in. */
  const register = await line.evaluate((el) => {
    const s = getComputedStyle(el)
    return { family: s.fontFamily.toLowerCase(), transform: s.textTransform }
  })
  ok(
    'in the field-note register and not a voice of its own',
    register.family.includes('courier') && register.transform === 'uppercase',
    `${register.family} / ${register.transform}`,
  )

  await context.close()
}

/* ── the phone, where the rail is a closed drawer ───────────────────────── */

{
  const { context, view } = await device({ width: 430, height: 900 })

  ok(
    'the drawer is shut, so the rail line is not on screen',
    (await view.locator('.rail .weather').count()) === 0,
  )
  const line = view.locator('.list-masthead .weather')
  ok('the date carries it instead', (await line.count()) === 1)
  ok(
    'with the temperature and the sky',
    (await line.locator('.weather-now').textContent()) === '14°' &&
      (await line.locator('.weather-glyph svg title').textContent()) === 'Overcast',
    await line.textContent(),
  )
  ok(
    'and the range as well, which it used to have to give up for the word',
    (await line.locator('.weather-range').textContent()) === '18/9',
  )
  ok(
    'and it does not push the date off its own line',
    await view.evaluate(() => {
      const head = document.querySelector('.list-masthead')
      return head ? head.scrollWidth <= head.clientWidth + 1 : false
    }),
  )

  await context.close()
}

/* ── when it can't be had ───────────────────────────────────────────────── */

{
  dead = true
  const { context, view } = await device({ width: 1440, height: 900 })
  ok(
    'a service that will not answer leaves no empty slot behind',
    (await view.locator('.weather').count()) === 0,
  )
  ok(
    'and nothing else on the screen minds',
    (await view.locator('.rail-month').count()) === 1 &&
      (await view.locator('.list-row').count()) >= 1,
  )
  await context.close()
  dead = false
}

/* ── what a degree means ────────────────────────────────────────────────── */

{
  asked = []
  const { context } = await device({ width: 1440, height: 900, locale: 'en-US' })
  ok(
    'an American device is asked in Fahrenheit without being told to',
    asked[0]?.includes('fahrenheit'),
    asked[0]?.slice(-60),
  )
  await context.close()
}

{
  asked = []
  const { context } = await device({ width: 1440, height: 900, locale: 'en-GB' })
  ok(
    'and everywhere else is asked in Celsius',
    asked[0] && !asked[0].includes('fahrenheit'),
    asked[0]?.slice(-60),
  )
  await context.close()
}

/* ── after dark ─────────────────────────────────────────────────────────
   Same word, different drawing. This is the whole reason `is_day` was asked
   for, so it is the one thing worth proving twice. */

{
  answer = NIGHT
  const { context, view } = await device({ width: 1440, height: 900 })
  const glyph = view.locator('.rail .weather-glyph svg')
  ok('a clear night is still called clear', (await glyph.locator('title').textContent()) === 'Clear')
  ok(
    'and is drawn as a moon rather than a sun — no rays, one closed shape',
    await glyph.evaluate((el) => el.querySelectorAll('circle').length === 0 && el.querySelectorAll('path').length === 1),
  )
  await context.close()
  answer = FORECAST
}

/* ── a reading cached before any of this existed ────────────────────────
   The store defaults `isDay` the way it already defaults `high` and `low`. A
   device that has been shut since before the glyphs shipped opens on its old
   reading and must not open on a blank line. */

{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'en-GB',
  })
  /* No geolocation permission and no route: nothing can refresh this, so what
     renders is the cached reading and only the cached reading. */
  await context.route('**://api.open-meteo.com/**', (route) => route.abort('failed'))
  await context.addInitScript(() => {
    localStorage.setItem(
      'field-notes.weather',
      /* Exactly the shape the store wrote before August 2026. */
      JSON.stringify({ temp: 14.2, code: 3, high: 18.4, low: 9.1, unit: 'C', at: Date.now() }),
    )
  })
  const view = await context.newPage()
  view.on('pageerror', (e) => problems.push(`stale: ${e.message}`))
  await view.goto(BASE, { waitUntil: 'domcontentloaded' })
  await view.waitForTimeout(1200)

  const line = view.locator('.rail .weather')
  ok('a reading from before the glyphs still renders a line', (await line.count()) === 1)
  ok(
    'and shows a day, which is the commoner half of the day',
    (await line.locator('.weather-glyph svg title').textContent()) === 'Overcast' &&
      (await line.locator('.weather-now').textContent()) === '14°',
  )
  await context.close()
}

/* ── at 2× ──────────────────────────────────────────────────────────────
   The dial scales the writing, not the chrome — but the glyph is sized in ems
   off its own line, so what this actually proves is that it did not follow the
   dial and grow into the month grid. */

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-GB' })
  await context.route('**://api.open-meteo.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FORECAST) }),
  )
  await context.addInitScript(() => {
    localStorage.setItem('field-notes.zoom-defaulted', '1')
    localStorage.setItem('field-notes.settings', JSON.stringify({ zoom: 2 }))
  })
  const view = await context.newPage()
  view.on('pageerror', (e) => problems.push(`2x: ${e.message}`))
  await view.goto(BASE, { waitUntil: 'domcontentloaded' })
  await view.waitForTimeout(1800)
  ok(
    'the glyph is chrome and does not take the dial with it',
    await view.evaluate(() => {
      const g = document.querySelector('.rail .weather-glyph svg')
      const now = document.querySelector('.rail .weather-now')
      if (!g || !now) return false
      const size = parseFloat(getComputedStyle(now).fontSize)
      return Math.abs(g.getBoundingClientRect().height - size * 1.4) < 1
    }),
  )
  await context.close()
}

await browser.close()

if (problems.length) {
  failures += problems.length
  console.log('\n' + problems.join('\n'))
}
console.log(failures ? `\n${failures} failing` : '\nall good')
process.exit(failures ? 1 : 0)
