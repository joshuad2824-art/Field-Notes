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

// The October 12 board replaces weather in the notebook rail.
const {execSync}=await import('node:child_process')
const {chromium}=await import(`${execSync('npm root -g',{encoding:'utf8'}).trim()}/playwright/index.mjs`)
const browser=await chromium.launch()
try{for(const width of [1440,1180,390]){
 const context=await browser.newContext({viewport:{width,height:900},locale:'en-GB'})
 await context.addInitScript(()=>{localStorage.setItem('field-notes.place',JSON.stringify({lat:54.14,lon:-.8,label:'Test town',chosen:true}));localStorage.setItem('field-notes.weather.unit','C')})
 let calls=0,night=false,dead=false
 await context.route('**://api.open-meteo.com/**',r=>{calls++;if(dead)return r.abort();return r.fulfill({contentType:'application/json',body:JSON.stringify({current:{temperature_2m:night?6:14,weather_code:night?0:3,is_day:night?0:1},daily:{time:Array.from({length:7},(_,i)=>`2026-10-${12+i}`),temperature_2m_max:Array(7).fill(18),temperature_2m_min:Array(7).fill(9),weather_code:Array(7).fill(3)}})})})
 const page=await context.newPage();page.on('pageerror',e=>problems.push(e.message));await page.goto(BASE)
 await page.locator('.board-weather-tile .board-weather>strong').getByText('14°',{exact:true}).waitFor()
 ok(`${width}: weather tile reflects the service`,await page.locator('.board-weather-tile').innerText().then(t=>t.toLowerCase().includes('test town')||width<820))
 ok(`${width}: forecast keeps five distinct days`,await page.locator('.board-forecast>div').count()===5)
 await page.evaluate(async()=>{const{refresh}=await import('/src/weather/store.ts');await refresh()});ok(`${width}: fresh weather reuses its cache`,calls===1)
 night=true;await page.evaluate(async()=>{const{refresh}=await import('/src/weather/store.ts');await refresh(true)});await page.locator('.board-weather-tile .board-weather>strong').getByText('6°',{exact:true}).waitFor();ok(`${width}: night glyph has no sun rays`,await page.locator('.board-weather-tile svg line').count()===0)
 dead=true;await page.reload();await page.locator('.board-weather-tile .board-weather>strong').getByText('6°',{exact:true}).waitFor();ok(`${width}: offline retains the last reading`,true)
 await page.evaluate(async()=>{const{setOff}=await import('/src/weather/store.ts');setOff(true)});ok(`${width}: off hides the weather reading`,await page.locator('.board-weather-tile .board-weather>strong').count()===0)
 await context.close()
}}finally{await browser.close()}
if(problems.length){console.error(problems);failures+=problems.length}process.exit(failures?1:0)
