// October 13 controls review: one quiet control grammar, checked at six widths.
// Local unpaired fixtures only. BASE=http://127.0.0.1:5188 node tests/controls-review.mjs
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const { chromium } = await import(
  `${execSync('npm root -g', { encoding: 'utf8' }).trim()}/playwright/index.mjs`
)
const BASE = process.env.BASE || 'http://127.0.0.1:5188'
if (!['localhost', '127.0.0.1'].includes(new URL(BASE).hostname))
  throw Error('Local unpaired fixtures only')
const out = 'work/2026-10-13-controls-review/check'
mkdirSync(out, { recursive: true })
const WIDTHS = (process.env.WIDTHS || '1920,1440,1180,820,390,320').split(',').map(Number)
const ST_JOHN = 'd97288df-10bc-451f-8903-82d4e0c74873'
const ROOMS = ['Today', 'Notebooks', 'Calendar', 'Workshop', 'From Siena']
const height = (w) => (w >= 1200 ? 900 : w >= 820 ? 1180 : 844)

/* Strings this pass removed. Matched against rendered text, case blind,
   because text-transform reaches innerText. */
const GONE = [
  'A thought to keep',
  'An open day',
  'Pick up a page.',
  'Your writing is right here.',
  'Write a new page',
  'Write the first page',
  'Open in Maps',
  'Field Notes calendar',
  'The end date is the last day included',
  'optional',
  'Notebook desk',
  'Opens the source. Use your Ascension account.',
  'All messages from Siena',
  'Write a note',
  'About weekly reviews',
  'File in',
  'Kept on this device until you choose a notebook.',
  'Theme · Follow the last notebook',
  'events this month',
  'Each kept thirty days',
  'Back to list',
  'Back to Workshop',
  'Back to agenda',
]
const GONE_EXACT_LINES = ['Manage', 'esc', 'Notebook', 'Tags', 'Where', 'Calendar tools', 'Notebook pages']

let checks = 0
const ok = (value, message) => {
  assert.ok(value, message)
  checks++
}
const eq = (a, b, message) => {
  assert.equal(a, b, message)
  checks++
}

const browser = await chromium.launch()
try {
  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: height(width) } })
    await context.route('**/*', (r) =>
      new URL(r.request().url()).origin === new URL(BASE).origin ? r.continue() : r.abort(),
    )
    const page = await context.newPage()
    page.setDefaultTimeout(8000)
    const errors = []
    page.on('pageerror', (e) => errors.push(`${width} ${page.url()}: ${e.message}`))
    await page.goto(BASE + '/tests/redesign-check.html')
    await page.getByRole('button', { name: 'Load redesign fixtures' }).click()
    await page.getByText('Fixtures ready').waitFor()
    const today = await page.evaluate(() => new Date().toLocaleDateString('en-CA'))
    const plus = (iso, n) => {
      const d = new Date(iso + 'T12:00:00')
      d.setDate(d.getDate() + n)
      return d.toLocaleDateString('en-CA')
    }
    const month = today.slice(0, 7)
    const seriesDay = plus(today, 2)
    const path = () => new URL(page.url()).pathname
    const visit = async (p) => {
      await page.goto(BASE + p)
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(250)
      await page.mouse.move(width / 2, 10)
    }
    const pill = () => page.getByRole('navigation', { name: 'Primary navigation' })
    const tap = async (locator) => {
      await page.mouse.move(width / 2, 12)
      await locator.click()
    }
    /* October 13, second pass: a phone's pill is ← · the room you are in · +,
       and the room's mark raises the rooms and the app menu. */
    const phone = width < 820
    const raise = async () => {
      if (!phone) return
      if (await page.getByRole('navigation', { name: 'Rooms' }).isVisible().catch(() => false)) return
      await tap(page.locator('.floating-nav .pill-room'))
      await page.getByRole('navigation', { name: 'Rooms' }).waitFor()
    }
    const room = async (name) => {
      await raise()
      return phone
        ? page.getByRole('navigation', { name: 'Rooms' }).getByRole('link', { name, exact: true })
        : pill().getByRole('link', { name, exact: true })
    }
    /* October 13, third pass: on a phone the back rooms are in the same
       sheet as the rooms; on a tablet or a desk ⋯ opens them. */
    const openBack = async () => {
      if (phone) await raise()
      else await tap(pill().getByRole('button', { name: 'App menu' }))
      await page.getByRole('navigation', { name: 'App menu' }).waitFor()
    }
    const backReachable = async () =>
      phone
        ? page.getByRole('navigation', { name: 'App menu' }).isVisible()
        : pill().getByRole('button', { name: 'App menu' }).isVisible()
    /* Where each mark of the pill sits, by name, so every route can be held
       to the first one's (October 13, third pass: the pill holds still). */
    const marks = () =>
      pill().locator('a[aria-label], button[aria-label]').evaluateAll((els) =>
        Object.fromEntries(els.map((e) => [e.getAttribute('aria-label'), Math.round(e.getBoundingClientRect().left + e.getBoundingClientRect().width / 2)])),
      )
    let firstMarks = null
    let firstWidth = null
    /* On a tablet or a desk the pill already holds Today, so ← shows only
       where it goes somewhere else. */
    const TOP = ['today', 'notebook', 'empty notebook', 'journal', 'st john', 'calendar', 'workshop', 'from siena', 'search', 'settings', 'trash']

    const routes = [
      ['/', 'today'],
      ['/n/church', 'notebook'],
      ['/n/garden', 'empty notebook'],
      ['/p/redesign-page', 'page'],
      ['/n/journal', 'journal'],
      ['/p/redesign-journal', 'journal page'],
      [`/n/${ST_JOHN}/desk`, 'st john'],
      [`/calendar/${month}`, 'calendar'],
      [`/day/${today}`, 'day'],
      ['/event/redesign-series', 'event'],
      [`/event/new/${today}`, 'new event'],
      ['/workshop', 'workshop'],
      ['/plan/redesign-plan', 'plan'],
      ['/from-siena', 'from siena'],
      ['/search', 'search'],
      ['/settings', 'settings'],
      ['/trash', 'trash'],
      ['/tag/the-hearth', 'tag'],
    ]

    /* 1. The pill on every route, every room one tap away, nothing repeated,
          nothing removed still on screen, no sideways scroll. */
    for (const [route, name] of routes) {
      await visit(route)
      ok(await pill().isVisible(), `${width} ${name}: pill visible`)
      if (phone)
        eq(await pill().locator('a, button').count(), name === 'today' ? 2 : 3, `${width} ${name}: a phone's pill is ← · room · +`)
      for (const r of ROOMS) ok(await (await room(r)).isVisible(), `${width} ${name}: ${r} one tap away`)
      ok(await backReachable(), `${width} ${name}: app menu`)
      if (phone) {
        await page.keyboard.press('Escape')
        ok(!(await page.getByRole('navigation', { name: 'Rooms' }).isVisible().catch(() => false)), `${width} ${name}: Esc lowers the rooms`)
      }
      if (!phone) {
        /* Every mark stays where it was on every route. */
        const here = await marks()
        firstMarks ??= here
        for (const [label, x] of Object.entries(here)) {
          const key = ['New page', 'New event', 'New plan', 'Review last week', 'Add', 'Save event'].includes(label) ? '+' : label
          const was = Object.entries(firstMarks).find(([l]) => (['New page', 'New event', 'New plan', 'Review last week', 'Add', 'Save event'].includes(l) ? '+' : l) === key)
          if (was) eq(x, was[1], `${width} ${name}: ${label} holds its place`)
        }
        const pillWidth = await pill().evaluate((n) => Math.round(n.getBoundingClientRect().width))
        firstWidth ??= pillWidth
        eq(pillWidth, firstWidth, `${width} ${name}: the pill keeps one width`)
      }
      eq(
        await pill().getByRole('button', { name: 'Up' }).count(),
        name === 'today' || (!phone && TOP.includes(name)) ? 0 : 1,
        `${width} ${name}: ← where it goes somewhere the pill doesn't`,
      )
      ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${width} ${name}: no horizontal overflow`,
      )
      /* What is on screen: text kept only for a screen reader is not shown. */
      const text = (
        await page.evaluate(() => {
          const hidden = [...document.querySelectorAll('.sr-only')]
          hidden.forEach((el) => (el.style.display = 'none'))
          const shown = document.body.innerText
          hidden.forEach((el) => (el.style.display = ''))
          return shown
        })
      ).toLowerCase()
      for (const s of GONE)
        ok(!text.includes(s.toLowerCase()), `${width} ${name}: "${s.trim()}" is gone`)
      const lines = new Set(text.split('\n').map((l) => l.trim()))
      for (const s of GONE_EXACT_LINES)
        ok(!lines.has(s.toLowerCase()), `${width} ${name}: line "${s}" is gone`)
      if (name !== 'settings')
        ok(!lines.has('import markdown'), `${width} ${name}: Import lives only in Settings`)
      ok(!/· [a-z ]+ cover\b/.test(text), `${width} ${name}: no "<notebook> · <colour> cover" eyebrow`)
      ok(!/\b1 (items|pages|reviews|plans|events)\b/.test(text), `${width} ${name}: singular counts`)
      const dupes = await page.evaluate(() => {
        /* Repeated by nature: one per row, reminder or tag. */
        const allow = [
          '.list-row', '.row-page', '.search-hit', '.event-row', '.month-event', '.month-cell',
          '.week-strip', '.cal-day', '.cal-grid', '.agenda-date', '.agenda-more', '.agenda-reminder',
          '.siena-item', '.workshop-reference-open', '.workshop-reference-tools', '.work-note',
          '.work-resources', '.board-books', '.month-written-row', '.collection-chip', '.chips',
          '.board-upcoming-row', '.foot-tag', '.plan-image', '.work-filters', '.collection-filters',
          '.workshop-reference-filters', '.search-filters', '.repeat-weekdays', '.trash-app .row-meta',
          '.board-sidebar nav', '.settings-index', '.tray', '.cm-content', '.plan-chips',
        ].join(',')
        const seen = new Map()
        for (const el of document.querySelectorAll('button, a[href], select, input, summary, [role=menuitem]')) {
          const r = el.getBoundingClientRect()
          const style = getComputedStyle(el)
          if (!r.width || !r.height || style.visibility === 'hidden' || el.closest('[aria-hidden=true]')) continue
          if (el.closest(allow)) continue
          const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim()
          if (!name) continue
          seen.set(name, (seen.get(name) ?? 0) + 1)
        }
        return [...seen].filter(([, n]) => n > 1).map(([n]) => n)
      })
      eq(dupes.join(' | '), '', `${width} ${name}: no control name repeats`)
    }

    /* 2. Workshop and Plan reach Today; every room is one tap from them. */
    for (const from of ['/workshop', '/plan/redesign-plan']) {
      for (const [roomName, expect] of [
        ['Today', /^\/overview$/],
        ['Notebooks', /^\/n\//],
        ['Calendar', /^\/calendar/],
        ['Workshop', /^\/workshop$/],
        ['From Siena', /^\/from-siena$/],
      ]) {
        await visit(from)
        await tap(await room(roomName))
        await page.waitForURL((u) => expect.test(u.pathname))
        checks++
      }
    }

    /* 3. Switching notebooks takes at most two taps. */
    await visit('/n/church')
    const sidebar = page.locator('.board-sidebar nav').getByRole('link', { name: 'Garden' })
    if (await sidebar.isVisible().catch(() => false)) await sidebar.click()
    else {
      await page.getByRole('button', { name: /switch notebook/ }).click()
      await page.getByRole('menuitemradio', { name: 'Garden' }).click()
    }
    await page.waitForURL(/\/n\/garden$/)
    checks++
    // Notebooks from inside a notebook raises the shelf instead of reopening it.
    await visit('/n/church')
    await tap(await room('Notebooks'))
    await page.locator('.pill-shelf').getByRole('menuitemradio', { name: 'The Hearth' }).click()
    await page.waitForURL(/\/n\/hearth$/)
    checks++
    // The St. John desk's name is a switcher too: it is never a room you can't leave.
    await visit(`/n/${ST_JOHN}/desk`)
    await page.locator('.redesign-desk-header').getByRole('button', { name: /switch notebook/ }).click()
    await page.getByRole('menuitemradio', { name: 'Church' }).click()
    await page.waitForURL(/\/n\/church$/)
    checks++
    if (width >= 1200) {
      // With the sidebar folded the list head is the switcher.
      // October 13, third pass: one fold mark steps 3 → 2 → 1 → 3.
      await visit('/n/church')
      await page.getByRole('button', { name: 'Fold the notebooks' }).click()
      ok(!(await page.locator('.board-sidebar').isVisible().catch(() => false)), `${width}: the fold mark folds the notebooks first`)
      ok(await page.locator('.listcol').isVisible(), `${width}: and keeps the list`)
      await page.getByRole('button', { name: /switch notebook/ }).click()
      await page.getByRole('menuitemradio', { name: 'The Hearth' }).click()
      await page.waitForURL(/\/n\/hearth$/)
      checks++
      await page.getByRole('button', { name: 'Fold the list' }).click()
      ok(!(await page.locator('.listcol').isVisible().catch(() => false)), `${width}: then the list`)
      await page.getByRole('button', { name: 'Show the notebooks and the list' }).click()
      ok(await page.locator('.board-sidebar').isVisible(), `${width}: then brings both back`)
      eq(await page.locator('.sidebar-tab:visible').count(), 0, `${width}: the list head's ‹ › retired`)
      await page.keyboard.press('ControlOrMeta+\\')
      ok(!(await page.locator('.board-sidebar').isVisible().catch(() => false)), `${width}: ⌘\\ steps the same cycle`)
      await page.keyboard.press('ControlOrMeta+\\')
      await page.keyboard.press('ControlOrMeta+\\')
      ok(await page.locator('.board-sidebar').isVisible(), `${width}: and comes back round`)
    }

    /* 4. ← goes to the documented parent, from a cold load each time. */
    const parents = [
      ['/n/church', '/overview'],
      ['/p/redesign-page', '/n/church'],
      ['/n/journal', '/overview'],
      ['/p/redesign-journal', '/n/journal'],
      [`/n/${ST_JOHN}/desk`, '/overview'],
      ['/p/redesign-work', `/n/${ST_JOHN}/desk`],
      [`/day/${today}`, `/calendar/${month}`],
      [`/calendar/${month}`, '/overview'],
      ['/event/redesign-series', `/day/${seriesDay}`],
      [`/event/new/${today}`, `/day/${today}`],
      ['/event/new', '/calendar'],
      ['/plan/redesign-plan', '/workshop'],
      ['/plan/redesign-plan/edit', '/plan/redesign-plan'],
      ['/workshop', '/overview'],
      ['/tag/the-hearth', '/search'],
      ['/search', '/overview'],
    ]
    for (const [from, to] of parents) {
      if (!phone && to === '/overview') continue
      await visit(from)
      await tap(pill().getByRole('button', { name: 'Up' }))
      await page.waitForURL((u) => u.pathname === to)
      checks++
    }
    // Back rooms return to the room they were opened from, as reached in use.
    for (const [open, roomLabel] of [
      [true, 'Search'],
      [true, 'Settings'],
      [true, 'Trash'],
      [false, 'From Siena'],
    ]) {
      const room_ = roomLabel
      await visit('/workshop')
      if (open) {
        await openBack()
        await page.getByRole('navigation', { name: 'App menu' }).getByText(roomLabel, { exact: true }).click()
      } else await tap(await room(room_))
      await page.waitForURL((u) => u.pathname !== '/workshop')
      await tap(pill().getByRole('button', { name: 'Up' }))
      await page.waitForURL((u) => u.pathname === '/workshop')
      checks++
    }
    // A deep link opened after another site: ← never leaves the app.
    await page.goto('about:blank')
    await visit('/p/redesign-page')
    await tap(pill().getByRole('button', { name: 'Up' }))
    await page.waitForURL((u) => u.pathname === '/n/church')
    eq(new URL(page.url()).origin, new URL(BASE).origin, `${width}: ← stays on the origin`)

    /* 5. + makes the obvious thing for the room. */
    const newest = () =>
      page.evaluate(async () => {
        const { db } = await import('/src/lib/db.ts')
        const id = location.pathname.split('/')[2]
        return (await db.pages.get(id))?.notebook
      })
    await visit('/n/church')
    await tap(pill().getByRole('button', { name: 'New page' }))
    await page.waitForURL(/\/p\//)
    eq(await newest(), 'church', `${width}: + in a notebook files there`)
    await visit(`/n/${ST_JOHN}/desk`)
    await tap(pill().getByRole('button', { name: 'New page' }))
    await page.waitForURL(/\/p\//)
    eq(await newest(), ST_JOHN, `${width}: + on the St. John desk`)
    await visit('/n/journal')
    await tap(pill().getByRole('button', { name: 'Review last week' }))
    await page.waitForURL(/\/p\//)
    eq(await newest(), 'journal', `${width}: + in Journal reviews last week, in Journal`)
    await visit(`/calendar/${month}`)
    await tap(pill().getByRole('button', { name: 'New event' }))
    await page.waitForURL((u) => u.pathname === `/event/new/${today}`)
    checks++
    await visit(`/day/${today}`)
    await page.locator('.agenda-date button').nth(3).click()
    await tap(pill().getByRole('button', { name: 'New event' }))
    await page.waitForURL((u) => u.pathname === `/event/new/${plus(today, 3)}`)
    checks++
    await visit('/event/redesign-series')
    await tap(pill().getByRole('button', { name: 'New event' }))
    await page.waitForURL((u) => u.pathname === `/event/new/${seriesDay}`)
    checks++
    await visit(`/event/new/${today}`)
    ok(await pill().getByRole('button', { name: 'Save event' }).isVisible(), `${width}: on New event + is its ✓`)
    eq(await page.locator('main').getByRole('button', { name: 'Save event' }).count(), 0, `${width}: and the form keeps no second Save`)
    for (const room of ['/workshop', '/plan/redesign-plan']) {
      await visit(room)
      await tap(pill().getByRole('button', { name: 'New plan' }))
      await page.getByRole('dialog').waitFor()
      eq(path(), room, `${width}: New plan opens in place on ${room}`)
      await page.keyboard.press('Escape')
    }
    for (const room of ['/', '/from-siena', '/search', '/settings', '/trash', '/tag/the-hearth']) {
      await visit(room)
      await tap(pill().getByRole('button', { name: 'Add' }))
      const chooser = page.getByRole('menu', { name: 'Add' })
      for (const item of ['New page', 'New event', 'Quick note'])
        ok(await chooser.getByRole('menuitem', { name: item }).isVisible(), `${width} ${room}: chooser offers ${item}`)
      await page.keyboard.press('Escape')
      ok(!(await chooser.isVisible().catch(() => false)), `${width} ${room}: Esc closes the chooser`)
    }
    await visit('/')
    const remembered = await page.evaluate(() => JSON.parse(localStorage.getItem('field-notes.settings')).notebook)
    await tap(pill().getByRole('button', { name: 'Add' }))
    await page.getByRole('menuitem', { name: 'New page' }).click()
    await page.waitForURL(/\/p\//)
    eq(await newest(), remembered, `${width}: chooser page goes to the remembered notebook`)
    await visit('/')
    await tap(pill().getByRole('button', { name: 'Add' }))
    await page.getByRole('menuitem', { name: 'Quick note' }).click()
    await page.getByRole('textbox', { name: 'Quick note' }).waitFor()
    eq(await pill().getByRole('button', { name: 'Add' }).getAttribute('aria-disabled'), 'true', `${width}: + is inert under the quick note`)
    await page.getByRole('button', { name: 'Done', exact: true }).click()

    /* 6. Keyboard. */
    await visit('/p/redesign-page')
    await page.locator('.cm-content').click()
    await page.keyboard.press('Escape')
    ok(await page.evaluate(() => !document.activeElement?.closest('.cm-editor')), `${width}: Esc lets go of the caret`)
    eq(path(), '/p/redesign-page', `${width}: first Esc stays`)
    await page.keyboard.press('Escape')
    await page.waitForURL((u) => u.pathname === '/n/church')
    checks++
    await visit('/')
    await openBack()
    const appMenu = page.getByRole('navigation', { name: 'App menu' })
    for (const item of ['Search', 'Colors', 'Manage notebooks', 'Ask Siena', 'Trash', 'Settings'])
      ok(await appMenu.getByText(item, { exact: true }).isVisible(), `${width}: app menu has ${item}`)
    eq(await appMenu.locator('a, button').count(), 6, `${width}: app menu holds only the back rooms`)
    await page.keyboard.press('Escape')
    ok(!(await appMenu.isVisible().catch(() => false)), `${width}: Esc closes the app menu`)
    eq(path(), '/', `${width}: and stays`)
    await visit(`/day/${today}`)
    await page.keyboard.press('ControlOrMeta+ArrowUp')
    await page.waitForURL((u) => u.pathname === `/calendar/${month}`)
    checks++
    for (const [n, expect] of [
      ['1', /^\/overview$/],
      ['2', /^\/n\//],
      ['3', /^\/calendar/],
      ['4', /^\/workshop$/],
      ['5', /^\/from-siena$/],
    ]) {
      await page.keyboard.press(`Control+${n}`)
      await page.waitForURL((u) => expect.test(u.pathname))
      checks++
    }

    /* 7. Under a resting mouse the pill dims where it is (October 13, third
          pass); it recedes only while scrolling down or typing. */
    await visit('/n/church')
    await page.waitForTimeout(3300)
    ok(await page.locator('.floating-nav.resting').count(), `${width}: dims after three still seconds`)
    eq(await page.locator('.floating-nav.receded').count(), 0, `${width}: and does not leave`)
    ok(!(await page.locator('.pill-handle.shown').isVisible().catch(() => false)), `${width}: so no bar stands in for it`)
    await page.mouse.move(width / 2, 40)
    await page.waitForFunction(() => !document.querySelector('.floating-nav.resting'))
    checks++
    await visit('/')
    const scrolled = await page.evaluate(async () => {
      const el = document.querySelector('.board-screen')
      if (el.scrollHeight <= el.clientHeight + 4) return 'no-scroll'
      el.scrollTop += 120
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      return document.querySelector('.floating-nav').classList.contains('receded')
    })
    if (scrolled !== 'no-scroll') {
      ok(scrolled, `${width}: recedes while scrolling down`)
      await page.waitForFunction(() => !document.querySelector('.floating-nav.receded'))
      checks++
    }

    /* 8. Today at 1440×900 fits, and the pill never covers a spine. */
    if (width === 1440) {
      await visit('/')
      const fit = await page.evaluate(() => {
        const el = document.querySelector('.board-screen')
        const nav = document.querySelector('.floating-nav').getBoundingClientRect()
        const spines = [...document.querySelectorAll('.board-books > a, .board-books > button')].map((s) => s.getBoundingClientRect())
        const meets = spines.some((s) => !(s.right <= nav.left || s.left >= nav.right || s.bottom <= nav.top || s.top >= nav.bottom))
        const clipped = [...document.querySelectorAll('.board-books strong')].some((s) => s.scrollHeight > s.clientHeight + 1 || s.scrollWidth > s.clientWidth + 1)
        return { scroll: el.scrollHeight - el.clientHeight, meets, clipped }
      })
      ok(fit.scroll <= 0, `1440×900 Today has no vertical scroll (${fit.scroll}px over)`)
      ok(!fit.meets, '1440×900 the pill does not intersect a spine')
      ok(!fit.clipped, '1440×900 no spine name is clipped')
    }

    /* 8b. Found on Joshua's own screen and in the plan audit, after release. */
    await visit('/')
    const worst = await page.locator('.board-month .cal-day-n').evaluateAll((els) =>
      Math.max(...els.map((e) => { const r = e.getBoundingClientRect(); return Math.abs(r.width - r.height) })),
    )
    ok(worst < 0.6, `${width}: every day mark on Today is a circle (worst ${worst}px)`)
    await openBack()
    const offsets = await page.locator('.pill-menu > *, .pill-sheet-back > *').evaluateAll((els) =>
      els.map((e) => Math.round(e.querySelector('svg, .colors-glyph').getBoundingClientRect().left - e.getBoundingClientRect().left)),
    )
    eq(new Set(offsets).size, 1, `${width}: app menu icons sit in one column (${offsets})`)
    await page.keyboard.press('Escape')
    if (width >= 820) {
      // Right-click stands in for the long press; both run through useLongPress.
      await page.getByRole('link', { name: 'Open Church notebook' }).click({ button: 'right' })
      await page.getByLabel('Rename Church').waitFor()
      ok(await page.locator('.manager-recolor .cover-swatch').count() > 0, `${width}: a spine opens its notebook ready to recolour`)
      eq(path(), '/', `${width}: and does not open the notebook`)
      await page.keyboard.press('Escape')
    }
    await page.evaluate(async () => {
      const { db, changed } = await import('/src/lib/db.ts')
      window.__events = await db.events.toArray()
      await db.events.clear()
      changed()
    })
    await page.waitForTimeout(300)
    eq(await page.getByRole('heading', { name: 'Coming up', exact: true }).count(), 0, `${width}: no Coming Up heading over nothing`)
    await page.evaluate(async () => {
      const { db, changed } = await import('/src/lib/db.ts')
      await db.events.bulkPut(window.__events)
      changed()
    })

    /* 9. Quick note still files exactly and keeps its draft on failure. */
    if (width === 1440 || width === 390) {
      await visit('/')
      await page.getByRole('button', { name: 'Quick note', exact: true }).click()
      const area = page.getByRole('textbox', { name: 'Quick note', exact: true })
      await area.fill('Keep this thought\nUntil I file it.')
      await page.getByRole('button', { name: 'Done', exact: true }).click()
      await page.reload()
      await page.getByRole('button', { name: 'Quick note', exact: true }).click()
      eq(await area.inputValue(), 'Keep this thought\nUntil I file it.', `${width}: quick note draft survives reload`)
      await page.getByRole('radio', { name: 'Church' }).click()
      await page.getByRole('button', { name: 'Done', exact: true }).click()
      await page.waitForFunction(async () =>
        (await (await import('/src/lib/db.ts')).livePages('church')).some((p) => p.body === 'Keep this thought\nUntil I file it.'),
      )
      checks++
      await page.getByRole('button', { name: 'Quick note', exact: true }).click()
      eq(await area.inputValue(), '', `${width}: filed draft clears`)
      await area.fill('Still here if filing fails')
      await page.keyboard.press('Escape')
      const kept = await page.evaluate(async () => {
        const q = await import('/src/lib/quick-note.ts')
        const draft = await q.readQuickNote()
        try {
          await q.closeQuickNote({ ...draft, notebook: 'missing-notebook' })
        } catch {}
        return (await q.readQuickNote()).body
      })
      eq(kept, 'Still here if filing fails', `${width}: a failed filing keeps the draft`)
    }

    /* 10. October 13, third pass. */
    // The notebook switcher's shelf is on top of the list, not clipped by it.
    if (width < 1200) {
      await visit('/n/church')
      await page.locator('.listcol').getByRole('button', { name: /switch notebook/ }).click()
      const seen = await page.locator('.listcol .notebook-switcher-menu').evaluate((m) => {
        const r = m.getBoundingClientRect()
        return m.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2))
      })
      ok(seen, `${width}: the switcher's shelf can be seen and touched`)
      await page.keyboard.press('Escape')
    }
    // A phone's room mark says where you are.
    if (phone) {
      await visit('/n/church')
      ok(/church/i.test(await page.locator('.floating-nav .pill-room').textContent()), `${width}: the room's mark names the notebook`)
      await visit(`/calendar/${month}`)
      ok(/calendar/i.test(await page.locator('.floating-nav .pill-room').textContent()), `${width}: and the room`)
    } else {
      // The room's name is a caption above the pill, under the pointer.
      await visit('/n/church')
      await pill().getByRole('link', { name: 'Calendar', exact: true }).hover()
      await page.waitForFunction(() => document.querySelector('.pill-caption.shown')?.textContent === 'Calendar')
      checks++
    }
    // + says what it makes, and where a page goes.
    await visit('/')
    await tap(pill().getByRole('button', { name: 'Add' }))
    const chooserText = (await page.getByRole('menu', { name: 'Add' }).textContent()).toLowerCase()
    for (const word of ['page', 'event', 'quick note', 'today'])
      ok(chooserText.includes(word), `${width}: the chooser says "${word}"`)
    ok((await page.getByRole('menuitem', { name: 'New page' }).locator('small').textContent()).trim().length > 0, `${width}: and names the page's notebook`)
    await page.keyboard.press('Escape')
    // Events say nothing about where they came from.
    for (const route of ['/', `/calendar/${month}`, `/day/${today}`]) {
      await visit(route)
      eq(await page.locator('.event-source-tag').count(), 0, `${width} ${route}: no source line under events`)
      const rows = (await page.locator('.event-row').allTextContents()).join(' ').toLowerCase()
      ok(!rows.includes('read only') && !rows.includes('family calendar'), `${width} ${route}: no "read only" line`)
    }
    await visit(`/calendar/${month}`)
    eq(await page.locator('.month-written-row').count(), 0, `${width}: the calendar's day sheet lists events, not pages`)
    // A chevron after a title means a menu.
    for (const [route, sel] of [
      [`/calendar/${month}`, '.month-toggle'],
      [`/day/${today}`, '.agenda-day-heading'],
      ['/workshop', '.workshop-heading'],
      ['/plan/redesign-plan', '.plan-title-button'],
    ]) {
      await visit(route)
      ok(await page.locator(`${sel} .title-chevron`).count() >= 1, `${width} ${route}: its title wears the chevron`)
    }
    eq(await page.locator('.plan-index select').count(), 0, `${width}: a plan's sections are chips, not a select`)
    // Aa opens in the toolbar's own row, with no × of its own.
    await visit('/p/redesign-page')
    await page.getByRole('button', { name: 'Style', exact: true }).click()
    eq(await page.locator('.leaf .tools .row .tray').count(), 1, `${width}: the strip opens in the toolbar's row`)
    eq(await page.locator('.tray').getByRole('button', { name: 'Close', exact: true }).count(), 0, `${width}: and Aa, not ×, closes it`)
    await page.getByRole('button', { name: 'Style', exact: true }).click()
    eq(await page.locator('.tray').count(), 0, `${width}: Aa closes it`)

    await page.screenshot({ path: `${out}/${width}-last.png` })
    eq(errors.join('\n'), '', `${width}: no runtime errors`)
    console.log(`PASS ${width}px`)
    await context.close()
  }

  /* Reduced motion swaps the pill without animating it. */
  for (const reducedMotion of ['reduce', 'no-preference']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion })
    const page = await context.newPage()
    await page.goto(BASE + '/tests/redesign-check.html')
    await page.getByRole('button', { name: 'Load redesign fixtures' }).click()
    await page.getByText('Fixtures ready').waitFor()
    await page.goto(BASE + '/n/church')
    const motion = await page.evaluate(() => {
      const nav = document.querySelector('.floating-nav')
      const body = getComputedStyle(nav, '::before').transitionDuration
      const child = getComputedStyle(nav.firstElementChild).transitionDuration
      return [body, child]
    })
    if (reducedMotion === 'reduce') eq(motion.join(), '0s,0s', 'reduced motion: the pill swaps without animation')
    else ok(motion.every((d) => parseFloat(d) > 0), 'the pill settles when motion is allowed')
    await context.close()
  }
} finally {
  await browser.close()
}
console.log(`controls-review: ${checks} assertions passed`)
