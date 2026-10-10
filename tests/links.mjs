import { execSync } from 'node:child_process'

const { chromium } = await import(`${execSync('npm root -g', { encoding: 'utf8' }).trim()}/playwright/index.mjs`)
const browser = await chromium.launch()
const base = process.env.BASE ?? 'http://127.0.0.1:4173'

async function savedBody(page, id) {
  return page.evaluate(async (id) => {
    const request = indexedDB.open('field-notes')
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const tx = db.transaction('pages', 'readonly')
    const item = tx.objectStore('pages').get(id)
    const row = await new Promise((resolve, reject) => {
      item.onsuccess = () => resolve(item.result)
      item.onerror = () => reject(item.error)
    })
    db.close()
    return row?.body
  }, id)
}

async function run(name, options) {
  const context = await browser.newContext(options)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${base}/n/field-notes`)
  await page.getByRole('button', { name: 'New page', exact: true }).first().click()
  await page.locator('.cm-content').waitFor()
  const id = new URL(page.url()).pathname.split('/').pop()
  await page.locator('.cm-content').fill('Watercolor notebook')
  await page.locator('.cm-content').press('Home')
  await page.locator('.cm-content').press('Shift+End')
  await page.getByRole('button', { name: 'Style', exact: true }).click()
  await page.getByRole('button', { name: 'Link', exact: true }).click()
  const dialog = page.getByRole('form', { name: 'Add link' })
  await dialog.getByLabel('URL').fill('https://example.com/a/very/long/path?item=123&source=field-notes')
  await dialog.getByRole('button', { name: 'Save link' }).click()
  let anchor = page.locator('.md-link')
  await anchor.waitFor()
  if (await anchor.textContent() !== 'Watercolor notebook') throw new Error(`${name}: wrong label`)
  if ((await page.locator('.cm-content').textContent())?.includes('example.com')) throw new Error(`${name}: URL shown in writing`)
  await page.waitForTimeout(700)
  const first = await savedBody(page, id)
  if (first !== '[Watercolor notebook](https://example.com/a/very/long/path?item=123&source=field-notes)') throw new Error(`${name}: wrong stored Markdown: ${first}`)

  await page.goto(`${base}/n/field-notes`)
  const listing = page.locator('.list-row', { hasText: 'Watercolor notebook' }).first()
  await listing.waitFor()
  if ((await listing.textContent())?.includes('example.com')) throw new Error(`${name}: URL shown in page list`)

  await page.goto(`${base}/p/${id}`)
  anchor = page.locator('.md-link')
  await anchor.waitFor()
  if (await anchor.getAttribute('href') !== 'https://example.com/a/very/long/path?item=123&source=field-notes') throw new Error(`${name}: link missing after reopen`)
  await page.evaluate(() => {
    window.__linkClickCount = 0
    document.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('.md-link')) window.__linkClickCount++
    }, true)
  })
  const popupPromise = page.waitForEvent('popup', { timeout: 5000 })
  if (options.isMobile) await anchor.tap()
  else await anchor.click()
  const popup = await popupPromise.catch(async () => {
    throw new Error(`${name}: link click did not open; clicks=${await page.evaluate(() => window.__linkClickCount)}, pages=${context.pages().length}`)
  })
  await popup.waitForLoadState('domcontentloaded')
  if (!popup.url().startsWith('https://example.com/a/very/long/path')) throw new Error(`${name}: tap did not open URL`)
  await popup.close()

  await page.getByRole('button', { name: 'Style', exact: true }).click()
  await page.getByRole('button', { name: 'Link', exact: true }).click()
  const edit = page.getByRole('form', { name: 'Edit link' })
  await edit.getByLabel('URL').fill('https://example.org/changed')
  await edit.getByRole('button', { name: 'Save link' }).click()
  await page.waitForTimeout(700)
  if (await savedBody(page, id) !== '[Watercolor notebook](https://example.org/changed)') throw new Error(`${name}: editing lost text`)
  await page.getByRole('button', { name: 'Link', exact: true }).click()
  await page.getByRole('form', { name: 'Edit link' }).getByRole('button', { name: 'Remove link' }).click()
  await page.waitForTimeout(700)
  if (await savedBody(page, id) !== 'Watercolor notebook') throw new Error(`${name}: removing lost text`)

  /* Reopen an older Markdown page with plain retail URLs. Adding one link must
     leave every original character in those URLs untouched. */
  const oldId = crypto.randomUUID()
  const oldBody = '# Want list\n- Watercolor notebook\n- https://a.co/d/abc123\n- https://www.amazon.com/example?ref=long&item=2'
  await page.evaluate(async ({ oldId, oldBody }) => {
    const request = indexedDB.open('field-notes')
    const db = await new Promise((resolve) => { request.onsuccess = () => resolve(request.result) })
    const tx = db.transaction('pages', 'readwrite')
    tx.objectStore('pages').put({ id: oldId, notebook: 'field-notes', body: oldBody, created: Date.now(), updated: Date.now(), pinned: 0 })
    await new Promise((resolve) => { tx.oncomplete = resolve })
    db.close()
  }, { oldId, oldBody })
  await page.goto(`${base}/p/${oldId}`)
  await page.locator('.cm-content').waitFor()
  if (await savedBody(page, oldId) !== oldBody) throw new Error(`${name}: opening changed existing note`)
  await page.locator('.cm-line').nth(1).click()
  await page.locator('.cm-content').press('Home')
  await page.locator('.cm-content').press('ArrowRight')
  await page.locator('.cm-content').press('Shift+End')
  await page.getByRole('button', { name: 'Style', exact: true }).click()
  await page.getByRole('button', { name: 'Link', exact: true }).click()
  await page.getByRole('form', { name: 'Add link' }).getByLabel('URL').fill('https://example.com/notebook')
  await page.getByRole('form', { name: 'Add link' }).getByRole('button', { name: 'Save link' }).click()
  await page.waitForTimeout(700)
  const changed = await savedBody(page, oldId)
  if (!changed.includes('- [Watercolor notebook](https://example.com/notebook)')) throw new Error(`${name}: existing list line changed: ${changed}`)
  if (!changed.includes('https://a.co/d/abc123') || !changed.includes('https://www.amazon.com/example?ref=long&item=2')) throw new Error(`${name}: existing URLs changed`)
  await page.reload()
  const oldLink = page.locator('.md-link')
  await oldLink.waitFor()
  if (await oldLink.count() !== 1) throw new Error(`${name}: existing note link missing after reopen`)
  const oldPopupPromise = page.waitForEvent('popup', { timeout: 5000 })
  if (options.isMobile) await oldLink.tap()
  else await oldLink.click()
  const oldPopup = await oldPopupPromise
  await oldPopup.waitForLoadState('domcontentloaded')
  if (!oldPopup.url().startsWith('https://example.com/notebook')) throw new Error(`${name}: existing note link did not open`)
  await oldPopup.close()
  if (errors.length) throw new Error(`${name}: ${errors.join('; ')}`)
  await context.close()
  console.log(`PASS ${name}: create, save, reopen, tap, edit, remove, existing note`)
}

try {
  await run('Mac layout', { viewport: { width: 1440, height: 900 } })
  await run('iPhone layout', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 })
} finally {
  await browser.close()
}
