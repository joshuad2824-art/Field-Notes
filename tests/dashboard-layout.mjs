import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { execSync } from 'node:child_process'

let playwright
try { playwright = await import('playwright') }
catch { playwright = await import(`${execSync('npm root -g', { encoding: 'utf8' }).trim()}/playwright/index.mjs`) }
const BASE = process.env.BASE ?? 'http://127.0.0.1:4321'
const out = process.env.LAYOUT_SCREENSHOTS
if (out) await mkdir(out, { recursive: true })
const browser = await playwright.chromium.launch()
try {
  for (const width of [1920, 1485, 1024, 768, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 1006 } })
    await context.route('**/*', route => new URL(route.request().url()).origin === new URL(BASE).origin ? route.continue() : route.abort())
    await context.addInitScript(() => {
      const today = new Date(), at = Date.now()
      const date = i => { const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
      localStorage.setItem('field-notes.weather.unit', 'F')
      localStorage.setItem('field-notes.weather', JSON.stringify({ temp: 74, code: 0, isDay: true, high: 74, low: 52, unit: 'F', at, daily: Array.from({ length: 7 }, (_, i) => ({ date: date(i), code: i % 3, high: 74 + i, low: 52 + i, rainChance: i * 5 })) }))
    })
    const page = await context.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(BASE)
    await page.getByRole('heading', { name: 'At the desk.', exact: true }).waitFor()
    const note = 'The sketch and the decisions are saved together, ready for the next small step. Start with the measurements, then try the idea with materials already on hand.\n\nThere’s room for the full note here, and the reminders are close by when you need them. Projects and plans sit just below the notebook, ready to pick up where you left off.'
    await page.evaluate(async body => {
      const { db, changed } = await import('/src/lib/db.ts'), at = Date.now()
      await db.sienaItems.bulkPut([
        { id: 'layout-note', type: 'note', title: 'A little room for the next idea.', body, created: at, updated: at },
        ...Array.from({ length: 15 }, (_, i) => ({ id: `layout-reminder-${i}`, type: 'reminder', title: ['Measure the book before choosing the board.', 'Try the finish on a small offcut.', 'Gather the canvas and lining samples.'][i % 3] + ` (${i + 1})`, body: 'Sample reminder for local layout review.', created: at - i, updated: at, dueAt: at - 3600000 * i })),
      ])
      changed()
    }, note)
    await page.getByRole('heading', { name: 'A little room for the next idea.' }).waitFor()
    await page.evaluate(() => document.fonts.ready)
    assert.equal(await page.locator('.fn-notebook .siena-item-body').textContent(), note)
    assert.equal(await page.locator('.fn-open-reminder .reminder-compact').count(), 15)
    assert.equal(await page.locator('.davis-agenda').count(), 1)
    assert.equal(await page.locator('.davis-agenda').getByText('Read only', { exact: true }).count(), 0)
    const geometry = () => page.evaluate(() => {
      const box = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width } }
      return { book: box('.fn-notebook'), reminders: box('.fn-side-column'), projects: box('.fn-desk-projects'), plans: box('.fn-plans') }
    })
    const g = await geometry()
    if (width >= 1280) {
      assert.ok(Math.abs(g.book.y - g.reminders.y) <= 12, 'Reminders start beside the notebook')
      assert.ok(g.reminders.x > g.book.right, 'Notebook leaves room for reminders')
      assert.ok(g.projects.y - g.book.bottom <= 40, 'Long reminders do not stretch an empty project row')
      assert.ok(g.plans.y - g.projects.bottom <= 40, 'Empty projects do not waste vertical space')
      assert.ok(g.projects.y < g.reminders.bottom, 'Projects flow while the reminder stack continues')
      const list = page.getByRole('region', { name: 'Due reminders' })
      assert.equal(await list.evaluate(el => el.scrollHeight > el.clientHeight), true, 'Long reminders have their own scroll area')
      await list.focus()
      await page.keyboard.press('End')
      await page.waitForFunction(() => { const el = document.querySelector('.fn-reminder-items'); return el.scrollTop >= el.scrollHeight - el.clientHeight - 2 })
      await list.evaluate(el => { el.scrollTo({ top: 0, behavior: 'instant' }); el.blur() })
      await page.waitForFunction(() => document.querySelector('.fn-reminder-items').scrollTop === 0)
    } else {
      assert.ok(g.reminders.y >= g.book.bottom, 'Stacked reminders follow the notebook')
      assert.ok(g.projects.y >= g.reminders.bottom, 'Reminders appear before projects on smaller screens')
      assert.ok(g.plans.y - g.projects.bottom <= 40)
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true)
    // The reminder paper's rotated backing sheet deliberately extends its box.
    for (const selector of ['.fn-shell', '.fn-notebook', '.fn-desk-projects', '.fn-plans']) {
      assert.equal(await page.locator(selector).evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, `${width}: ${selector} fits`)
    }
    if (out && [1920, 768, 390].includes(width)) {
      await page.evaluate(() => {
        const label = document.createElement('p')
        label.textContent = 'LOCAL PREVIEW · SAMPLE NOTES AND FORECAST'
        label.style.cssText = 'font:10px/1.4 var(--font-mono);color:#c5ae67;margin:12px 0 0'
        document.querySelector('.overview-wrap').prepend(label)
      })
      await page.screenshot({ path: `${out}/Field-Notes-Updated-${width}.png` })
      if (width === 1920) {
        await page.addStyleTag({ content: '.fn-app .fn-shell{overflow:visible!important}.approved-application,.approved-content,.approved-content>.app,#root,body,html{height:auto!important;position:relative!important;overflow:visible!important}.fn-rail{position:sticky;top:0;align-self:start;height:100vh}' })
        await page.screenshot({ path: `${out}/Field-Notes-Updated-Desktop.png`, fullPage: true })
        await page.locator('style').last().evaluate(el => el.remove())
      }
    }
    await page.evaluate(async () => {
      const { db, changed } = await import('/src/lib/db.ts'), at = Date.now()
      await db.pages.bulkPut([
        { id: 'layout-project', body: '# A saved project\n#project\nStatus: active\nNext step: Measure the materials.\n\n- [ ] Take the first measurement', notebook: 'field-notes', created: at, updated: at, pinned: 0 },
        { id: 'layout-plan', body: '# A saved plan\n#project-plan\nProject: A saved project\nVersion: 1\n\nThe saved plan stays linked.', notebook: 'field-notes', created: at, updated: at, pinned: 0 },
      ])
      changed()
    })
    await page.locator('.fn-project-card').waitFor()
    await page.locator('.fn-plan-print').waitFor()
    if (width >= 1280) assert.ok((await geometry()).plans.y - (await geometry()).projects.bottom <= 40, 'Populated projects retain natural spacing')
    assert.deepEqual(errors, [])
    console.log(`PASS ${width}px: full note, long reminders, compact empty/populated projects, retained Davis panel`)
    await context.close()
  }
} finally { await browser.close() }
