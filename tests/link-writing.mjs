/* Link creation followed by ordinary writing, tested in fresh local profiles. */
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
const { chromium } = await import(`${execSync('npm root -g', { encoding: 'utf8' }).trim()}/playwright/index.mjs`)
const browser = await chromium.launch()
const base = process.env.BASE ?? 'http://127.0.0.1:4173'
const url = 'https://pegandawlbuilt.com/collections/bags?source=notes'
const markdown = `[Peg and Awl](${url})`

async function run(name, options) {
  const context = await browser.newContext(options)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const activate = locator => options.hasTouch ? locator.tap() : locator.click()
  const editor = page.locator('.cm-content')
  const visible = async () => (await page.locator('.cm-line').allTextContents()).join('\n')
  const toggle = page.getByRole('button', { name: 'Style', exact: true })
  const read = () => page.evaluate(async () => {
    const request = indexedDB.open('field-notes')
    const db = await new Promise(resolve => { request.onsuccess = () => resolve(request.result) })
    const get = db.transaction('pages', 'readonly').objectStore('pages').get(location.pathname.split('/').pop())
    const row = await new Promise(resolve => { get.onsuccess = () => resolve(get.result) })
    db.close()
    return row.body
  })
  const saved = async expected => {
    for (let i = 0; i < 30; i++) {
      if (await read() === expected) return
      await page.waitForTimeout(50)
    }
    assert.equal(await read(), expected)
  }
  const openTools = async () => {
    if (await toggle.getAttribute('aria-expanded') !== 'true') await activate(toggle)
  }
  const create = async () => {
    await page.goto(`${base}/n/field-notes`)
    await activate(page.getByText('New page', { exact: true }).first())
    await editor.fill('Peg and Awl')
    await editor.press('Home')
    await editor.press('Shift+End')
    await openTools()
    await activate(page.getByRole('button', { name: 'Link', exact: true }))
    await page.getByRole('form', { name: 'Add link' }).getByLabel('URL').fill(url)
    await activate(page.getByRole('button', { name: 'Save link', exact: true }))
    await saved(markdown)
  }
  try {
    await create()
    // Saving a link leaves a caret ready to write outside its destination.
    await page.keyboard.type(' handmade bags')
    await page.keyboard.press('Enter')
    await page.keyboard.type('More information')
    await saved(`${markdown} handmade bags\nMore information`)
    assert.equal(await page.locator('.md-link').textContent(), 'Peg and Awl')
    assert.equal(await visible(), 'Peg and Awl handmade bags\nMore information')
    await page.reload()
    await page.locator('.md-link').waitFor()
    assert.equal(await page.locator('.md-link').getAttribute('href'), url)
    assert.equal(await visible(), 'Peg and Awl handmade bags\nMore information')

    // End at a visually hidden closing marker: Space must exit the link.
    await create()
    await page.keyboard.press('ArrowLeft') // skip the hidden destination to the label's end
    await page.keyboard.type(' nearby')
    await page.keyboard.press('Enter')
    await saved(`${markdown} nearby\n`)
    assert.equal(await page.locator('.md-link').textContent(), 'Peg and Awl')
    assert.equal(await visible(), 'Peg and Awl nearby\n')

    // Enter at that same boundary must not split its Markdown destination.
    await create()
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Next shop')
    await saved(`${markdown}\nNext shop`)
    assert.equal(await visible(), 'Peg and Awl\nNext shop')
    await page.reload()
    await page.locator('.md-link').waitFor()
    assert.equal(await page.locator('.md-link').getAttribute('href'), url)

    // Editing a destination also leaves subsequent text outside the link.
    await editor.press('ControlOrMeta+Home')
    await editor.press('ArrowRight')
    await openTools()
    await activate(page.getByRole('button', { name: 'Link', exact: true }))
    await page.getByRole('form', { name: 'Edit link' }).getByLabel('URL').fill('https://example.com/new')
    await activate(page.getByRole('button', { name: 'Save link', exact: true }))
    await page.keyboard.type(' details')
    await saved('[Peg and Awl](https://example.com/new) details\nNext shop')
    assert.equal(await page.locator('.md-link').textContent(), 'Peg and Awl')
    assert.equal(await visible(), 'Peg and Awl details\nNext shop')

    // Reopening Link and cancelling must consistently resume ordinary writing.
    for (let attempt = 0; attempt < 3; attempt++) {
      await create()
      await page.keyboard.press('ArrowLeft')
      await openTools()
      await activate(page.getByRole('button', { name: 'Link', exact: true }))
      await activate(page.getByRole('form', { name: 'Edit link' }).getByRole('button', { name: 'Cancel', exact: true }))
      await page.keyboard.type(' description')
      await page.keyboard.press('Enter')
      await page.keyboard.type('Next shop')
      await saved(`${markdown} description\nNext shop`)
      assert.equal(await page.locator('.md-link').textContent(), 'Peg and Awl')
    }

    // A break inside the label keeps both pieces linked to the same place.
    await create()
    await page.keyboard.press('ArrowLeft')
    for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('Enter')
    await saved(`[Peg](${url})\n[ and Awl](${url})`)
    assert.equal(await page.locator('.md-link').count(), 2)
    assert.equal(await visible(), 'Peg\n and Awl')
    await page.reload()
    await page.locator('.md-link').first().waitFor()
    assert.deepEqual(await page.locator('.md-link').evaluateAll(links => links.map(link => link.getAttribute('href'))), [url, url])

    // List continuation belongs outside the link's hidden destination.
    await editor.fill(`- ${markdown}`)
    await editor.press('ControlOrMeta+End')
    await editor.press('ArrowLeft')
    await editor.press('Enter')
    await page.keyboard.type('Next shop')
    await saved(`- ${markdown}\n- Next shop`)
    assert.equal(await page.locator('.md-link').textContent(), 'Peg and Awl')
    assert.equal((await visible()).includes(url), false)
    assert.deepEqual(errors, [])
    console.log(`PASS ${name}: create/edit, Space, Enter, hidden boundary, destination, autosave, and reopen`)
  } finally {
    await context.close()
  }
}
try {
  await run('Desktop mouse', { viewport: { width: 1440, height: 900 } })
  await run('iPhone touch', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 })
  await run('iPad touch', { viewport: { width: 1024, height: 1366 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
} finally {
  await browser.close()
}
