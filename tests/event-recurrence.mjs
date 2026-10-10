import { readFile } from 'node:fs/promises'
import { unzipSync, strFromU8 } from 'fflate'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { recurrenceStarts, expandEvents, normalizedRecurringDate, recurrenceError, recurrenceRule, recurrencePreview } from '../src/lib/event-recurrence.ts'
import { eventOnDay, eventDaysInMonth } from '../src/lib/event-range.ts'
import { eventIcs } from '../src/lib/ical.ts'
import { eventToRow, rowToEvent, sameEvent } from '../src/sync/wire.ts'
import { validateEvent } from '../supabase/functions/field-notes-mcp/workshop.ts'
const master={id:'series-test',title:'Second Sunday',date:'2026-10-11',recurrence:{frequency:'monthly',interval:1,monthWeek:2,weekday:0},created:1,updated:1}
assert.deepEqual(recurrenceStarts(master,'2026-10-01','2027-01-31'),['2026-10-11','2026-11-08','2026-12-13','2027-01-10'])
assert.deepEqual(recurrenceStarts({...master, recurrence:{...master.recurrence,monthWeek:-1}},'2026-10-01','2026-12-31'),['2026-10-25','2026-11-29','2026-12-27'])
assert.deepEqual(recurrenceStarts({...master,date:'2026-01-01',recurrence:{frequency:'monthly',interval:1,monthWeek:5,weekday:0,count:3}},'2026-01-01','2026-08-01'),['2026-03-29','2026-05-31'])
assert.deepEqual(recurrenceStarts({...master,date:'2026-01-31',recurrence:{frequency:'monthly',interval:1,monthDay:31,count:3}},'2026-01-01','2026-07-31'),['2026-01-31','2026-03-31','2026-05-31'])
assert.deepEqual(recurrenceStarts({...master,date:'2028-01-01',recurrence:{frequency:'monthly',interval:1,monthDay:-1}},'2028-02-01','2028-03-31'),['2028-02-29','2028-03-31'])
assert.deepEqual(recurrenceStarts({...master,date:'2028-02-29',recurrence:{frequency:'yearly',interval:1,count:3}},'2028-01-01','2037-01-01'),['2028-02-29','2032-02-29','2036-02-29'])
assert.deepEqual(recurrenceStarts({...master,date:'2026-10-07',recurrence:{frequency:'weekly',interval:2,weekdays:[0,1,3],count:5}},'2026-10-01','2026-11-30'),['2026-10-07','2026-10-11','2026-10-19','2026-10-21','2026-10-25'])
assert.deepEqual(recurrenceStarts({...master,date:'2026-10-31',recurrence:{frequency:'daily',interval:1,until:'2026-11-03'}},'2026-10-31','2026-11-05'),['2026-10-31','2026-11-01','2026-11-02','2026-11-03'])
assert.deepEqual(recurrenceStarts({...master,date:'2000-01-01',recurrence:{frequency:'daily',interval:1,count:3}},'2026-10-01','2026-10-31'),[])
assert.deepEqual(recurrencePreview({...master,date:''}),[]);assert.ok(recurrenceError(master.recurrence,''))
const span={...master,endDate:'2026-10-13',recurrence:{...master.recurrence,count:2}}
assert.equal(eventOnDay(span,'2026-11-10'),true);assert.equal(eventOnDay(span,'2026-11-11'),false)
assert.deepEqual(eventDaysInMonth(span,'2026-11'),['2026-11-08','2026-11-09','2026-11-10'])
const occurrences=expandEvents([span],'2026-11-09','2026-11-09')
assert.equal(occurrences[0].seriesId,master.id);assert.equal(occurrences[0].date,'2026-11-08');assert.equal(occurrences[0].endDate,'2026-11-10')
assert.deepEqual(expandEvents(occurrences,'2026-11-09','2026-11-09'),occurrences)
assert.equal(normalizedRecurringDate({...master,date:'2026-10-07',endDate:'2026-10-09'}).endDate,'2026-10-13')
assert.match(eventIcs(master),/RRULE:FREQ=MONTHLY;INTERVAL=1;BYDAY=2SU/)
assert.match(eventIcs({...master,startTime:'09:00',recurrence:{...master.recurrence,until:'2027-01-10'}}),/UNTIL=20270110T235959/)
assert.match(recurrenceRule({...master.recurrence,until:'2027-01-10'},false),/UNTIL=20270110$/)
assert.deepEqual(rowToEvent(eventToRow(master,'test')),master)
assert.equal(sameEvent(master,{...master,recurrence:{weekday:0,monthWeek:2,interval:1,frequency:'monthly'}}),true)
assert.equal(sameEvent(master,{...master,recurrence:{...master.recurrence,monthWeek:1}}),false)
for(const r of [{frequency:'weekly',interval:1,weekdays:[]},{frequency:'daily',interval:0},{frequency:'monthly',interval:1,monthDay:31,monthWeek:2,weekday:0},{frequency:'monthly',interval:1,monthDay:32},{frequency:'daily',interval:1,count:0},{frequency:'daily',interval:1,count:2,until:'2026-12-01'},{frequency:'daily',interval:1,until:'2026-02-30'}])assert.ok(recurrenceError(r,master.date))
validateEvent({date:master.date,recurrence:master.recurrence});assert.throws(()=>validateEvent({date:'2026-10-07',recurrence:master.recurrence}),/start date must match/)
console.log('PASS repeat dates: ordinal/last/fifth weekdays, leap years, missing dates, count/until, intervals, DST, multiday, normalization, ICS, semantic sync and server validation')
const {chromium}=await import(`${execSync('npm root -g',{encoding:'utf8'}).trim()}/playwright/index.mjs`)
const BASE=process.env.BASE??'http://127.0.0.1:5188'
if(!['127.0.0.1','localhost'].includes(new URL(BASE).hostname))throw Error('Isolated local tests only')
const browser=await chromium.launch()
try {
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900}});await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(BASE).origin?route.continue():route.abort())
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto(`${BASE}/event/new/2026-10-07`)
  await page.getByLabel('Title',{exact:true}).fill('Community gathering')
  await page.getByRole('combobox',{name:'Schedule',exact:true}).selectOption('monthly')
  await page.getByLabel('Start date',{exact:true}).fill('');await page.getByText('Choose a valid start date for the repeat schedule.').waitFor();await page.getByLabel('Start date',{exact:true}).fill('2026-10-07')
  await page.getByLabel('Monthly pattern').selectOption('weekday');await page.getByLabel('Which week').selectOption('2');await page.getByRole('combobox',{name:'Weekday',exact:true}).selectOption('0')
  await page.getByRole('combobox',{name:'Ends',exact:true}).selectOption('count');await page.getByLabel('Occurrences',{exact:true}).fill('3')
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('.event-repeat').scrollWidth<=document.querySelector('.event-repeat').clientWidth+1),true,'Repeat controls fit the paper');if(width>=1024)assert.ok(await page.locator('.event-repeat').evaluate(e=>{const labels=e.querySelectorAll(':scope>label');return labels[0].getBoundingClientRect().x<labels[1].getBoundingClientRect().x}),'Desktop repeat controls sit side by side')
  await page.getByRole('button',{name:'Save event',exact:true}).click();await page.getByRole('heading',{name:'Community gathering'}).waitFor()
  const url=page.url();await page.reload();await page.getByText(/Every month on the second Sunday/).waitFor()
  for(const date of ['2026-10-11','2026-11-08','2026-12-13']){await page.goto(`${BASE}/day/${date}`);await page.getByText('Community gathering',{exact:true}).waitFor()}
  await page.getByText('Community gathering',{exact:true}).click();await page.waitForURL(/\/event\/[^/]+\/2026-12-13$/)
  await page.getByRole('button',{name:'Edit event',exact:true}).click();assert.equal(await page.getByLabel('Start date',{exact:true}).inputValue(),'2026-10-11');assert.equal(await page.getByLabel('Which week').inputValue(),'2');await page.getByText('Changes apply to every occurrence in this series.').waitFor()
  await page.getByRole('button',{name:'Cancel',exact:true}).click()
  await page.goto(`${BASE}/day/2027-01-10`);await page.locator('.chrome').waitFor();assert.equal(await page.getByText('Community gathering',{exact:true}).count(),0)
  await page.goto(`${BASE}/calendar/2026-11`);await page.getByText('Community gathering',{exact:true}).waitFor();assert.equal(await page.locator('.calendar-grid .has-event').count(),1)
  const roundtrip=await page.evaluate(async()=>{const {db}=await import('/src/lib/db.ts');const {eventToRow,rowToEvent}=await import('/src/sync/wire.ts');const {exportShelf}=await import('/src/lib/export.ts');return {events:await db.events.toArray(),wire:rowToEvent(eventToRow((await db.events.toArray())[0],'test')),hasExport:typeof exportShelf}})
  assert.equal(roundtrip.events.length,1);assert.deepEqual(roundtrip.wire,roundtrip.events[0]);assert.equal(roundtrip.events[0].recurrence.count,3);
  const downloadPromise=page.waitForEvent('download');await page.evaluate(async()=>{const {exportShelf}=await import('/src/lib/export.ts');await exportShelf()});const download=await downloadPromise;const zip=await readFile(await download.path());const json=JSON.parse(strFromU8(unzipSync(zip)['field-notes-data.json']));assert.deepEqual(json.events,roundtrip.events)
  const restored=await page.evaluate(async bytes=>{const {db}=await import('/src/lib/db.ts');const {importFiles}=await import('/src/lib/import.ts');await db.events.clear();await importFiles([new File([new Uint8Array(bytes)],'backup.zip',{type:'application/zip'})]);return db.events.toArray()},Array.from(zip));assert.deepEqual(restored,roundtrip.events)
  await page.evaluate(async()=>{const {deleteEvent,restoreEvent}=await import('/src/lib/events.ts');const {db}=await import('/src/lib/db.ts');const event=(await db.events.toArray())[0];await deleteEvent(event.id);await restoreEvent(event.id)});assert.deepEqual(await page.evaluate(async()=>{const {db}=await import('/src/lib/db.ts');return (await db.events.toArray())[0].recurrence}),roundtrip.events[0].recurrence)
  
  await page.goto(url);await page.getByRole('button',{name:'Edit event'}).click();await page.getByRole('combobox',{name:'Schedule',exact:true}).selectOption('weekly');await page.getByRole('button',{name:'Monday',exact:true}).click();await page.getByRole('button',{name:'Save event',exact:true}).click();await page.getByRole('heading',{name:'Community gathering'}).waitFor()
  await page.getByRole('button',{name:'Edit event'}).click();await page.getByRole('combobox',{name:'Schedule',exact:true}).selectOption('none');await page.getByRole('button',{name:'Save event',exact:true}).click();await page.getByRole('heading',{name:'Community gathering'}).waitFor();assert.equal(await page.locator('.event-series-summary').count(),0)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[])
  console.log(`PASS ${width}px recurring form: create, reload, every occurrence, occurrence navigation, whole-series notice, finite count, monthly markers, wire roundtrip, weekly edit, clear repeat; one stored master`)
  await context.close()
 }
}finally{await browser.close()}
