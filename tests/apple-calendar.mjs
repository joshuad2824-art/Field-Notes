// Pure checks for the Apple Calendar feed reader. No browser, no network, no server.
import assert from 'node:assert/strict'
import { expandIcs, validZone } from '../supabase/functions/_shared/ics.ts'

const wrap = (...events) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Test//EN', 'X-WR-CALNAME:Joshua', ...events.flat(), 'END:VCALENDAR', ''].join('\r\n')
const ev = (...lines) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT']
const run = (feed, from, to, zone = 'America/Chicago', max) => expandIcs(feed, from, to, zone, max)
const dates = (result) => result.events.map((e) => e.date)

assert.equal(validZone('America/Chicago'), true)
assert.equal(validZone('Not/AZone'), false)

// All-day: iCloud's end is exclusive, Field Notes' is the inclusive last day.
{
  const feed = wrap(
    ev('UID:a1', 'SUMMARY:One day', 'DTSTART;VALUE=DATE:20261014', 'DTEND;VALUE=DATE:20261015'),
    ev('UID:a2', 'SUMMARY:Three days', 'DTSTART;VALUE=DATE:20261020', 'DTEND;VALUE=DATE:20261023'),
  )
  const r = run(feed, '2026-10-01', '2026-10-31')
  assert.equal(r.calendarName, 'Joshua')
  assert.deepEqual(r.events.map((e) => [e.title, e.date, e.endDate, e.allDay]), [
    ['One day', '2026-10-14', undefined, true],
    ['Three days', '2026-10-20', '2026-10-22', true],
  ])
  // A multi-day event that began before the window still shows inside it.
  assert.deepEqual(dates(run(feed, '2026-10-22', '2026-10-25')), ['2026-10-20'])
  assert.deepEqual(dates(run(feed, '2026-10-23', '2026-10-25')), [])
}

// Times land in the viewer's zone, whatever zone they were written in.
{
  const feed = wrap(
    ev('UID:u1', 'SUMMARY:Utc', 'DTSTART:20261014T190000Z', 'DTEND:20261014T200000Z'),
    ev('UID:u2', 'SUMMARY:New York', 'DTSTART;TZID=America/New_York:20261015T090000', 'DTEND;TZID=America/New_York:20261015T100000'),
    ev('UID:u3', 'SUMMARY:Floating', 'DTSTART:20261016T090000', 'DTEND:20261016T093000'),
  )
  const chicago = run(feed, '2026-10-01', '2026-10-31')
  assert.deepEqual(chicago.events.map((e) => [e.title, e.date, e.startTime, e.endTime]), [
    ['Utc', '2026-10-14', '14:00', '15:00'],
    ['New York', '2026-10-15', '08:00', '09:00'],
    ['Floating', '2026-10-16', '09:00', '09:30'],
  ])
  const utc = run(feed, '2026-10-01', '2026-10-31', 'UTC')
  assert.deepEqual(utc.events.map((e) => e.startTime), ['19:00', '13:00', '09:00'])
  // Late evening in one zone is the next morning in another.
  const late = wrap(ev('UID:l1', 'SUMMARY:Late', 'DTSTART:20261015T030000Z', 'DTEND:20261015T040000Z'))
  assert.deepEqual(run(late, '2026-10-01', '2026-10-31').events.map((e) => [e.date, e.startTime]), [['2026-10-14', '22:00']])
}

// Midnight edges and durations.
{
  const feed = wrap(
    ev('UID:m1', 'SUMMARY:To midnight', 'DTSTART;TZID=America/Chicago:20261014T220000', 'DTEND;TZID=America/Chicago:20261015T000000'),
    ev('UID:m2', 'SUMMARY:Overnight', 'DTSTART;TZID=America/Chicago:20261017T220000', 'DTEND;TZID=America/Chicago:20261018T020000'),
    ev('UID:m3', 'SUMMARY:Duration', 'DTSTART:20261016T130000Z', 'DURATION:PT90M'),
    ev('UID:m4', 'SUMMARY:No end', 'DTSTART:20261019T130000Z'),
  )
  const r = run(feed, '2026-10-01', '2026-10-31', 'America/Chicago')
  const by = Object.fromEntries(r.events.map((e) => [e.title, e]))
  assert.equal(by['To midnight'].date, '2026-10-14')
  assert.equal(by['To midnight'].endDate, undefined)
  assert.equal(by['To midnight'].endTime, undefined)
  assert.deepEqual([by.Overnight.date, by.Overnight.endDate, by.Overnight.startTime, by.Overnight.endTime], ['2026-10-17', '2026-10-18', '22:00', '02:00'])
  assert.deepEqual([by.Duration.startTime, by.Duration.endTime], ['08:00', '09:30'])
  assert.equal(by['No end'].endTime, undefined)
}

// Weekly with named days, an excluded date and COUNT (which counts the excluded one).
{
  const feed = wrap(
    ev(
      'UID:w1', 'SUMMARY:Choir',
      'DTSTART;TZID=America/Chicago:20261005T180000', 'DTEND;TZID=America/Chicago:20261005T190000',
      'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=6',
      'EXDATE;TZID=America/Chicago:20261012T180000',
    ),
  )
  assert.deepEqual(dates(run(feed, '2026-10-01', '2026-10-31')), ['2026-10-05', '2026-10-07', '2026-10-14', '2026-10-19', '2026-10-21'])
  const biweekly = wrap(ev('UID:w2', 'SUMMARY:Every other Monday', 'DTSTART;VALUE=DATE:20261005', 'RRULE:FREQ=WEEKLY;INTERVAL=2'))
  assert.deepEqual(dates(run(biweekly, '2026-10-01', '2026-11-05')), ['2026-10-05', '2026-10-19', '2026-11-02'])
}

// Monthly: ordinal weekdays, last weekday, last day, set positions.
{
  const second = wrap(ev('UID:o1', 'SUMMARY:Second Sunday', 'DTSTART;VALUE=DATE:20261011', 'RRULE:FREQ=MONTHLY;BYDAY=2SU'))
  assert.deepEqual(dates(run(second, '2026-10-01', '2027-01-31')), ['2026-10-11', '2026-11-08', '2026-12-13', '2027-01-10'])
  const lastFriday = wrap(ev('UID:o2', 'SUMMARY:Last Friday', 'DTSTART;VALUE=DATE:20261030', 'RRULE:FREQ=MONTHLY;BYDAY=-1FR'))
  assert.deepEqual(dates(run(lastFriday, '2026-10-01', '2026-12-31')), ['2026-10-30', '2026-11-27', '2026-12-25'])
  const lastDay = wrap(ev('UID:o3', 'SUMMARY:Last day', 'DTSTART;VALUE=DATE:20280131', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=-1'))
  assert.deepEqual(dates(run(lastDay, '2028-01-01', '2028-03-31')), ['2028-01-31', '2028-02-29', '2028-03-31'])
  const lastWeekday = wrap(
    ev('UID:o4', 'SUMMARY:Last weekday', 'DTSTART;VALUE=DATE:20261030', 'RRULE:FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1'),
  )
  assert.deepEqual(dates(run(lastWeekday, '2026-10-01', '2026-12-31')), ['2026-10-30', '2026-11-30', '2026-12-31'])
  // A day that some months lack is skipped, not slid to the next month.
  const thirtyFirst = wrap(ev('UID:o5', 'SUMMARY:31st', 'DTSTART;VALUE=DATE:20260131', 'RRULE:FREQ=MONTHLY;COUNT=3'))
  assert.deepEqual(dates(run(thirtyFirst, '2026-01-01', '2026-12-31')), ['2026-01-31', '2026-03-31', '2026-05-31'])
}

// Yearly, UNTIL, and leap days.
{
  const leap = wrap(ev('UID:y1', 'SUMMARY:Leap', 'DTSTART;VALUE=DATE:20280229', 'RRULE:FREQ=YEARLY;COUNT=3'))
  assert.deepEqual(dates(run(leap, '2028-01-01', '2037-01-01')), ['2028-02-29', '2032-02-29', '2036-02-29'])
  const birthday = wrap(ev('UID:y2', 'SUMMARY:Birthday', 'DTSTART;VALUE=DATE:19890111', 'RRULE:FREQ=YEARLY'))
  assert.deepEqual(dates(run(birthday, '2026-12-01', '2027-02-01')), ['2027-01-11'])
  const thanksgiving = wrap(ev('UID:y3', 'SUMMARY:Thanksgiving', 'DTSTART;VALUE=DATE:20261126', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=4TH'))
  assert.deepEqual(dates(run(thanksgiving, '2026-01-01', '2028-12-31')), ['2026-11-26', '2027-11-25', '2028-11-23'])
  const until = wrap(ev('UID:y4', 'SUMMARY:Until', 'DTSTART;VALUE=DATE:20261031', 'RRULE:FREQ=DAILY;UNTIL=20261102'))
  assert.deepEqual(dates(run(until, '2026-10-30', '2026-11-10')), ['2026-10-31', '2026-11-01', '2026-11-02'])
  const untilUtc = wrap(
    ev('UID:y5', 'SUMMARY:Until UTC', 'DTSTART;TZID=America/Chicago:20261031T190000', 'DTEND;TZID=America/Chicago:20261031T200000', 'RRULE:FREQ=DAILY;UNTIL=20261102T005959Z'),
  )
  // Clocks go back early on Nov 1, so 19:00 that evening is CST: 01:00Z on Nov 2, one second past this cutoff.
  assert.deepEqual(dates(run(untilUtc, '2026-10-30', '2026-11-10')), ['2026-10-31'])
  const untilExact = wrap(
    ev('UID:y6', 'SUMMARY:Until exact', 'DTSTART;TZID=America/Chicago:20261031T190000', 'DTEND;TZID=America/Chicago:20261031T200000', 'RRULE:FREQ=DAILY;UNTIL=20261102T010000Z'),
  )
  assert.deepEqual(dates(run(untilExact, '2026-10-30', '2026-11-10')), ['2026-10-31', '2026-11-01'])
}

// Wall-clock time holds across daylight saving; the viewer's clock moves with it.
{
  const feed = wrap(
    ev('UID:d1', 'SUMMARY:Standing', 'DTSTART;TZID=America/Chicago:20261026T090000', 'DTEND;TZID=America/Chicago:20261026T100000', 'RRULE:FREQ=WEEKLY;COUNT=3'),
  )
  const here = run(feed, '2026-10-01', '2026-11-30', 'America/Chicago')
  assert.deepEqual(here.events.map((e) => [e.date, e.startTime]), [['2026-10-26', '09:00'], ['2026-11-02', '09:00'], ['2026-11-09', '09:00']])
  const elsewhere = run(feed, '2026-10-01', '2026-11-30', 'UTC')
  assert.deepEqual(elsewhere.events.map((e) => e.startTime), ['14:00', '15:00', '15:00'])
  const east = run(feed, '2026-10-01', '2026-11-30', 'America/New_York')
  assert.deepEqual(east.events.map((e) => e.startTime), ['10:00', '10:00', '10:00'])
}

// One edited or cancelled instance of a series.
{
  const feed = wrap(
    ev('UID:s1', 'SUMMARY:Standup', 'DTSTART;TZID=America/Chicago:20261006T100000', 'DTEND;TZID=America/Chicago:20261006T103000', 'RRULE:FREQ=WEEKLY;COUNT=4'),
    ev(
      'UID:s1', 'SUMMARY:Standup (moved)', 'RECURRENCE-ID;TZID=America/Chicago:20261013T100000',
      'DTSTART;TZID=America/Chicago:20261014T150000', 'DTEND;TZID=America/Chicago:20261014T160000',
    ),
    ev('UID:s1', 'SUMMARY:Standup', 'RECURRENCE-ID;TZID=America/Chicago:20261020T100000', 'DTSTART;TZID=America/Chicago:20261020T100000', 'STATUS:CANCELLED'),
  )
  const r = run(feed, '2026-10-01', '2026-10-31')
  assert.deepEqual(r.events.map((e) => [e.date, e.startTime, e.title]), [
    ['2026-10-06', '10:00', 'Standup'],
    ['2026-10-14', '15:00', 'Standup (moved)'],
    ['2026-10-27', '10:00', 'Standup'],
  ])
  assert.equal(new Set(r.events.map((e) => e.id)).size, 3)
}

// Text handling: unfolding, escapes, quoted parameters, alarms, cancelled events.
{
  const feed = [
    'BEGIN:VCALENDAR', 'VERSION:2.0',
    'BEGIN:VEVENT', 'UID:t1',
    'SUMMARY:Dinner at Joe\\, Sam\'s with a title long enough that the line is fol',
    ' ded across two lines',
    'DTSTART;VALUE=DATE:20261014',
    'LOCATION:Joe\'s Diner\\n12 Main St\\, Tulsa',
    'DESCRIPTION:Bring the\\nbinder',
    'ATTENDEE;CN="Last\\, First":mailto:someone@example.com',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Reminder text that is not the note', 'TRIGGER:-PT15M', 'END:VALARM',
    'END:VEVENT',
    'BEGIN:VEVENT', 'UID:t2', 'SUMMARY:Cancelled', 'DTSTART;VALUE=DATE:20261015', 'STATUS:CANCELLED', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:t3', 'SUMMARY:No start here', 'END:VEVENT',
    'END:VCALENDAR', '',
  ].join('\r\n')
  const r = run(feed, '2026-10-01', '2026-10-31')
  assert.equal(r.events.length, 1)
  assert.equal(r.events[0].title, "Dinner at Joe, Sam's with a title long enough that the line is folded across two lines")
  assert.equal(r.events[0].location, "Joe's Diner, 12 Main St, Tulsa")
  assert.equal(r.events[0].note, 'Bring the\nbinder')
}

// Rules that are not understood are shown once and counted, never guessed at.
{
  const feed = wrap(ev('UID:x1', 'SUMMARY:Week twenty', 'DTSTART;VALUE=DATE:20260514', 'RRULE:FREQ=YEARLY;BYWEEKNO=20'))
  const r = run(feed, '2026-01-01', '2028-12-31')
  assert.equal(r.skipped, 1)
  assert.deepEqual(dates(r), ['2026-05-14'])
}

// Old, endless series stay cheap, and the result is capped.
{
  const feed = wrap(
    ev('UID:p1', 'SUMMARY:Daily since 2015', 'DTSTART:20150101T130000Z', 'DTEND:20150101T133000Z', 'RRULE:FREQ=DAILY'),
  )
  const t0 = Date.now()
  const r = run(feed, '2026-10-12', '2026-10-14')
  assert.deepEqual(dates(r), ['2026-10-12', '2026-10-13', '2026-10-14'])
  assert.ok(Date.now() - t0 < 2000, 'an old daily series is expanded quickly')
  const capped = run(feed, '2026-10-01', '2026-10-31', 'America/Chicago', 5)
  assert.equal(capped.events.length, 5)
  assert.equal(capped.truncated, true)
}

console.log('PASS apple calendar feed: all-day ends, zones, midnight edges, weekly/monthly/yearly rules, set positions, exclusions, single-instance edits, DST, text unfolding, unsupported rules, volume')
