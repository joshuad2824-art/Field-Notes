import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
const { chromium } = await import(
  `${execSync('npm root -g', { encoding: 'utf8' }).trim()}/playwright/index.mjs`
)
const BASE = process.env.BASE ?? 'http://127.0.0.1:5188'
if (!['localhost', '127.0.0.1'].includes(new URL(BASE).hostname))
  throw Error('Local unpaired fixtures only')
const browser = await chromium.launch()
try {
  for (const width of [1440, 1180, 820, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      hasTouch: width < 1200,
    })
    await context.route('**/*', (r) =>
      new URL(r.request().url()).origin === new URL(BASE).origin ? r.continue() : r.abort(),
    )
    const page = await context.newPage(),
      errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.setDefaultTimeout(10000)
    await page.goto(BASE + '/tests/redesign-check.html')
    await page.getByRole('button', { name: 'Load redesign fixtures' }).click()
    await page.getByText('Fixtures ready').waitFor()
    const visit = async (path) => {
      await page.goto(BASE + path)
      await page.waitForTimeout(250)
    }
    const fit = async () =>
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${width}px fits`,
      )
    await visit('/')
    /* October 13: the five rooms are in the pill itself and the app menu holds
       the back rooms, so all eight destinations are still one tap away. */
    for (const name of ['Today', 'Notebooks', 'Calendar', 'Workshop', 'From Siena'])
      assert.ok(
        await page.locator('.floating-nav').getByRole('link', { name, exact: true }).isVisible(),
      )
    await page.getByRole('button', { name: 'App menu' }).click()
    for (const name of ['Search', 'Settings', 'Trash'])
      assert.ok(
        await page.locator('.pill-menu').getByRole('link', { name, exact: true }).isVisible(),
      )
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('.pill-menu').count(), 0)
    await page.getByRole('button', { name: 'App menu' }).click()
    await page
      .locator('.pill-menu')
      .getByRole('button', { name: 'Manage notebooks', exact: true })
      .click()
    const dialog = page.getByRole('dialog')
    await dialog.waitFor()
    assert.ok(
      !(await dialog.locator('.manager-name').allTextContents()).includes('Journal'),
      'Reserved Journal stays protected',
    )
    await page.keyboard.press('Escape')
    await visit('/calendar/2026-10')
    await page.getByRole('button', { name: 'Next month', exact: true }).click()
    await page.waitForURL(/2026-11$/)
    await page.reload()
    await page.getByRole('heading', { name: 'November 2026' }).waitFor()
    await fit()
    await visit('/p/redesign-page')
    await page.locator('.cm-content').waitFor()
    await fit()
    if (width === 1440) {
      // October 13: the sidebar footer retired; Colors is in the app menu.
      await page.getByRole('button', { name: 'App menu' }).click()
      await page.locator('.pill-menu').getByRole('button', { name: 'Colors', exact: true }).click()
      await page.getByRole('button', { name: /^night/ }).click()
      await page.waitForFunction(
        () => document.querySelector('.leaf')?.dataset.stock === 'paper',
      )
      await page.keyboard.press('Escape')
      await page.reload()
      await page.locator('.leaf[data-stock=paper]').waitFor()
      await page.getByRole('button', { name: 'Hide the notebooks', exact: true }).click()
      await page.getByRole('button', { name: 'Show the notebooks', exact: true }).click()
      assert.ok(await page.locator('.board-sidebar').isVisible())
    }
    await visit('/from-siena')
    await page
      .locator('.siena-reminders')
      .getByRole('button', { name: 'Mark done', exact: true })
      .first()
      .click()
    await page.waitForFunction(
      async () =>
        !!(await (await import('/src/lib/db.ts')).db.sienaItems.get('redesign-reminder'))
          .completedAt,
    )
    await page.reload()
    await page.getByText(/Completed reminders · 2/).waitFor()
    await fit()
    await visit('/trash')
    await page.getByRole('button', { name: 'Restore', exact: true }).click()
    await page.getByRole('heading', { name: 'The trash is empty.' }).waitFor()
    assert.equal(
      await page.evaluate(
        async () =>
          (await (await import('/src/lib/db.ts')).db.pages.get('redesign-trash')).deleted,
      ),
      undefined,
    )
    await page.evaluate(async () => {
      const { deletePage } = await import('/src/lib/db.ts')
      await deletePage('redesign-trash')
    })
    await page.getByRole('button', { name: 'Empty trash', exact: true }).click()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    assert.ok(await page.getByText('Old grocery list', { exact: true }).isVisible())
    await page.getByRole('button', { name: 'Empty trash', exact: true }).click()
    await page.getByRole('button', { name: 'Delete permanently', exact: true }).click()
    await page.getByRole('heading', { name: 'The trash is empty.' }).waitFor()
    await fit()
    await visit('/search')
    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('ministry')
    await page.getByRole('button', { name: 'Events', exact: true }).click()
    await page.locator('.search-hit').first().waitFor()
    assert.equal(await page.locator('.search-hit').count(), 2)
    await fit()
    await visit('/settings')
    await fit()
    assert.ok(await page.locator('#settings-sync').isVisible())
    assert.ok(
      (await page.getByRole('button', { name: 'Whole shelf', exact: true }).count()) ||
        (await page.getByRole('button', { name: /Export/ }).count()),
    )
    assert.deepEqual(errors, [])
    console.log(
      `PASS ${width}px: destinations, protected Journal, month reload, page controls, reminder completion, restore, confirmed trash empty, event search, settings and fit`,
    )
    await context.close()
  }
} finally {
  await browser.close()
}
