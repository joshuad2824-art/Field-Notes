// Disposable profiles and invented notes only. This test uses the local Vite
// module boundary for injected Davis projections; no production endpoint is read.
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
const { chromium, devices } = await import(`${execSync('npm root -g', { encoding: 'utf8' }).trim()}/playwright/index.mjs`)
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173'
const browser = await chromium.launch()
const out = '../evidence/integration-2026-10-06/desk'
await mkdir(out, { recursive: true })
async function seed(page) {
  return page.evaluate(async () => {
    const { db, changed } = await import('/src/lib/db.ts')
    const now = Date.now()
    const row = (id, body, updated = now) => ({ id, body, updated, created: now - 1000, pinned: 0, notebook: 'field-notes' })
    const canvas = document.createElement('canvas'); canvas.width = 1640; canvas.height = 940
    const c = canvas.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, 1640, 940)
    c.strokeStyle = '#142a2b'; c.lineWidth = 5; c.strokeRect(200, 170, 1200, 500)
    c.fillStyle = '#142a2b'; c.font = '48px sans-serif'; c.fillText('Shelf reference — 600 mm × 250 mm', 220, 110)
    c.fillText('600 mm', 650, 770); c.fillText('250 mm', 50, 440)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    await db.pages.bulkPut([
      row('test-project', '# Reading shelf\n#project\nProject: Reading shelf\nStatus: active\nOwner: Joshua\nWhere we left off: Chose the oak finish.\nNext step: Check the wall measurements.\nArtifact: Shelf drawing'),
      row('test-project-old', '# Reading shelf\n#project\nProject: Reading shelf\nStatus: active\nNext step: Old step', now - 100),
      row('test-project-2', '# Garden labels\n#project\nStatus: active\nOwner: Together\nNext step: Choose the label size.'),
      row('test-plan', '# Shelf drawing\n#project-plan\nProject: Reading shelf\nVersion: 2\n\n## Dimensions\nUnits: mm\nWidth: 600 mm\nDepth: 250 mm\n\n| Part | Width (mm) | Depth (mm) |\n| --- | --- | --- |\n| Shelf | 600 | 250 |\n\n![Shelf measurements](images/test-plan-image.png){full}\n\nReference image only. Scale has not been calibrated.'),
      row('test-plan-old', '# Earlier shelf drawing\n#project-plan\nProject: Reading shelf\nVersion: 1', now - 100),
      row('test-owned', '# Label maker\n#owned\nOwnership: confirmed\nBrand: unknown\nModel: unknown'),
    ])
    await db.images.put({ id: 'test-plan-image', page: 'test-plan', blob, type: 'image/png', ext: 'png', added: now })
    changed()
    return { pages: await db.pages.toArray(), hash: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))).join(','), bytes: blob.size }
  })
}
async function snapshot(page) { return page.evaluate(async () => (await import('/src/lib/db.ts')).db.pages.toArray()) }
async function inject(page, mode) {
  await page.evaluate(async (mode) => {
    const { davisAgenda: store } = await import('/src/davis/agenda.ts')
    const snapshot = { accountId: 'test-account', householdId: 'test-household', householdName: 'Disposable family', timezone: 'America/Chicago', today: '2026-10-02', fetchedAt: '2026-10-02T17:00:00Z', entries: mode === 'empty' ? [] : [
      { sourceId: 'event-1-occurrence', version: '1', title: 'Family weekend', kind: 'event', startDate: '2026-10-02', endDate: '2026-10-04', owner: 'Together', audience: 'Household' },
      { sourceId: 'reminder-1', version: '1', title: 'Return library book', kind: 'reminder', startDate: '2026-10-01', owner: 'Joshua' },
      { sourceId: 'reminder-1', version: '1', title: 'Return library book', kind: 'reminder', startDate: '2026-10-01', owner: 'Joshua' },
    ] }
    if (mode === 'stale') { store.markStale(); return }
    if (mode === 'account-change') { store.connect('different-account', async () => ({ status: 200, snapshot })); return }
    if (mode === 'offline') { await store.refresh(false); return }
    if (mode === 'error') { store.connect('test-account', async () => { throw new Error('Test failure') }); await store.refresh(); return }
    if (mode === 'denied') { store.connect('test-account', async () => ({ status: 403 })); await store.refresh(); return }
    store.connect('test-account', async () => mode === 'loading' ? new Promise(() => {}) : ({ status: 200, snapshot }))
    if (mode !== 'loading') await store.refresh()
  }, mode)
}
try {
  for (const [name, options] of [['desktop', { viewport: { width: 1600, height: 1100 }, permissions: ['clipboard-read', 'clipboard-write'] }], ['tablet', { ...devices['iPad (gen 7)'], defaultBrowserType: undefined }], ['phone', { ...devices['iPhone 13'], defaultBrowserType: undefined }]]) {
    const context = await browser.newContext(options)
    await context.route('**/*', (route) => new URL(route.request().url()).origin === new URL(BASE).origin ? route.continue() : route.abort())
    const page = await context.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(BASE); await page.getByRole('heading', { name: 'At the desk.' }).waitFor()
    const before = await seed(page)
    const capped = await page.evaluate(async () => {
      const { projectDesk } = await import('/src/lib/project-desk.ts')
      const rows = Array.from({ length: 5 }, (_, i) => ({ id: String(i), body: `# Project ${i}\n#project\nStatus: active`, notebook: 'field-notes', pinned: 0, created: 1, updated: i }))
      return projectDesk(rows).active.map((p) => p.id)
    })
    assert.deepEqual(capped, ['4', '3', '2'])
    await page.locator('.desk-project').first().waitFor()
    assert.equal(await page.locator('.desk-project').count(), 2)
    assert.equal(await page.locator('.desk-plan-link').count(), 1)
    assert.equal(await page.locator('.workshop-item').count(), 0, 'Inventory moved off dashboard')
    await page.goto(`${BASE}/workshop`); await page.locator('.workshop-item').waitFor(); assert.equal(await page.locator('.workshop-item').count(), 1)
    await page.goto(BASE); await page.getByRole('heading', { name: 'At the desk.' }).waitFor()
    assert.equal(await page.locator('.davis-agenda').getAttribute('data-state'), 'setup')
    await inject(page, 'ready'); await page.getByText('Family weekend', { exact: true }).first().waitFor()
    assert.equal(await page.locator('.davis-entries li').count(), 4)
    await page.getByText('Overdue reminder · 2026-10-01', { exact: true }).waitFor()
    assert.ok(await page.locator('.overview-forecast').evaluate(el => el.getBoundingClientRect().bottom) <= await page.locator('.overview-from-siena').evaluate(el => el.getBoundingClientRect().top), 'Forecast precedes journal')
    const activate = (locator) => options.hasTouch ? locator.tap() : locator.click()
    await activate(page.getByRole('button', { name: 'Ask Siena', exact: true }))
    const dialog = page.getByRole('dialog', { name: 'Ask Siena' })
    await page.getByLabel('Include a saved page').selectOption('test-project')
    await page.getByLabel('What would you like to work on?').fill('Check these shelf measurements with me.')
    if (name === 'desktop') {
      await page.keyboard.press('Tab')
      assert.equal(await dialog.evaluate((el) => el.contains(document.activeElement)), true)
    }
    const preview = await page.getByLabel('Exact request preview').textContent()
    assert.match(preview, /Check these shelf measurements with me\./)
    assert.match(preview, /Page ID: test-project/)
    await page.evaluate(() => { window.__copied = ''; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value) => { window.__copied = value } } }) })
    await activate(dialog.getByRole('button', { name: 'Copy request', exact: true }))
    await page.getByText('Copied. Paste this request into your conversation with Siena.').waitFor()
    assert.equal(await page.evaluate(() => window.__copied), preview)
    await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Denied') } } }) })
    await activate(dialog.getByRole('button', { name: 'Copy request', exact: true }))
    await page.getByText(/Copy failed\. Your request is still here/).waitFor()
    assert.equal(await page.getByLabel('What would you like to work on?').inputValue(), 'Check these shelf measurements with me.')
    await page.screenshot({ path: `${out}/request-${name}.png`, fullPage: true })
    if (name === 'desktop') { await page.keyboard.press('Escape') } else { await activate(page.getByRole('button', { name: 'Close request' })) }
    await dialog.waitFor({ state: 'detached' })
    assert.equal(await page.getByRole('button', { name: 'Ask Siena', exact: true }).evaluate((el) => document.activeElement === el), true)
    await activate(page.getByRole('button', { name: 'Ask Siena', exact: true }))
    await dialog.waitFor()
    if (options.hasTouch) await page.touchscreen.tap(1, 1)
    else await page.mouse.click(1, 1)
    await dialog.waitFor({ state: 'detached' })
    assert.equal(await page.getByRole('button', { name: 'Ask Siena', exact: true }).evaluate((el) => document.activeElement === el), true)
    assert.deepEqual(await snapshot(page), before.pages)
    await page.screenshot({ path: `${out}/desk-${name}.png`, fullPage: true })
    if (name !== 'desktop') {
      await page.locator('.desk-projects').scrollIntoViewIfNeeded()
      await page.screenshot({ path: `${out}/desk-projects-${name}.png`, fullPage: true })
    }
    await page.goto(`${BASE}/plan/test-plan`); await page.getByText('1640 × 940 px · Original file', { exact: false }).waitFor()
    assert.equal(await page.locator('.plan-image img').evaluate((img) => img.naturalWidth), 1640)
    assert.equal(await page.locator('.plan-paper').evaluate((el) => el.scrollWidth <= el.clientWidth), true)
    assert.equal(await page.locator('.plan-text table').evaluate((el) => el.scrollWidth <= el.clientWidth), true)
    const original = await page.evaluate(async () => {
      const href = document.querySelector('.plan-image a').href
      const blob = await (await fetch(href)).blob()
      return { hash: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))).join(','), bytes: blob.size }
    })
    assert.equal(original.hash, before.hash); assert.equal(original.bytes, before.bytes)
    assert.deepEqual(await snapshot(page), before.pages)
    await page.screenshot({ path: `${out}/plan-${name}.png`, fullPage: true })
    if (name === 'desktop') {
      await page.pdf({ path: `${out}/plan-desktop.pdf`, format: 'Letter', printBackground: true })
      await page.emulateMedia({ media: 'print' })
      assert.equal(await page.locator('.plan-tools').isVisible(), false)
      await page.screenshot({ path: `${out}/plan-print.png`, fullPage: true })
      await page.emulateMedia({ media: 'screen' })
    }
    await page.goto(BASE)
    await inject(page, 'loading'); assert.equal(await page.locator('.davis-agenda').getAttribute('data-state'), 'loading')
    await inject(page, 'empty'); await page.getByText('No events or incomplete reminders in this fetched window.').waitFor()
    await inject(page, 'ready'); await inject(page, 'stale'); await page.getByText(/previously fetched items/).waitFor()
    await inject(page, 'offline'); await page.getByText('You’re offline. Davis could not be refreshed; any shown items are stale.').waitFor()
    assert.equal(await page.locator('.davis-entries li').count(), 4)
    await inject(page, 'error'); await page.getByText(/This does not mean your calendar is empty/).waitFor()
    assert.equal(await page.getByText('No events or incomplete reminders in this fetched window.').count(), 0)
    await inject(page, 'ready'); await inject(page, 'account-change'); assert.equal(await page.getByText('Family weekend', { exact: true }).count(), 0)
    await inject(page, 'ready'); await inject(page, 'denied'); assert.equal(await page.getByText('Family weekend', { exact: true }).count(), 0)
    await inject(page, 'ready'); await activate(page.getByRole('button', { name: 'Disconnect Davis' })); assert.equal(await page.getByText('Family weekend', { exact: true }).count(), 0)
    assert.deepEqual(await snapshot(page), before.pages)
    assert.deepEqual(errors, [])
    console.log(`PASS ${name}: request failure/preview/focus, linked projects and revisions, original image bytes, read-only plan, Davis loading/empty/stale/offline/error/revocation/account change/disconnect`)
    await context.close()
  }
} finally { await browser.close() }
