import { execSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
mkdirSync('work/2026-10-12-reference-corrections', { recursive: true })
const { chromium } = await import(
  `${execSync('npm root -g', { encoding: 'utf8' }).trim()}/playwright/index.mjs`
)
const BASE = process.env.BASE || 'http://127.0.0.1:5188'
const b = await chromium.launch()
try {
  for (const width of [1440, 320]) {
    const c = await b.newContext({ viewport: { width, height: 900 } })
    const p = await c.newPage()
    await p.clock.setFixedTime(new Date('2026-08-12T12:00:00'))
    await p.goto(BASE + '/')
    await p.locator('.board-month').waitFor()
    assert.equal(await p.locator('.board-month .cal-day').count(), 42)
    const card = await p.locator('.board-month').boundingBox(),
      last = await p.locator('.board-month .cal-day').last().boundingBox()
    assert.ok(last.y + last.height <= card.y + card.height, JSON.stringify({ card, last }))
    await p.screenshot({ path: `work/2026-10-12-reference-corrections/six-week-${width}.png` })
    await c.close()
    console.log('PASS six-week square', width)
  }
} finally {
  await b.close()
}
