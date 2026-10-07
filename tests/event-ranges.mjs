import assert from 'node:assert/strict'
import { eventDaysInMonth, eventOnDay, eventRangeError } from '../src/lib/event-range.ts'
import { eventIcs } from '../src/lib/ical.ts'
import { weekAhead } from '../src/lib/agenda.ts'
import { eventToRow, rowToEvent, sameEvent } from '../src/sync/wire.ts'
import { execSync } from 'node:child_process'

const event = { id: 'range-test', title: 'Year-end trip', date: '2026-12-30', endDate: '2027-01-02', created: 1, updated: 1 }
assert.deepEqual(eventDaysInMonth(event, '2026-12'), ['2026-12-30', '2026-12-31'])
assert.deepEqual(eventDaysInMonth(event, '2027-01'), ['2027-01-01', '2027-01-02'])
assert.equal(eventOnDay(event, '2027-01-03'), false)
assert.equal(eventOnDay(event, '2026-12-29'), false)
assert.equal(eventDaysInMonth({ ...event, date: '2028-02-28', endDate: '2028-03-01' }, '2028-02').length, 2)
assert.match(eventIcs(event), /DTEND;VALUE=DATE:20270103/)
assert.match(eventIcs({ ...event, startTime: '18:00', endTime: '09:00' }), /DTEND:20270102T090000/)
assert.equal(eventRangeError({ ...event, startTime: '18:00', endTime: '09:00' }), undefined)
assert.ok(eventRangeError({ ...event, endDate: '2026-12-29' }))
assert.ok(eventRangeError({ ...event, date: '2026-02-30' }))
assert.ok(eventRangeError({ ...event, startTime: '18:00' }))
assert.ok(eventRangeError({ date: '2026-12-30', startTime: '18:00', endTime: '09:00' }))
assert.deepEqual(weekAhead('2026-12-29', [event], []).map(day => day.iso), ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
assert.deepEqual(rowToEvent(eventToRow(event, 'test')), event)
assert.equal(sameEvent(event, { ...event, endDate: '2027-01-03' }), false)
console.log('PASS  date boundaries, validation, agenda, wire format, and calendar end semantics')

const { chromium } = await import(`${execSync('npm root -g', { encoding: 'utf8' }).trim()}/playwright/index.mjs`)
const browser = await chromium.launch()
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173'
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto(`${BASE}/event/new/2026-12-30`)
  await page.getByLabel('Title', { exact: true }).fill(event.title)
  await page.getByLabel('End date optional').fill(event.endDate)
  await page.getByRole('button', { name: 'Save event', exact: true }).click()
  await page.getByRole('heading', { name: event.title }).waitFor()
  const eventURL = page.url()
  await page.reload()
  await page.getByRole('button', { name: 'Edit event' }).click()
  assert.equal(await page.getByLabel('End date optional').inputValue(), event.endDate)
  await page.getByRole('button', { name: 'Save event', exact: true }).click()
  for (const day of ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']) {
    await page.goto(`${BASE}/day/${day}`)
    await page.locator('.event-row-title').getByText(event.title, { exact: true }).waitFor()
  }
  await page.goto(`${BASE}/calendar/2027-01`)
  await page.locator('.event-row-title').getByText(event.title, { exact: true }).first().waitFor()
  assert.equal(await page.locator('.event-row-title').getByText(event.title, { exact: true }).count(), 2)
  assert.equal(await page.locator('.calendar-grid .has-event').count(), 2)
  await page.goto(eventURL)
  await page.getByRole('button', { name: 'Edit event' }).click()
  await page.getByLabel('End date optional').fill('2026-12-31')
  await page.getByRole('button', { name: 'Save event', exact: true }).click()
  await page.getByRole('heading', { name: event.title }).waitFor()
  await page.goto(`${BASE}/day/2027-01-01`)
  await page.locator('.chrome').waitFor()
  assert.equal(await page.locator('.event-row-title').count(), 0)
  await page.goto(eventURL)
  await page.getByRole('button', { name: 'Delete event' }).click()
  await page.getByRole('button', { name: 'Delete it' }).click()
  await page.waitForURL(/\/day\//)
  await page.goto(`${BASE}/day/2026-12-31`)
  await page.locator('.chrome').waitFor()
  assert.equal(await page.locator('.event-row-title').count(), 0)
  assert.deepEqual(errors, [])
  console.log('PASS  create, reload, every covered day, month markers, edit, and whole-span deletion on phone')
} finally { await browser.close() }
