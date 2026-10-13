import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const { chromium } = await import(
  `${execSync('npm root -g', { encoding: 'utf8' }).trim()}/playwright/index.mjs`
)
const BASE = process.env.BASE || 'http://127.0.0.1:5188'
if (!['localhost', '127.0.0.1'].includes(new URL(BASE).hostname))
  throw Error('Local fixtures only')
const out = 'work/2026-10-12-pdf-adjustments/verified'
mkdirSync(out, { recursive: true })
const b = await chromium.launch()
try {
  for (const width of [1920, 1440, 1180, 820, 390, 320]) {
    const c = await b.newContext({ viewport: { width, height: 900 } })
    await c.route('**/*', (r) =>
      new URL(r.request().url()).origin === BASE ? r.continue() : r.abort(),
    )
    const p = await c.newPage()
    const errors = []
    p.on('pageerror', (e) => errors.push(e.message))
    await p.goto(BASE + '/tests/redesign-check.html')
    await p.getByRole('button', { name: 'Load redesign fixtures' }).click()
    await p.getByText('Fixtures ready').waitFor()
    const visit = async (path) => {
      await p.goto(BASE + path)
      await p.waitForTimeout(200)
      await p.evaluate(() => document.fonts.ready)
    }
    await visit('/')
    await p.getByRole('button', { name: 'Quick note', exact: true }).click()
    const area = p.getByRole('textbox', { name: 'Quick note', exact: true })
    await area.fill('Keep this thought\nUntil I file it.')
    await p.getByRole('button', { name: 'Close quick note' }).click()
    await p.reload()
    await p.getByRole('button', { name: 'Quick note', exact: true }).click()
    await assert.equal(await area.inputValue(), 'Keep this thought\nUntil I file it.')
    // October 13: the notebook picker is a row of dots; the filing path is the same.
    await p.getByRole('radio', { name: 'Church', exact: true }).click()
    await p.getByRole('button', { name: 'Close quick note' }).click()
    await p.waitForFunction(async () =>
      (await (await import('/src/lib/db.ts')).livePages('church')).some(
        (p) => p.body === 'Keep this thought\nUntil I file it.',
      ),
    )
    await p.getByRole('button', { name: 'Quick note', exact: true }).click()
    assert.equal(await area.inputValue(), '')
    await p.keyboard.press('Escape')
    assert.equal(await p.locator('.week-strip a').count(), 14)
    /* October 13: the pill is identical everywhere, Calendar included; Today's
       + offers page · event · quick note; the month's name switches to the day
       agenda and the day's heading back to its month; Colors is in the app
       menu now that the calendar's own tools have retired. */
    assert.equal(await p.locator('.floating-nav [aria-label=Calendar]').count(), 1)
    await p.locator('.floating-nav').getByRole('button', { name: 'Add', exact: true }).click()
    await p.getByRole('menuitem', { name: 'New event', exact: true }).click()
    await p.waitForURL(/\/event\/new/)
    await visit('/calendar/2026-10')
    assert.equal(await p.locator('.floating-nav').count(), 1)
    await p.getByRole('button', { name: /open the day agenda/ }).click()
    await p.waitForURL(/\/day\//)
    // On a phone the heading is in the day sheet, which opens on a tapped day.
    if (!(await p.locator('.agenda-day-heading').isVisible()))
      await p.locator('.agenda-date button').first().click()
    await p.locator('.agenda-day-heading').click()
    await p.waitForURL(/\/calendar\//)
    await p.getByRole('button', { name: 'App menu' }).click()
    await p.getByRole('button', { name: 'Colors', exact: true }).click()
    await p.getByRole('button', { name: 'Heather', exact: true }).waitFor()
    await p.keyboard.press('Escape')
    for (const path of [
      '/',
      '/calendar/2026-10',
      '/day/2026-10-12',
      '/workshop',
      '/plan/redesign-plan',
      '/p/redesign-page',
      '/n/d97288df-10bc-451f-8903-82d4e0c74873/desk',
      '/event/redesign-event',
    ]) {
      await visit(path)
      const bad = await p.evaluate(() =>
        [...document.querySelectorAll('main,.board-tile,.month-cell,.plan-section')]
          .filter((e) => e.clientWidth && e.scrollWidth > e.clientWidth + 2)
          .map((e) => e.className),
      )
      assert.deepEqual(bad, [], `${width} ${path} fits`)
      if (path.startsWith('/p/')) {
        await p.locator('.cm-content').click()
        assert.equal(
          await p.locator('.cm-content').evaluate((e) => getComputedStyle(e).boxShadow),
          'none',
        )
        await p.getByRole('button', { name: 'Style', exact: true }).click()
      }
      await p.screenshot({ path: `${out}/${width}-${path.replaceAll('/', '_')}.png` })
    }
    if (width === 1440) {
      await visit('/')
      await p.getByRole('button', { name: 'Quick note', exact: true }).click()
      await p
        .getByRole('textbox', { name: 'Quick note', exact: true })
        .fill('Still here if filing fails')
      await p.screenshot({ path: out + '/quick-note-dialog.png' })
      await p.keyboard.press('Escape')
      const result = await p.evaluate(async () => {
        const q = await import('/src/lib/quick-note.ts')
        const draft = await q.readQuickNote()
        try {
          await q.closeQuickNote({ ...draft, notebook: 'missing-notebook' })
        } catch {}
        return (await q.readQuickNote()).body
      })
      assert.equal(result, 'Still here if filing fails')
      await p.evaluate(async () => {
        const { db, changed } = await import('/src/lib/db.ts')
        await db.events.clear()
        await db.sienaItems.update('redesign-note', {
          body: 'A full message.\n'.repeat(50) + 'End of the complete message.',
        })
        changed()
      })
      await p.reload()
      /* October 13: with nothing on and nothing coming, the first card carries
         no headings at all — Coming Up lists only dates with events. */
      await p.locator('.board-day').waitFor()
      await p.waitForTimeout(300)
      assert.equal(await p.getByRole('heading', { name: 'Coming up', exact: true }).count(), 0)
      assert.equal(await p.locator('.board-today-schedule, .quiet-day').count(), 0)
      assert.equal(
        await p.locator('.board-day').getByText('Nothing', { exact: false }).count(),
        0,
      )
      const note = p.locator('.board-siena p')
      assert.ok((await note.textContent()).endsWith('End of the complete message.'))
      assert.ok(await note.evaluate((e) => e.scrollHeight <= e.clientHeight + 2))
      await p.screenshot({ path: out + '/quiet-day-long-message.png' })
    }
    assert.deepEqual(errors, [])
    await c.close()
    console.log(
      `PASS ${width}px quick-note persistence and filing, calendar navigation, full layout, focus and runtime`,
    )
  }
} finally {
  await b.close()
}
