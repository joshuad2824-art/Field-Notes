import assert from 'node:assert/strict'
import {calendarProjection} from '../src/widgets/projection.ts'
import {dayOf,monthOf} from '../src/lib/calendar.ts'
import {eventOnDay} from '../src/lib/event-range.ts'
import {JOURNAL_NOTEBOOK} from '../src/lib/model.ts'
const page=(id,date,notebook='field-notes')=>({id,body:'Private sentinel '+id,entryDate:date,notebook,created:1,updated:1,pinned:0})
const pages=[page('one','2026-11-03'),page('two','2026-11-03'),page('journal','2026-11-08',JOURNAL_NOTEBOOK),{...page('deleted','2026-11-07'),deleted:2},page('othermonth','2026-12-01')]
const event=(id,date,more={})=>({id,title:'Private title '+id,date,created:1,updated:1,...more})
const events=[event('native','2026-11-04'),event('range','2026-10-31',{endDate:'2026-11-02'}),event('repeat','2026-10-07',{recurrence:{frequency:'weekly',interval:1,weekdays:[0,3]}}),event('external','2026-11-13',{externalSource:'work'}),event('gone','2026-11-14',{deleted:2})]
const sources={davis:'ready',apple:'setup',work:'stale'}
const result=calendarProjection(pages,events,'2026-11-01','2026-11-30',sources,'America/Chicago')
assert.deepEqual(result.written,['2026-11-03'])
assert.ok(result.events.includes('2026-11-01')&&result.events.includes('2026-11-02')&&result.events.includes('2026-11-04')&&result.events.includes('2026-11-13'))
assert.ok(!result.events.includes('2026-11-14'))
const livePages=pages.filter(p=>!p.deleted&&p.notebook!==JOURNAL_NOTEBOOK),liveEvents=events.filter(e=>!e.deleted)
for(const day of monthOf('2026-11').filter(d=>d.inMonth)) {
 assert.equal(result.written.includes(day.iso),livePages.map(dayOf).includes(day.iso))
 assert.equal(result.events.includes(day.iso),liveEvents.some(e=>eventOnDay(e,day.iso)))
}
assert.ok(!JSON.stringify(result).includes('Private'))
assert.deepEqual(Object.keys(result).sort(),['version','from','to','timezone','written','events','sources'].sort())
for(const [from,to] of [['2026-02-30','2026-03-01'],['2026-12-01','2026-11-01'],['2026-01-01','2029-01-01']])assert.throws(()=>calendarProjection([],[],from,to,sources,'UTC'))
console.log('PASS calendar projection: exact Today page/event marker parity, journal and deleted exclusions, recurring/multiday/external events, unique dates, strict bounded window, no text/IDs.')
