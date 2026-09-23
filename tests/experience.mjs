import assert from 'node:assert/strict'
import { eventIcs } from '../src/lib/ical.ts'
import { weekAhead } from '../src/lib/agenda.ts'
import { pageToRevisit } from '../src/lib/resurface.ts'

const event = { id: 'e-1', title: 'Family, dinner; night', date: '2026-09-22', location: 'Home\nKitchen', note: 'Bring 🍎'.repeat(20), calendarTarget: 'Family', created: 1, updated: Date.UTC(2026, 8, 22) }
const ics = eventIcs(event)
assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'))
assert.ok(ics.includes('SUMMARY:Family\\, dinner\\; night\r\n'))
assert.ok(ics.includes('DTSTART;VALUE=DATE:20260922\r\nDTEND;VALUE=DATE:20260923\r\n'))
assert.ok(ics.includes('LOCATION:Home\\nKitchen'))
assert.ok(!ics.includes('CALSCALE:GREGORIAN\nBEGIN'))
assert.ok(ics.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75))
assert.ok(eventIcs({ ...event, date: '2026-12-31', startTime: '10:00', endTime: '11:30' }).includes('DTEND:20261231T113000'))
assert.ok(eventIcs({ ...event, date: '2026-12-31' }).includes('DTEND;VALUE=DATE:20270101'))
assert.ok(eventIcs({ ...event, startTime: '10:00' }).includes('DURATION:PT1H'))

const agenda = weekAhead('2026-03-07', [
  { ...event, date: '2026-03-08' },
  { ...event, date: '2026-03-14', id: 'last' },
  { ...event, date: '2026-03-15', id: 'outside' },
], [])
assert.deepEqual(agenda.map((day) => day.iso), ['2026-03-08', '2026-03-14'])

const pages = [
  { id: 'old', notebook: 'field-notes', body: '# Old note\nA thought', created: Date.UTC(2025, 0, 1), updated: 1, pinned: 0 },
  { id: 'anniversary', notebook: 'church', body: '# A year ago', entryDate: '2025-09-22', created: Date.UTC(2025, 8, 22), updated: 1, pinned: 0 },
  { id: 'recent', notebook: 'field-notes', body: '# Yesterday', created: Date.UTC(2026, 8, 21), updated: 1, pinned: 0 },
]
assert.equal(pageToRevisit(pages, '2026-09-22')?.id, 'anniversary')
assert.notEqual(pageToRevisit(pages, '2026-09-23')?.id, 'recent')
console.log('PASS  Apple handoff, week ahead, and quiet page resurfacing')
