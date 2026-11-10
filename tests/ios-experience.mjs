import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
const { chromium } = await import(`${execSync('npm root -g', { encoding: 'utf8' }).trim()}/playwright/index.mjs`)
const base = process.env.BASE || 'http://127.0.0.1:5199'
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Local fictional fixtures only')
const out = process.env.IOS_REVIEW_OUT || 'work/ios-experience'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch()
const report = []
try {
  for (const native of [true, false]) {
    for (const [width, height] of native ? [[440, 956], [402, 874], [320, 740]] : [[390, 844], [1440, 900]]) {
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: width < 600 })
      await context.route('**/*', r => new URL(r.request().url()).origin === base ? r.continue() : r.abort())
      await context.addInitScript(native => {
        if (native) {
          window.CapacitorCustomPlatform = { name: 'ios' }
          window.reviewKeyboardEvents = {}
          window.Capacitor = {
            PluginHeaders: [{ name: 'Keyboard', methods: [{ name: 'setAccessoryBarVisible', rtype: 'promise' }, { name: 'hide', rtype: 'promise' }, { name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' }] }],
            nativePromise: async () => {},
            nativeCallback: (_plugin, _method, options, callback) => { window.reviewKeyboardEvents[options.eventName] = callback; return 'fixture' },
          }
        }
        const viewport = new EventTarget()
        Object.assign(viewport, { height: innerHeight, width: innerWidth, offsetTop: 0, offsetLeft: 0, scale: 1 })
        Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true })
        window.reviewViewport = h => { viewport.height = h; viewport.width = innerWidth; viewport.dispatchEvent(new Event('resize')) }
        document.addEventListener('DOMContentLoaded', () => {
          document.documentElement.style.setProperty('--safe-top', '62px')
          document.documentElement.style.setProperty('--raw-inset-bottom', '34px')
          window.reviewViewport(innerHeight)
        })
      }, native)
      const page = await context.newPage(), errors = []
      page.on('pageerror', e => errors.push(e.message))
      await page.goto(base + '/tests/redesign-check.html')
      await page.getByRole('button', { name: 'Load redesign fixtures' }).click()
      await page.getByText('Fixtures ready').waitFor()
      await page.goto(base + '/calendar/2026-11')
      await page.locator('.month-header h1').waitFor()
      const calendar = await page.locator('.month-header h1').boundingBox()
      if (native) assert(calendar.y >= 62, `Calendar title clears status area at ${width}: ${calendar.y}`)
      await page.screenshot({ path: `${out}/${native ? 'ios' : 'web'}-${width}-calendar.png` })
      if (native) {
        for (const route of ['/workshop', '/theology', '/theology/doctrine']) {
          await page.goto(base + route)
          const heading = page.locator('h1').first()
          await heading.waitFor()
          const r = await heading.boundingBox()
          assert(r.y >= 62, `${route} heading clears status area at ${width}`)
          if (width === 440) await page.screenshot({ path: `${out}/${route.slice(1).replaceAll('/', '-')}-safe-area.png` })
        }
      }
      const id = await page.evaluate(async () => {
        if (localStorage.getItem('field-notes.vault')) throw Error('Unpaired fixture required')
        const { createPage } = await import('/src/lib/db.ts')
        return (await createPage('field-notes', 'Native formatting sample')).id
      })
      await page.goto(base + '/p/' + id)
      const editor = page.locator('.cm-content[contenteditable=true]')
      await editor.waitFor()
      await editor.click()
      await editor.press('Meta+a')
      if (native && width === 440) {
        // UIKit reports the keyboard while WebKit retains its full viewport.
        await page.evaluate(() => window.reviewKeyboardEvents.keyboardDidShow({ keyboardHeight: 330 }))
      } else await page.evaluate(() => window.reviewViewport(innerHeight - 330))
      const bar = page.getByRole('toolbar', { name: 'Note formatting', exact: true })
      if (native) {
        await bar.waitFor()
        const bounds = await bar.boundingBox(), visibleHeight = height - 330
        assert(bounds.y + bounds.height <= visibleHeight + 1, 'Dock is above the keyboard')
        const edit = await page.locator('.editor').boundingBox()
        assert(edit.y + edit.height <= bounds.y + 2, 'Writing scroll region ends above dock')
        const targets = await bar.locator('button').evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return { name: n.ariaLabel, width: r.width, height: r.height } }))
        for (const t of targets) assert(t.width >= 44 && t.height >= 44, `${t.name} target is 44pt`)
        await bar.getByRole('button', { name: 'Style', exact: true }).click()
        await page.getByRole('toolbar', { name: 'Style', exact: true }).getByRole('button', { name: 'Bold — ⌘B', exact: true }).click()
        const body = () => page.evaluate(async id => (await (await import('/src/lib/db.ts')).db.pages.get(id)).body, id)
        await page.waitForTimeout(450)
        assert((await body()).includes('**Native formatting sample**'), 'Selection is formatted and saved from dock')
        await bar.getByRole('button', { name: 'Checklist', exact: true }).click()
        await page.waitForTimeout(400)
        assert((await body()).includes('- [ ] '), 'Checklist reuses editor command')
        await bar.getByRole('button', { name: 'Undo', exact: true }).click()
        await page.waitForTimeout(400)
        assert(!(await body()).includes('- [ ] '), 'Undo works without dismissing keyboard')
        await bar.getByRole('button', { name: 'Redo', exact: true }).click()
        await page.waitForTimeout(400)
        assert((await body()).includes('- [ ] '), 'Redo restores checklist')
        for (const group of ['Text tools', 'Insert tools', 'Appearance tools']) assert.equal(await page.getByRole('button', { name: group, exact: true }).count(), 1)
        await page.screenshot({ path: `${out}/ios-${width}-formatting.png` })
        if (width === 440) {
          const picker = page.waitForEvent('filechooser')
          await bar.getByRole('button', { name: 'Insert picture', exact: true }).click()
          const chooser = await picker
          // Photos hides the keyboard while its chooser owns focus. The input
          // and full StyleTray must survive that transition until a file returns.
          await page.evaluate(() => { window.reviewKeyboardEvents.keyboardDidHide(); window.reviewViewport(innerHeight) })
          await bar.waitFor({ state: 'detached' })
          await chooser.setFiles({ name: 'fictional-pixel.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY1EAAAAASUVORK5CYII=', 'base64') })
          await page.waitForTimeout(600)
          assert((await body()).includes('!['), 'Picture selection survives keyboard dismissal and saves')
          await editor.click()
          await page.evaluate(() => window.reviewKeyboardEvents.keyboardDidShow({ keyboardHeight: 330 }))
          await bar.waitFor()
        }
        await bar.getByRole('button', { name: 'Hide keyboard', exact: true }).click()
        await page.evaluate(() => { window.reviewKeyboardEvents?.keyboardDidHide?.(); window.reviewViewport(innerHeight) })
        await bar.waitFor({ state: 'detached' })
        assert.equal(await page.getByRole('button', { name: 'Style', exact: true }).count(), 1)
        assert.equal(await page.locator('.pagefoot').isVisible(), false, 'Native metadata no longer consumes a permanent footer')
        await page.getByRole('button', { name: 'Page options', exact: true }).click()
        await page.locator('.native-page-info').waitFor()
        await page.keyboard.press('Escape')
        const saved = await body()
        await page.reload()
        await editor.waitFor()
        assert.equal(await body(), saved, 'Formatting survives reload')
        report.push({ native, width, height, calendarTop: calendar.y, dock: bounds, targets })
      } else {
        assert.equal(await bar.count(), 0, 'Browser keeps its existing top toolbar')
        assert.equal(await page.getByRole('button', { name: 'Style', exact: true }).count(), 1)
        report.push({ native, width, height, calendarTop: calendar.y })
      }
      assert.deepEqual(errors, [])
      console.log('PASS', native ? 'native geometry/commands' : 'unchanged web toolbar', width)
      await context.close()
    }
  }
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2))
} finally { await browser.close() }
