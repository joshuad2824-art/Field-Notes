// Explicit local test entrypoint: never imported by the production application.
import { getVault } from '../src/sync/vault'
import { db, changed } from '../src/lib/db'
import { navigate, to } from '../src/lib/router'
import { davisAgenda } from '../src/davis/agenda'
import { familyEvents, mergeCalendarEvents } from '../src/davis/calendar'
import { isoDay } from '../src/lib/format'
import { shiftDate } from '../src/davis/wire'
import { attachPlanImage } from '../src/lib/plan-images'
import { imageToRow, rowToImage } from '../src/sync/wire'
import '../src/main'
if (!import.meta.env.DEV || !['127.0.0.1','localhost'].includes(location.hostname)) throw Error('Local test page only')
const out = document.querySelector('output')!
const report = (fn: () => Promise<void>) => async () => { try { if (getVault()) throw Error('Refusing to test a paired archive'); await fn() } catch(e) { out.textContent = `FAIL: ${e}` } }
const assert = (ok: unknown, message: string) => { if (!ok) throw Error(message) }
const row = (id: string, body: string) => ({ id, body, notebook: 'workshop', created: Date.now(), updated: Date.now(), pinned: 0 as const })
const image = async () => {
 const canvas = document.createElement('canvas'); canvas.width=1200; canvas.height=700
 const c=canvas.getContext('2d')!; c.fillStyle='#f3ead9';c.fillRect(0,0,1200,700); c.strokeStyle='#333d32';c.lineWidth=4;c.strokeRect(240,130,720,440); c.beginPath();c.moveTo(600,130);c.lineTo(600,570);c.stroke();c.font='30px serif';c.fillStyle='#333d32';c.fillText('Traveling art case — sample drawing',300,70);c.fillText('Measure actual stock before cutting',325,640)
 const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob=>resolve(blob!), 'image/png'))
 return new File([blob], 'Case reference.png', { type: 'image/png' })
}
document.getElementById('seed')!.onclick=report(async()=>{
 await db.pages.bulkPut([
 row('workshop-check-plan','# Three-Tray Artist Field Case\n#project-plan\nProject: Three-Tray Artist Field Case\nVersion: 2\n\n## Design direction\nSample plan for reviewing the new Workshop screen.\n\n| Part | Quantity |\n| --- | --- |\n| Doors | 2 |\n| Shelves | 2 |'),
 row('workshop-check-leather','# Leather Dip-Pen Case\n#project-plan\nProject: Leather Dip-Pen Case\nVersion: 2\n\nCheck the bottle gusset with a paper mockup.'),
 row('workshop-check-desk','# Portable Desk System\n#project-plan\nProject: Portable Desk System\nVersion: 1'),
 row('workshop-check-saw','# 12-inch miter saw\n#owned'),row('workshop-check-jigsaw','# Jigsaw\n#owned')])
 const p=(await db.pages.get('workshop-check-plan'))!;await attachPlanImage(p,await image());changed();navigate(to.workshop());out.textContent='Sample Workshop loaded.'
})
const connect=async()=>{const today=isoDay();davisAgenda.connect('test-account',async()=>({status:200,snapshot:{accountId:'test-account',householdId:'test-household',timezone:'America/Chicago',today,fetchedAt:new Date().toISOString(),from:today,to:shiftDate(today,7),entries:[{sourceId:'test-family',version:'1',kind:'event',title:'Family dinner (sample)',startDate:today,time:'18:00'},{sourceId:'test-weekend',version:'1',kind:'event',title:'Weekend away (sample)',startDate:shiftDate(today,1),endDate:shiftDate(today,2)}]}}));await davisAgenda.refresh()}
document.getElementById('calendar')!.onclick=report(async()=>{await db.events.put({id:'workshop-check-event',title:'Measure the art trays (sample)',date:isoDay(),startTime:'09:00',created:1,updated:1});changed();await connect();navigate(to.overview());out.textContent='Combined calendar loaded.'})
document.getElementById('stale')!.onclick=()=>{davisAgenda.markStale();out.textContent='Family calendar stale.'}
document.getElementById('clear')!.onclick=()=>{davisAgenda.disconnect();out.textContent='Family data cleared.'}
document.getElementById('hide')!.onclick=()=>{document.getElementById('fixture')!.hidden=true}
document.getElementById('checks')!.onclick=report(async()=>{
 const base=row('workshop-check-transaction','# Attachment test\nKeep the original text.');await db.pages.put(base)
 const f=await image(); await attachPlanImage(base,f)
 const updated=(await db.pages.get(base.id))!;const records=await db.images.where('page').equals(base.id).toArray()
 assert(records.length===1,'one original image');assert(updated.body.startsWith(base.body),'text preserved')
 let rejected=false;try{await attachPlanImage(base,f)}catch{rejected=true} assert(rejected,'stale attachment rejected')
 assert((await db.images.where('page').equals(base.id).count())===1,'stale write adds no orphan')
 const wire=await imageToRow(records[0],'test');const restored=rowToImage(wire)
 assert(await restored.blob.text()===await f.text(),'original bytes survive sync wire roundtrip')
 const count=await db.events.count();await connect();assert(familyEvents(davisAgenda.getSnapshot()).length===2,'two external events')
 const merged=mergeCalendarEvents(await db.events.toArray(),davisAgenda.getSnapshot());assert(merged.some(e=>e.externalSource==='davis'),'shared event list')
 davisAgenda.markStale();assert(familyEvents(davisAgenda.getSnapshot()).every(e=>e.stale),'stale state propagated')
 davisAgenda.disconnect();assert(familyEvents(davisAgenda.getSnapshot()).length===0,'disconnect clears external events');assert(await db.events.count()===count,'external events never persisted')
 out.textContent='PASS: attachment, stale conflict, no orphan, original image sync bytes, merged events, stale tags, disconnect, no external persistence.'
})
