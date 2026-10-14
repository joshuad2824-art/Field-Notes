/* The pill and a scroll that isn't perfectly steady (October 14, 2026).

   Joshua's recording of the notebook screen showed the toolbar blinking in and
   out as a long note was scrolled. The pill used to answer every scroll event
   on its own — down by more than 2px receded it, up by more than 2px brought
   it back, and a quarter second of quiet brought it back as well — and a
   scroller that stops and starts, or that CodeMirror corrects by a few pixels
   while it measures lines it had only estimated, used all three in a second.
   Counted on a long note before the change: 24 flips for twelve wheel notches
   down and twelve up, 32 for a slow read, 40 for a read with the mouse resting.
   After: 2, 2 and 2 — away as you read down, back as you scroll up.

   Two halves. The first is the truth table of lib/pill-scroll.ts on node, with
   nothing around it. The second drives a real browser, and counts class flips
   on the pill rather than reading the code's opinion of itself. */

import { travel, TRAVEL_DOWN, TRAVEL_UP, TURN } from '../src/lib/pill-scroll.ts'

let failures = 0
const ok = (name, pass, detail = '') => {
  if (!pass) failures++
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

/* ── the rules, on node ─────────────────────────────────────────────── */

/* Feed a scroller a list of positions and return every verdict it gave. */
const run = (tops, start) => {
  let state = start
  return tops.map((top) => {
    const out = travel(state, top)
    state = out.next
    return out.verdict
  })
}

ok('a scroller is read from the top the first time it is seen', travel(undefined, 30).next.from === 0)
ok('a short step down says nothing', run([30])[0] === null)
ok(`a step as long as ${TRAVEL_DOWN}px says down`, run([TRAVEL_DOWN])[0] === 'down')
ok('a page restored to the middle reads as a scroll down, as it was', run([500])[0] === 'down')
ok('the same steps accumulate while the direction holds', run([20, 40, 66]).join() === ',,down')
ok('standing still says nothing', run([400, 400.4, 399.8], { dir: 1, from: 400, edge: 400 }).every((v) => v === null))

let verdicts = run([380, 360, 340], { dir: -1, from: 400, edge: 400 })
ok(`up has to run ${TRAVEL_UP}px before it says so`, verdicts.join() === ',,up', verdicts.join('|'))

/* The case the recording was made of: a few pixels the wrong way. A step back
   shorter than TURN is the scroller settling, not the reader turning round, so
   it neither ends the run nor adds to it. */
verdicts = run([100, 94, 100, 95, 101, 96, 103, 98, 104], { dir: 1, from: 0, edge: 0 })
ok('a few pixels against the grain never say up, however often', !verdicts.includes('up'), verdicts.join('|'))
ok('and never take back a run that was already long enough', verdicts.every((v) => v === 'down'), verdicts.join('|'))
const tremor = Array.from({ length: 60 }, (_, i) => 200 + (i % 2 ? 7 : 0))
ok('a scroller that shivers on one spot never speaks', run(tremor, { dir: 1, from: 200, edge: 200 }).every((v) => v === null))

/* The case the first version of this file got wrong: forward 30, back 6, over
   and over. Each leg is shorter than a run, but the page is going down. */
const creeping = []
for (let top = 0, i = 0; i < 40; i++) {
  top += 30
  creeping.push(top, top - 6)
  top -= 6
}
verdicts = run(creeping)
ok('forward 30, back 6, forty times: it says down, and never up', verdicts.includes('down') && !verdicts.includes('up'), `first 'down' at step ${verdicts.indexOf('down')}`)
ok('and says it as soon as the page has gone far enough', verdicts.indexOf('down') <= 5, `step ${verdicts.indexOf('down')}`)

/* A turn starts a new run where the old one peaked. */
verdicts = run([300, 270, 240], { dir: 1, from: 0, edge: 0 })
ok('a run back starts at the turn, not at the top', verdicts.join() === 'down,,up', verdicts.join('|'))
verdicts = run([60, 30, 20, 10])
ok(`a step of a line or more is a turn (${TURN}px)`, verdicts.join() === ',,,up', verdicts.join('|'))
verdicts = run([60, 40, 62, 40, 66])
ok('and one a little short of it is not', verdicts.join() === ',,,,down', verdicts.join('|'))

/* ── a real browser ─────────────────────────────────────────────────── */

const BASE = process.env.BASE ?? 'http://localhost:4173'

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
const problems = []

const ctx = await browser.newContext({ viewport: { width: 1440, height: 800 } })
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('field-notes.zoom-defaulted', '1')
    if (!localStorage.getItem('field-notes.settings'))
      localStorage.setItem('field-notes.settings', JSON.stringify({ pen: 'ink', stock: 'paper', zoom: 1 }))
  } catch {
    /* not a document with settings */
  }
})
const page = await ctx.newPage()
page.on('pageerror', (e) => problems.push(e.message))
await page.goto(BASE + '/')
await page.waitForSelector('.floating-nav')
await page.waitForTimeout(600)

/* A long note with uneven lines — headings, wrapping paragraphs, highlights,
   lists — because CodeMirror estimates what it has not drawn, and it is the
   uneven page that makes it correct itself. */
const id = await page.evaluate(async () => {
  const colours = ['brass', 'navy', 'forest']
  const parts = []
  for (let i = 0; i < 70; i++) {
    parts.push(`## Heading number ${i + 1}`)
    parts.push(
      `Paragraph ${i + 1} — ` +
        'Pray for steady hands, clear heads and a patient church. '.repeat(1 + (i % 5)) +
        `=={${colours[i % 3]}}a marked phrase in the middle==` +
        ' and then it keeps going for a while longer so the line wraps.',
    )
    if (i % 3 === 0) parts.push('- a bullet\n- another bullet that is somewhat longer than the first one\n- and a third')
  }
  const made = crypto.randomUUID()
  await new Promise((res, rej) => {
    const open = indexedDB.open('field-notes')
    open.onerror = () => rej(open.error)
    open.onsuccess = () => {
      const db = open.result
      const tx = db.transaction('pages', 'readwrite')
      tx.objectStore('pages').put({ id: made, notebook: 'church', body: parts.join('\n\n'), created: Date.now(), updated: Date.now(), pinned: 0 })
      tx.oncomplete = () => {
        db.close()
        res()
      }
      tx.onerror = () => rej(tx.error)
    }
  })
  return made
})
await page.goto(BASE + '/p/' + id)
await page.waitForSelector('.cm-content')
await page.waitForTimeout(1200)

const overflowing = await page.evaluate(() => {
  const el = document.querySelector('.cm-scroller')
  return el.scrollHeight - el.clientHeight
})
ok('the note is long enough to scroll', overflowing > 2000, `${overflowing}px of travel`)

await page.evaluate(() => {
  const nav = document.querySelector('.floating-nav')
  window.__log = []
  const snap = () => ({ r: nav.classList.contains('receded'), d: nav.classList.contains('resting') })
  let last = snap()
  window.__log.push(last)
  new MutationObserver(() => {
    const s = snap()
    if (s.r !== last.r || s.d !== last.d) {
      window.__log.push(s)
      last = s
    }
  }).observe(nav, { attributes: true, attributeFilter: ['class'] })
})

/* Counts how many times the pill changes between there and gone, and how many
   times it dims, while `act` runs. The mouse is parked and the log cleared
   first, and given time afterwards for the end-of-scroll return. */
const flips = async (act) => {
  await page.mouse.move(900, 400)
  await page.waitForTimeout(900)
  await page.evaluate(() => {
    window.__log.length = 1
    const nav = document.querySelector('.floating-nav')
    window.__log[0] = { r: nav.classList.contains('receded'), d: nav.classList.contains('resting') }
  })
  await act()
  await page.waitForTimeout(1200)
  const log = await page.evaluate(() => window.__log)
  return {
    recede: log.slice(1).filter((s, i) => s.r !== log[i].r).length,
    dim: log.slice(1).filter((s, i) => s.d !== log[i].d).length,
  }
}
const wheel = (dy) => page.mouse.wheel(0, dy)

let r = await flips(async () => {
  for (let i = 0; i < 8; i++) {
    await wheel(100)
    await page.waitForTimeout(320)
  }
  for (let i = 0; i < 8; i++) {
    await wheel(-100)
    await page.waitForTimeout(320)
  }
})
ok('wheel notches 320ms apart, down then back up: the pill leaves once and returns once', r.recede === 2, `${r.recede} flips (was 16 before the change)`)

r = await flips(async () => {
  for (let i = 0; i < 60; i++) {
    await wheel(40)
    await page.waitForTimeout(16)
  }
  for (let i = 0; i < 60; i++) {
    await wheel(-40)
    await page.waitForTimeout(16)
  }
})
ok('a continuous scroll down and back: once each way', r.recede === 2, `${r.recede} flips`)

r = await flips(async () => {
  for (let i = 0; i < 16; i++) {
    await page.mouse.move(900 + (i % 2 ? 3 : -3), 400)
    await wheel(30)
    await page.waitForTimeout(450)
  }
})
ok('a slow read with a jostled mouse: it leaves once, and comes back once when the reading stops', r.recede === 2, `${r.recede} flips (was 32 before the change)`)
ok('and does not dim while the page is moving', r.dim === 0, `${r.dim} dims`)

r = await flips(async () => {
  for (let i = 0; i < 20; i++) {
    await wheel(25)
    await page.waitForTimeout(280)
  }
})
ok('a mouse left still for five seconds of slow scrolling: one flip, no dimming', r.recede <= 2 && r.dim === 0, `${r.recede} flips, ${r.dim} dims (was 40 before the change)`)

/* The cause named in the comment, made on purpose: the editor's own scrollTop
   moved forward and nudged back, which is what CodeMirror does when a line it
   had guessed at is measured. */
await page.evaluate(() => {
  const el = document.querySelector('.cm-scroller')
  el.scrollTop = 0
})
await page.waitForTimeout(1200)
r = await flips(async () => {
  await page.evaluate(async () => {
    const el = document.querySelector('.cm-scroller')
    const frame = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)))
    let top = 0
    for (let i = 0; i < 40; i++) {
      top += 30
      el.scrollTop = top
      await frame()
      el.scrollTop = top - 6
      await frame()
      top -= 6
    }
  })
})
ok('forward 30, back 6, forty times, in the editor itself: it leaves once, and comes back once when the scrolling stops', r.recede === 2, `${r.recede} flips`)

/* A pointer that is only trembling is not reaching for the pill; one that
   goes somewhere is. Typing recedes it without any scroll to bring it back. */
await page.goto(BASE + '/new/church')
await page.waitForSelector('.cm-content')
await page.mouse.move(700, 300)
await page.waitForTimeout(700)
await page.keyboard.type('a line of writing')
await page.waitForFunction(() => document.querySelector('.floating-nav').classList.contains('receded'))
ok('typing recedes the pill', true)
await page.waitForTimeout(900)
ok('and nothing scrolled brings it back mid-sentence', await page.evaluate(() => document.querySelector('.floating-nav').classList.contains('receded')))
await page.mouse.move(703, 301)
await page.waitForTimeout(300)
ok('a pointer that only trembles does not either', await page.evaluate(() => document.querySelector('.floating-nav').classList.contains('receded')))
await page.mouse.move(780, 360, { steps: 6 })
await page.waitForFunction(() => !document.querySelector('.floating-nav').classList.contains('receded'), null, { timeout: 2000 }).catch(() => {})
ok('one that goes somewhere does', await page.evaluate(() => !document.querySelector('.floating-nav').classList.contains('receded')))

ok('no page errors', problems.length === 0, problems.slice(0, 3).join('; '))
await browser.close()
console.log(failures ? `\n${failures} FAILED` : '\nall passed')
process.exit(failures ? 1 : 0)
