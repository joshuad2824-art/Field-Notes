import assert from 'node:assert/strict'
import { forecast } from '../src/weather/open-meteo.ts'
import { isoDay } from '../src/lib/format.ts'
import { eventToRow, rowToEvent, sameEvent, rowToSienaItem, sienaItemToRow, sameSienaItem } from '../src/sync/wire.ts'

const BASE = process.env.BASE ?? 'http://127.0.0.1:5173'

const event = { id: 'event-1', title: 'Lunch', date: '2026-09-22', startTime: '12:00', endTime: '13:00', location: 'Cafe', note: 'Bring notes', pageId: 'page-1', calendarTarget: 'Family', created: 100, updated: 101 }
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

