// Pure checks for where work events show. No browser, no network.
import assert from 'node:assert/strict'
import { isWorkEvent, withoutWork, scheduleDays } from '../src/work-calendar/schedule.ts'

const work = (id, date, startTime, extra = {}) => ({ id, title: id, date, startTime, externalSource: 'work', ...extra })
const other = (id, date, source) => ({ id, title: id, date, ...(source ? { externalSource: source } : {}) })

// Only work is held back; family, Apple and native events pass through.
{
  const all = [work('w', '2026-10-14', '09:00'), other('d', '2026-10-14', 'davis'), other('a', '2026-10-14', 'apple'), other('n', '2026-10-14')]
  assert.equal(isWorkEvent(all[0]), true)
  assert.equal(isWorkEvent(all[1]), false)
  assert.deepEqual(withoutWork(all).map((e) => e.id), ['d', 'a', 'n'])
}

// The schedule starts at today, lists today even when empty, and skips empty days after.
{
  const days = scheduleDays([work('later', '2026-10-16', '10:00')], '2026-10-13', 14)
  assert.deepEqual(days.map((d) => d.iso), ['2026-10-13', '2026-10-16'])
  assert.equal(days[0].events.length, 0)
}

// Inside a day, all-day first, then by time, then by title.
{
  const days = scheduleDays(
    [work('b', '2026-10-13', '13:00'), work('a', '2026-10-13', '13:00'), work('early', '2026-10-13', '08:30'), work('all', '2026-10-13', undefined)],
    '2026-10-13',
  )
  assert.deepEqual(days[0].events.map((e) => e.id), ['all', 'early', 'a', 'b'])
}

// A multi-day event appears on every day it covers, inside the window only.
{
  const days = scheduleDays([work('conf', '2026-10-12', undefined, { endDate: '2026-10-15' })], '2026-10-13', 14)
  assert.deepEqual(days.map((d) => d.iso), ['2026-10-13', '2026-10-14', '2026-10-15'])
}

// The window is exactly the days asked for.
{
  const days = scheduleDays([work('edge', '2026-10-26', '09:00'), work('past', '2026-10-27', '09:00')], '2026-10-13', 14)
  assert.deepEqual(days.map((d) => d.iso), ['2026-10-13', '2026-10-26'])
}

console.log('PASS work schedule: work held off Coming up, grouped by day on the St. John desk')
