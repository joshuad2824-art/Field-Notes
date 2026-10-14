/* No scrollbars, anywhere (October 14, 2026). Joshua asked for none in
   Field Notes at all, after one showed down the side of the day agenda.

   Two questions, asked of every route at a desk and at a phone:

   1. Does anything on the screen *say* it wants a bar? Every element is read,
      not only the ones that overflow, because a rule written for a screen that
      is not on screen at the moment is exactly how the agenda's got in.
   2. Does any scroller that overflows actually *spend width* on one? The
      browser is launched without Playwright's `--hide-scrollbars`, which is
      what makes headless Chromium draw overlay bars of zero width and lets
      question 2 pass for free everywhere. The control probe reports what an
      unstyled scroller costs on this machine; if it reads 0 the second half is
      vacuous here and the output says so, as the leaf's check in
      tests/editor.mjs does.

   The scrollers are made to overflow first. A suite that only visits screens
   short enough to fit is checking nothing. */

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
const browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] })
const problems = []
let failures = 0
const ok = (name, pass, detail = '') => {
  if (!pass) failures++
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

const settledZoom = () => {
  try {
    localStorage.setItem('field-notes.zoom-defaulted', '1')
    if (!localStorage.getItem('field-notes.settings'))
      localStorage.setItem('field-notes.settings', JSON.stringify({ pen: 'ink', stock: 'paper', zoom: 1 }))
  } catch {
    /* not a document with settings */
  }
}

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const today = iso(new Date())
const month = today.slice(0, 7)

/* What every element in the document says about its own bar, and what every
   scroller that overflows costs. */
const audit = () => {
  const wants = []
  const spent = []
  const scrollers = []
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el)
    const label = `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}`
    const pseudo = getComputedStyle(el, '::-webkit-scrollbar').display
    if (cs.scrollbarWidth !== 'none' || pseudo !== 'none') wants.push(`${label} (scrollbar-width ${cs.scrollbarWidth}, pseudo ${pseudo})`)
    const scrolls = /auto|scroll/.test(cs.overflowY + cs.overflowX)
    if (scrolls && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) {
      scrollers.push(label)
      const gutter = el.offsetWidth - el.clientWidth - (parseFloat(cs.borderLeftWidth) || 0) - (parseFloat(cs.borderRightWidth) || 0)
      const gutterY = el.offsetHeight - el.clientHeight - (parseFloat(cs.borderTopWidth) || 0) - (parseFloat(cs.borderBottomWidth) || 0)
      if (gutter > 0 || gutterY > 0) spent.push(`${label} (${gutter}px × ${gutterY}px)`)
    }
  }
  return { wants, spent, scrollers }
}

const probe = () => {
  const el = document.createElement('div')
  el.style.cssText = 'position:fixed;top:0;left:0;width:60px;height:60px;overflow:auto;visibility:hidden'
  el.innerHTML = '<div style="height:400px"></div>'
  /* A probe that opts out of the app's rule: what this machine's bar costs. */
  el.style.scrollbarWidth = 'auto'
  el.setAttribute('data-probe', '1')
  document.body.append(el)
  const style = document.createElement('style')
  style.textContent = '[data-probe]::-webkit-scrollbar{display:block;width:15px;height:15px}'
  document.head.append(style)
  const cost = el.offsetWidth - el.clientWidth
  el.remove()
  style.remove()
  return cost
}

const seed = async (page) => {
  return page.evaluate(async (day) => {
    const long = []
    for (let i = 0; i < 80; i++) long.push(`## Heading ${i + 1}\n\nA paragraph that is long enough to wrap onto a second line when it is set in the measure. `.repeat(1))
    const id = crypto.randomUUID()
    const now = Date.now()
    const events = Array.from({ length: 14 }, (_, i) => ({
      id: crypto.randomUUID(),
      title: `Event ${i + 1} with a title long enough to be worth reading`,
      date: day,
      startTime: `${String(7 + i).padStart(2, '0')}:00`,
      endTime: `${String(7 + i).padStart(2, '0')}:45`,
      created: now,
      updated: now,
    }))
    await new Promise((res, rej) => {
      const open = indexedDB.open('field-notes')
      open.onerror = () => rej(open.error)
      open.onsuccess = () => {
        const db = open.result
        const tx = db.transaction(['pages', 'events'], 'readwrite')
        tx.objectStore('pages').put({ id, notebook: 'church', body: long.join('\n\n'), created: now, updated: now, pinned: 0 })
        for (const e of events) tx.objectStore('events').put(e)
        tx.oncomplete = () => {
          db.close()
          res()
        }
        tx.onerror = () => rej(tx.error)
      }
    })
    return id
  }, today)
}

for (const [label, viewport] of [
  ['desk 1440×900', { width: 1440, height: 900 }],
  ['tablet 900×700', { width: 900, height: 700 }],
  ['phone 390×700', { width: 390, height: 700 }],
]) {
  const ctx = await browser.newContext({ viewport })
  await ctx.addInitScript(settledZoom)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => problems.push(`${label}: ${e.message}`))
  await page.goto(BASE + '/')
  await page.waitForSelector('.floating-nav')
  await page.waitForTimeout(500)
  const id = await seed(page)

  const control = await page.evaluate(probe)
  console.log(`${label}: control scroller costs ${control}px on this machine${control === 0 ? ' — overlay bars; the width half is vacuous here' : ''}`)

  const routes = [
    ['Today', '/'],
    ['Today (overview)', '/overview'],
    ['a notebook', '/n/church'],
    ['a page', `/p/${id}`],
    ['the month', `/calendar/${month}`],
    ['the day agenda', `/day/${today}`],
    ['the Workshop', '/workshop'],
    ['From Siena', '/from-siena'],
    ['Search', '/search'],
    ['Trash', '/trash'],
    ['Settings', '/settings'],
  ]
  for (const [name, path] of routes) {
    await page.goto(BASE + path)
    await page.waitForSelector('.floating-nav')
    await page.waitForTimeout(700)
    const found = await page.evaluate(audit)
    ok(`${label}: ${name} asks for no scrollbar anywhere`, found.wants.length === 0, found.wants.slice(0, 4).join('; '))
    ok(`${label}: and no scroller on it spends width on one`, found.spent.length === 0, `${found.scrollers.length} overflowing${found.spent.length ? '; ' + found.spent.slice(0, 4).join('; ') : ''}`)
  }

  /* The overlays that scroll on their own: the notebook manager and the sheet. */
  await page.goto(BASE + '/')
  await page.waitForSelector('.floating-nav')
  await page.waitForTimeout(500)
  const overlay = await page.evaluate(() => {
    for (const el of document.querySelectorAll('.manager, .sheet')) {
      const cs = getComputedStyle(el)
      if (cs.scrollbarWidth !== 'none' || getComputedStyle(el, '::-webkit-scrollbar').display !== 'none') return `${el.className}`
    }
    return ''
  })
  ok(`${label}: the manager and the sheet ask for none either`, overlay === '', overlay)

  await ctx.close()
}

ok('no page errors', problems.length === 0, problems.slice(0, 3).join('; '))
await browser.close()
console.log(failures ? `\n${failures} FAILED` : '\nall passed')
process.exit(failures ? 1 : 0)
