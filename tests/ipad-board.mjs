// The Today board on an iPad, from Joshua's recordings on November 23: with a
// busy week the month card was stretched to the schedule's height, so its weeks
// stood far apart, and on its side Reminders was stretched to Siena's note.
// Fictional fixtures on localhost only.
import assert from 'node:assert/strict'
import {execSync} from 'node:child_process'
import {mkdir} from 'node:fs/promises'
const {chromium}=await import(`${execSync('npm root -g',{encoding:'utf8'}).trim()}/playwright/index.mjs`)
const BASE=process.env.BASE||'http://127.0.0.1:5188',out='work/check-results/ipad-board'
if(!['localhost','127.0.0.1'].includes(new URL(BASE).hostname))throw Error('Synthetic localhost only')
await mkdir(out,{recursive:true})
const browser=await chromium.launch(),errors=[]
async function board(width,height,{busy=true}={}){
  const c=await browser.newContext({viewport:{width,height},hasTouch:true})
  await c.route('**/*',r=>new URL(r.request().url()).origin===BASE?r.continue():r.abort())
  const p=await c.newPage();p.on('pageerror',e=>errors.push(`${width}x${height}: ${e.message}`));p.setDefaultTimeout(10000)
  await p.clock.install({time:new Date('2026-11-23T14:35:00-06:00')})
  await p.goto(BASE+'/tests/redesign-check.html')
  await p.evaluate(async busy=>{
    const {db,changed}=await import('/src/lib/db.ts'),now=Date.now(),day=86400000
    const item=(id,type,title,body,extra={})=>({id,type,title,body,notebook:'field-notes',created:now,updated:now,...extra})
    const note=item('note-1','note','A note for a Monday','A small fictional thought for the day: take the next good step, and leave a little room to enjoy the road along the way.\n\n"A fictional quotation that runs to two lines for the test."\n— An invented author, in an invented book\n\nSource: https://example.invalid/a/long/source/address.htm')
    const heads=['Sunday note','Party moved to a later date','Saturday note','A date confirmed','A planning update','A speaker question'].map((t,i)=>item('h-'+i,'note',t,t,{created:now-(i+1)*day,seenAt:i>2?now:undefined}))
    const rem=['Enroll in benefits','Update the display screen'].map((t,i)=>item('r-'+i,'reminder',t,t,{dueAt:now-(12-i)*day}))
    await db.sienaItems.clear();await db.sienaItems.bulkPut([note,...heads,...rem])
    const ev=[];let n=0;const add=(date,title,s,e)=>ev.push({id:'e'+(n++),title,date,startTime:s,endTime:e,created:1,updated:1})
    if(busy){
      add('2026-11-23','Morning huddle','08:30','09:00');add('2026-11-23','Physician training','09:30','12:30');add('2026-11-23','New hire orientation','11:00','13:00')
      for(const d of ['24','25','26','27','30'])for(const [t,s,e] of [['Morning huddle','08:30','09:00'],['Physician training','09:30','12:30'],['Office hours','10:00','10:25'],['Onboarding coordination','10:00','11:00']])add('2026-11-'+d,t,s,e)
    }
    await db.events.clear();await db.events.bulkPut(ev);changed()
  },busy)
  await p.goto(BASE+'/');await p.evaluate(()=>document.fonts.ready);await p.locator('.board-month .cal-grid').waitFor();await p.waitForTimeout(400)
  const m=await p.evaluate(()=>{
    const box=s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return {t:b.top,b:b.bottom,l:b.left,r:b.right,h:b.height}}
    const month=box('.board-month'),cells=[...document.querySelectorAll('.board-month .cal-grid > *')].map(e=>e.getBoundingClientRect())
    const rows=[...new Set(cells.map(r=>Math.round(r.top)))]
    const sections=[...document.querySelectorAll('.board-day .day-content > section')].map(s=>({cls:s.className,ch:s.clientHeight,sh:s.scrollHeight,scrolls:/(auto|scroll)/.test(getComputedStyle(s).overflowY)}))
    return {month,day:box('.board-day'),siena:box('.board-siena'),rem:box('.board-coming'),links:box('.board-links'),pitch:rows.length>1?rows[1]-rows[0]:0,inside:cells.every(r=>r.bottom<=month.b+0.5&&r.top>=month.t-0.5),sections}
  })
  return {c,p,m}
}
try{
  for(const [w,h] of [[744,1133],[820,1180],[1133,744],[1024,768]]){
    const {c,p,m}=await board(w,h),label=`${w}x${h}`
    assert.ok(m.pitch>=40&&m.pitch<=56,`${label}: weeks sit a row apart, not stretched (${m.pitch}px)`)
    assert.ok(m.inside,`${label}: every week is inside the month card`)
    assert.ok(Math.abs(m.month.h-m.day.h)<=1&&Math.abs(m.month.t-m.day.t)<=1,`${label}: the schedule matches the month's height (${m.day.h} vs ${m.month.h})`)
    assert.ok(m.month.h<520,`${label}: the month card is as tall as a month (${Math.round(m.month.h)}px)`)
    const coming=m.sections.find(s=>s.cls.includes('board-day-coming'))
    assert.ok(coming&&coming.scrolls&&coming.sh>coming.ch&&/has-more/.test(coming.cls),`${label}: the rest of the week scrolls inside the schedule, with its fade`)
    if(w>=1000){
      assert.ok(m.rem.h<m.siena.h-100,`${label}: Reminders is as tall as what it holds, not Siena's note (${Math.round(m.rem.h)} vs ${Math.round(m.siena.h)})`)
      assert.ok(Math.abs(m.rem.t-m.siena.t)<=1&&m.links.t>m.rem.b&&m.links.l>=m.rem.l-1,`${label}: the notebooks follow Reminders in the right-hand column`)
      assert.ok(m.month.b<h,`${label}: the first screen holds the whole month`)
    }
    await p.screenshot({path:`${out}/${label}.png`});await c.close()
    console.log('PASS iPad board',label)
  }
  // A quiet week: the schedule is a short card, not one held open to the month's height.
  {const {c,m}=await board(1133,744,{busy:false})
   assert.ok(m.day.h<m.month.h,`quiet week: the day card stays short (${Math.round(m.day.h)}px)`)
   await c.close();console.log('PASS quiet week')}
  // The desk and the phone are not this layout.
  {const {c,m}=await board(390,844);assert.ok(m.month.r-m.month.l>300&&m.day.t>m.month.b-1,'phone: month and schedule still stack');await c.close();console.log('PASS phone unchanged in shape')}
  assert.deepEqual(errors,[])
}finally{await browser.close()}
