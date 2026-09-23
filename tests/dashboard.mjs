import assert from 'node:assert/strict'
import { forecast } from '../src/weather/open-meteo.ts'
import { isoDay } from '../src/lib/format.ts'
import { eventToRow, rowToEvent, sameEvent, rowToSienaItem, sienaItemToRow, sameSienaItem } from '../src/sync/wire.ts'

const BASE = process.env.BASE ?? 'http://127.0.0.1:5173'

const event = { id: 'event-1', title: 'Lunch', date: '2026-09-22', startTime: '12:00', endTime: '13:00', location: 'Cafe', note: 'Bring notes', created: 100, updated: 101 }
assert.deepEqual(rowToEvent(eventToRow(event, 'vault')), event)
assert.equal(sameEvent(event, { ...event, title: 'Dinner' }), false)

const item = { id: 'item-1', type: 'note', title: 'Hello', body: 'A full note', created: 100, updated: 101, seenAt: 101 }
assert.deepEqual(rowToSienaItem(sienaItemToRow(item, 'vault')), item)
assert.equal(sameSienaItem(item, { ...item, seenAt: 102 }), false)

const originalFetch = globalThis.fetch
let asked = ''
globalThis.fetch = async (url) => {
  asked = String(url)
  return { ok: true, json: async () => ({
    current: { temperature_2m: 21, weather_code: 2, is_day: 1 },
    daily: {
      time: Array.from({ length: 7 }, (_, i) => `2026-09-${String(22 + i).padStart(2, '0')}`),
      weather_code: [0, 1, 2, 3, 61, 80, 95],
      temperature_2m_max: [21, 22, 23, 24, 25, 26, 27],
      temperature_2m_min: [11, 12, 13, 14, 15, 16, 17],
      precipitation_probability_max: [0, 10, 20, 30, 40, 50, 60],
    },
  }) }
}
try {
  const reading = await forecast({ lat: 1, lon: 2, chosen: true }, 'C')
  assert.equal(new URL(asked).searchParams.get('forecast_days'), '7')
  assert.equal(reading?.daily.length, 7)
  assert.equal(reading?.daily[6].rainChance, 60)
} finally { globalThis.fetch = originalFetch }
console.log('PASS  event and inbox rows roundtrip; weather parses seven days')

async function loadPlaywright() {
  try { return await import('playwright') } catch { /* global install */ }
  const { execSync } = await import('node:child_process')
  const root = execSync('npm root -g', { encoding: 'utf8' }).trim()
  return import(`${root}/playwright/index.mjs`)
}

const { chromium } = await loadPlaywright()
const browser = await chromium.launch()
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await context.addInitScript(() => {
    const today = new Date()
    const date = (i) => {
      const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)
      return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    }
    localStorage.setItem('field-notes.weather', JSON.stringify({
      temp: 70, high: 75, low: 60, code: 2, isDay: true, unit: 'F', at: Date.now(),
      daily: Array.from({ length: 7 }, (_, i) => ({ date: date(i), code: i === 0 ? 2 : 3, high: 75 + i, low: 60 + i, rainChance: i * 10 })),
    }))
    localStorage.setItem('field-notes.weather.unit', 'F')
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'Today in Field Notes' }).waitFor()
  assert.equal(await page.locator('.forecast-day').count(), 7)
  assert.equal(await page.locator('.forecast-day.today').count(), 1)
  assert.equal(await page.locator('.forecast-day .weather-glyph').count(), 7)
  assert.equal(await page.locator('.forecast-range').count(), 7)
  await page.getByRole('button', { name: 'Add event' }).click()
  await page.getByLabel('Title').fill('Dashboard test meeting')
  await page.getByLabel('Start time optional').fill('09:30')
  await page.getByLabel('End time optional').fill('10:15')
  await page.getByLabel('Location optional').fill('The Workshop')
  await page.getByRole('button', { name: 'Save event' }).click()
  await page.getByRole('heading', { name: 'Dashboard test meeting' }).waitFor()
  const date = await page.locator('.event-detail .section-label').textContent()
  assert.match(date, /\w/)
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.getByText('Dashboard test meeting').waitFor()
  assert.equal(await page.locator('.rail .cal-day.has-event').count(), 1)
  await page.getByRole('button', { name: 'Open calendar' }).click()
  await page.getByText('Dashboard test meeting').waitFor()
  console.log('PASS  event saves locally and appears in Overview and calendar')

  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.locator('.calendar-masthead').evaluate((node) => node.scrollWidth <= node.clientWidth), true)
  await page.getByRole('button', { name: 'Notebook', exact: true }).click()
  assert.match(new URL(page.url()).pathname, /^\/n\//)
  await page.goto(`${BASE}/calendar`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Add event' }).click()
  assert.equal(await page.getByLabel('Date').inputValue(), isoDay())
  await page.getByLabel('Title').fill('Calendar navigation test')
  await page.getByRole('button', { name: 'Save event' }).click()
  await page.getByRole('heading', { name: 'Calendar navigation test' }).waitFor()
  assert.equal(await page.locator('.event-top').evaluate((node) => node.scrollWidth <= node.clientWidth), true)
  await page.getByRole('button', { name: '‹ Back' }).click()
  assert.match(new URL(page.url()).pathname, /^\/calendar/)
  await page.locator('.calendar-grid .cal-day.today').click()
  assert.match(new URL(page.url()).pathname, /^\/day\//)
  assert.equal(await page.locator('.chrome').evaluate((node) => node.scrollWidth <= node.clientWidth), true)
  await page.getByRole('button', { name: 'Notebook', exact: true }).click()
  assert.match(new URL(page.url()).pathname, /^\/n\//)
  console.log('PASS  calendar, event, and day have a direct notebook exit on phone')
  await page.setViewportSize({ width: 1280, height: 900 })

  const now = Date.now()
  await page.evaluate(async (at) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('field-notes')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise((resolve, reject) => {
      const tx = db.transaction('sienaItems', 'readwrite')
      const store = tx.objectStore('sienaItems')
      store.put({ id: 'dashboard-note', type: 'note', title: 'A note for today', body: 'Here is the full message from Siena.\nIt has a second line.', created: at, updated: at })
      store.put({ id: 'dashboard-reminder', type: 'reminder', title: 'Remember this', body: 'One useful reminder.', dueAt: at, created: at + 1, updated: at + 1 })
      store.put({ id: 'dashboard-update', type: 'task_update', title: 'Finished work', body: 'The requested work is complete.', created: at + 2, updated: at + 2 })
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  }, now)
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.getByText('Here is the full message from Siena.').waitFor()
  assert.equal(await page.locator('.overview-from-siena .siena-item').count(), 3)
  assert.equal(await page.locator('.overview-from-siena .siena-mark-seen').count(), 3)
  if (process.env.DASHBOARD_SCREENSHOT) {
    await page.screenshot({ path: process.env.DASHBOARD_SCREENSHOT, fullPage: true })
  }
  if (process.env.DASHBOARD_SIENA_SCREENSHOT) {
    await page.locator('.overview-from-siena').scrollIntoViewIfNeeded()
    await page.screenshot({ path: process.env.DASHBOARD_SIENA_SCREENSHOT })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.locator('.forecast-days').evaluate((node) => node.scrollWidth > node.clientWidth), true)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('button', { name: 'All saved items' }).click()
  await page.getByRole('heading', { name: /From Siena/ }).waitFor()
  await page.getByText('A note for today').waitFor()
  assert.equal(await page.locator('.siena-collection .siena-item').count(), 3)
  await page.getByRole('button', { name: 'Mark all seen' }).click()
  await page.locator('.siena-collection .siena-mark-seen').first().waitFor({ state: 'detached' })
  await page.reload()
  await page.getByText('A note for today').waitFor()
  assert.equal(await page.locator('.siena-collection .siena-item').count(), 3)
  assert.equal(await page.locator('.siena-collection .siena-mark-seen').count(), 0)
  await page.getByRole('button', { name: '‹ Overview' }).click()
  await page.getByRole('heading', { name: 'Today in Field Notes' }).waitFor()
  await page.getByText('No new results or decisions to review.').waitFor()
  assert.deepEqual(errors, [])
  console.log('PASS  From Siena retains full items and explicit seen state')
  await context.close()
} finally { await browser.close() }
