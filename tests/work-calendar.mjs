import assert from 'node:assert/strict'
import {decodeWork} from '../src/work-calendar/wire.ts'
const row={source_calendar:'joshua.davis5@ascension.org',fetched_at:new Date().toISOString(),from_date:'2026-10-01',to_date:'2026-12-31',timezone:'America/Chicago',events:[{id:'fixture',title:'Test meeting',date:'2026-10-14',startTime:'08:30',endTime:'09:00',allDay:false}]}
const range={from:'2026-10-01',to:'2026-10-31'}
const result=decodeWork(row,range,'America/Chicago')
assert.equal(result.events.length,1)
assert.equal(result.stale,false)
assert.equal(result.truncated,false)
assert.equal(decodeWork({...row,fetched_at:'2020-01-01T00:00:00Z'},range,'America/Chicago').stale,true)
assert.equal(decodeWork(row,{from:'2027-01-01',to:'2027-01-31'},'America/Chicago').truncated,true)
assert.throws(()=>decodeWork({...row,source_calendar:'other@example.com'},range,'America/Chicago'))
assert.throws(()=>decodeWork({...row,events:[{...row.events[0],startTime:'25:00'}]},range,'America/Chicago'))
assert.throws(()=>decodeWork({...row,events:[{...row.events[0],date:'2026-02-30'}]},range,'America/Chicago'))
assert.throws(()=>decodeWork({...row,fetched_at:'invalid'},range,'America/Chicago'))
assert.throws(()=>decodeWork(row,range,'America/New_York'))
assert.deepEqual(decodeWork({...row,events:[]},range,'America/Chicago').events,[])
console.log('PASS scheduled work calendar: identity, timezone, dates, freshness, coverage, empty replacement')
