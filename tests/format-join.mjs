/* Regression for Enter then Backspace inside combined formatting. */
const BASE = process.env.BASE ?? 'http://localhost:4173'

async function loadPlaywright() {
  try {
    return await import('playwright')
  } catch {
    const { execSync } = await import('node:child_process')
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim()
    return import(`${root}/playwright/index.mjs`)
  }
}

const { chromium } = await loadPlaywright()
const browser = await chromium.launch()
const cases = [
  { markdown: '**=={brass}nestedword==**', steps: 2 },
  { markdown: '=={brass}**nestedword**==', steps: 2 },
  { markdown: '<u>**nestedword**</u>', steps: 2 },
  { markdown: '# **=={brass}nestedword==**', steps: 2 },
  { markdown: '- **=={brass}nestedword==**', steps: 4 },
]

try {
  for (const { markdown, steps } of cases) {
    const context = await browser.newContext()
    try {
      const page = await context.newPage()
      await page.goto(BASE)
      await page.getByText('New page', { exact: true }).first().click()
      const editor = page.locator('.cm-content')
      await editor.click()
      await page.keyboard.type(markdown)
      await page.keyboard.press('Home')
      for (let i = 0; i < steps; i++) await page.keyboard.press('ArrowRight')
      await page.keyboard.press('Enter')
      const split = await editor.innerText()
      if (split.includes('**') || split.includes('=={')) {
        throw new Error(`Markdown syntax appeared after Enter: ${markdown}`)
      }
      await page.keyboard.press('Backspace')
      await page.waitForTimeout(350)
      const joined = await editor.innerText()
      if (joined.includes('**') || joined.includes('=={')) {
        throw new Error(`Markdown syntax appeared after Backspace: ${markdown}`)
      }
      const saved = await page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const request = indexedDB.open('field-notes')
            request.onerror = () => reject(request.error)
            request.onsuccess = () => {
              const transaction = request.result.transaction('pages', 'readonly')
              const pages = transaction.objectStore('pages').getAll()
              pages.onerror = () => reject(pages.error)
              pages.onsuccess = () => resolve(pages.result.map((item) => item.body))
            }
          }),
      )
      if (!saved.includes(markdown)) {
        throw new Error(`Backspace did not restore the formatted line: ${markdown}`)
      }
      console.log(`PASS  Enter and Backspace preserve ${markdown}`)
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
}
