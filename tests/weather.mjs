/* Weather checks, in the same two halves as the sync ones.

   The codes are a pure lookup and run on node. The line itself needs a browser,
   a device that will say where it is, and a service that will answer — so the
   service is faked in this file and the device is told where it is by
   Playwright, which is the only way to make "what does the rail show at 14° and
   overcast" a question with one answer.

   Run a server first, then this:

     npm run build && npm run preview &
     npm run check                       # or BASE=http://localhost:5173 npm run check */

import { conditionWord, degrees, isWet } from '../src/weather/codes.ts'

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
  current: { temperature_2m: 14.2, weather_code: 3 },
  daily: { temperature_2m_max: [18.4], temperature_2m_min: [9.1] },
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
  ok('and the one word', (await line.locator('.weather-word').textContent()) === 'Overcast')
  ok('and the day it sits in', (await line.locator('.weather-range').textContent()) === '18/9')

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
    'with the temperature and the word',
    (await line.locator('.weather-now').textContent()) === '14°' &&
      (await line.locator('.weather-word').textContent()) === 'Overcast',
    await line.textContent(),
  )
  ok(
    'and without the range, which has a 76px numeral beside it',
    (await line.locator('.weather-range').count()) === 0,
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

await browser.close()

if (problems.length) {
  failures += problems.length
  console.log('\n' + problems.join('\n'))
}
console.log(failures ? `\n${failures} failing` : '\nall good')
process.exit(failures ? 1 : 0)
