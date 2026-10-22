import assert from 'node:assert/strict'
import {execSync} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
const {chromium}=await import(`${execSync('npm root -g',{encoding:'utf8'}).trim()}/playwright/index.mjs`)
const BASE=process.env.BASE||'http://127.0.0.1:5197',out='work/2026-10-20-approved-home'
if(!['localhost','127.0.0.1'].includes(new URL(BASE).hostname))throw Error('Local fictional fixtures only')
mkdirSync(out,{recursive:true})
const b=await chromium.launch(),report=[]
try{for(const [width,height] of [[1440,900],[1366,768],[1280,720],[1200,800],[1920,1080],[2560,1440],[1180,900],[820,1180],[390,844],[320,740]].filter(([w])=>!process.env.HOME_WIDTH||w===Number(process.env.HOME_WIDTH))){
 const c=await b.newContext({viewport:{width,height},timezoneId:'America/Chicago'})
 await c.route('**/*',async r=>{
  const u=new URL(r.request().url())
  if(u.origin===new URL(BASE).origin)return r.continue()
  if(u.hostname==='work-fixture.invalid' && u.pathname==='/rest/v1/work_calendar_snapshots'){
   const event=(id,title,date,startTime,endTime)=>({id,title,date,startTime,endTime,allDay:false})
   const events=[event('meeting','Work check-in','2026-10-19','09:00','09:30'),event('training','Training practice','2026-10-19','14:00','16:00'),event('upcoming','Work planning review','2026-10-20','10:00','11:00'),event('training-ahead','Training session','2026-10-21','08:30','12:00'),event('upcoming','Work planning review','2026-10-20','10:00','11:00')]
   return r.fulfill({json:[{source_calendar:'joshua.davis5@ascension.org',fetched_at:'2026-10-19T23:00:00Z',from_date:'2026-10-01',to_date:'2026-12-31',timezone:'America/Chicago',events}]})
  }
  return r.abort()
 })
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(10000)
 await p.clock.install({time:new Date('2026-10-19T18:30:00-05:00')})
 await p.goto(BASE+'/tests/redesign-check.html')
 await p.getByRole('button',{name:'Load redesign fixtures'}).click();await p.getByText('Fixtures ready').waitFor()
  await p.evaluate(async()=>{
   if(!['localhost','127.0.0.1'].includes(location.hostname)||localStorage.getItem('field-notes.vault'))throw Error('Unpaired localhost only')
   const {db,changed}=await import('/src/lib/db.ts'),now=Date.now(),day=86400000
   const {ST_JOHN_NOTEBOOK:work}=await import('/src/lib/notebook-desk.ts')
   const item=(id,type,title,body,notebook,extra={})=>({id,type,title,body,notebook,created:now,updated:now,...extra})
   const reminders=['Order replacement filters','Check the garden measurements','Confirm Sunday dinner','Return the borrowed clamps','Choose the next study passage','File the receipt','Review the workshop reference'].map((title,i)=>item('personal-rem-'+i,'reminder',title,title,['field-notes','garden','church',undefined][i%4],{dueAt:now+(i===6?2*day:-day)}))
   const workReminders=['Confirm the training roster','Review the downtime handoff','Check the practice session','Prepare the next change review'].map((title,i)=>item('work-rem-'+i,'reminder',title,title,work,{dueAt:now+(i===3?2*day:-day)}))
   const messages=[
    item('personal-note','note','Room for the week','## The week ahead\nKeep a little room around the fixed dates. **The small decisions can stay close** without taking over the day.\n\n### A good place to start\nChoose the passage for the next gathering and check the garden measurements. *There is time to do these one at a time.*\n\n### Still open\n1. Decide which afternoon works for the project.\n2. Confirm Sunday dinner.\n\n==Start with the first decision.== The supporting notes are still in their notebooks.\n\n### A little further ahead\nThe workshop reference is ready whenever you return to it. It belongs with the other personal projects, even though its title includes the word work.','field-notes'),
    item('personal-garden','saved','Garden notes','## Ready to use\nThe measurements are filed. *Check the sunlight before choosing a spot.*','garden',{created:now-day,requiresAction:false}),
    item('personal-unfiled','note','A loose thread','Next decision:\nChoose a quiet afternoon to return to the sketch. Reading this does not resolve the decision.',undefined,{created:now-4*day,seenAt:now}),
    item('work-note','note','St. John · planning brief','## Before the review\n**Confirm the training roster** and keep the downtime handoff close.\n\n### Ready\nThe reference draft is filed in this notebook.\n\n### Decisions still open\n1. Confirm the next practice session.\n2. Decide who will check the final handoff.\n\n*These items stay here until resolved.*',work),
    item('work-update','task_update','St. John · handoff update','## Follow-through\nThe draft is ready. ==One decision remains open== before the review.',work,{created:now-4*day,seenAt:now}),
    item('old-information','note','An earlier reference','Older information retained in Archive.','field-notes',{created:now-4*day,requiresAction:false}),
    item('done-personal','reminder','Completed personal fixture','Original content remains stored.','field-notes',{dueAt:now-day,completedAt:now}),
    item('done-work','reminder','Completed work fixture','Original content remains stored.',work,{dueAt:now-day,completedAt:now})
   ]
   await db.sienaItems.clear();await db.sienaItems.bulkPut([...reminders,...workReminders,...messages]);changed()
   await db.meta.put({key:'scope-preview-original',value:JSON.stringify(await db.sienaItems.toArray())})
  })

 await p.evaluate(async()=>{
  const {db}=await import('/src/lib/db.ts')
  await db.events.clear()
  await db.events.bulkPut([{id:'lunch',title:'Lunch with Dad',date:'2026-10-19',startTime:'12:00',endTime:'13:00',created:1,updated:1},{id:'dentist',title:'Dentist',date:'2026-10-20',startTime:'15:00',endTime:'15:45',created:1,updated:1}])
  localStorage.setItem('field-notes.vault',JSON.stringify({url:'https://work-fixture.invalid',anonKey:'fictional-key',key:'fictional-vault',id:'fictional-vault'}))
 })
 await p.goto(BASE+'/');await p.evaluate(()=>document.fonts.ready)
 await p.locator('.board-today-schedule').getByText('Training practice',{exact:true}).waitFor()
 await p.locator('.board-day-coming').getByText('Training session',{exact:true}).waitFor()
 assert.equal(await p.locator('.board-day-coming').getByText('Work planning review',{exact:true}).count(),1,'canonical work occurrence is deduplicated')
 assert.equal(await p.locator('.board-message').count(),3,'all active personal message kinds remain visible')
 assert.equal(await p.locator('.board-coming .siena-item').count(),7,'future personal reminder remains visible')
 assert.equal(await p.locator('.board-coming').getByText('Review the workshop reference',{exact:true}).count(),1)
 assert.equal(await p.locator('.board-coming,.board-siena').getByText('St. John · planning brief',{exact:true}).count(),0)
 assert.equal(await p.locator('.board-coming,.board-siena').getByText('Confirm the training roster',{exact:true}).count(),0)
 assert.equal(await p.locator('.board-workshop,.board-week,.quick-note-open svg').count(),0)
 const m=await p.evaluate(()=>{
  const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}}
  const board=document.querySelector('.board-screen'),siena=document.querySelector('.board-siena'),rem=document.querySelector('.board-coming'),shelf=document.querySelector('.board-shelf'),theology=document.querySelector('.board-theology'),date=document.querySelector('.board-date'),quick=document.querySelector('.board-weather-tile')
  return {pageOverflow:board.scrollHeight-board.clientHeight,horizontal:document.documentElement.scrollWidth-innerWidth,siena:box(siena),reminders:box(rem),notebooks:box(shelf),theology:box(theology),weekday:box(date),quickNote:box(quick),weekdayColor:getComputedStyle(date).backgroundColor,fullReminderRows:[...rem.querySelectorAll('.siena-item')].filter(e=>{const r=e.getBoundingClientRect();return r.top>=rem.getBoundingClientRect().top && r.bottom<=rem.getBoundingClientRect().bottom}).length,monthOverflow:document.querySelector('.board-month').scrollHeight-document.querySelector('.board-month').clientHeight,weatherOverflow:document.querySelector('.board-weather-card').scrollHeight-document.querySelector('.board-weather-card').clientHeight}
 })
 assert.equal(m.horizontal,0)
 assert.equal(m.weekdayColor,'rgb(185, 165, 144)')
 if(width>=1200){assert.equal(m.pageOverflow,0);assert.equal(m.monthOverflow,0);assert.equal(m.weatherOverflow,0);assert.ok(m.theology.y>=m.notebooks.bottom+17);assert.ok(m.theology.bottom<=height-96);assert.ok(m.weekday.y<m.quickNote.y)}
 if(width===1440){assert.equal(m.fullReminderRows,5);assert.equal(Math.round(m.siena.height),422)}
 await p.screenshot({path:`${out}/${width}x${height}-today.png`,fullPage:width<1200})
 // Entire card is one native link and opens by keyboard. No data is created.
 const before=await p.evaluate(async()=>{const {db}=await import('/src/lib/db.ts');return JSON.stringify({pages:await db.pages.toArray(),books:await db.notebooks.toArray(),items:await db.sienaItems.toArray()})})
 const card=p.getByRole('link',{name:'Theology',exact:true});assert.equal(await card.count(),1)
 await card.focus();await p.keyboard.press('Enter');await p.waitForURL(/\/theology$/)
 await p.getByRole('heading',{name:'Theology',exact:true,level:1}).waitFor()
 assert.equal(await p.locator('.work-note,.work-brief').count(),0,'work content stays in its own notebook')
 await p.locator('.theology-reminders .siena-item').waitFor()
 assert.equal(await p.locator('.theology-reminders .siena-item').count(),1,'Theology reuses the existing Church reminder')
 assert.equal(await p.locator('.theology-reminders').getByText('Confirm Sunday dinner',{exact:true}).count(),1)
 await p.reload();await p.getByRole('heading',{name:'Theology',exact:true,level:1}).waitFor()
 if(width===1440||width===390)await p.screenshot({path:`${out}/${width}-theology.png`,fullPage:true})
 const after=await p.evaluate(async()=>{const {db}=await import('/src/lib/db.ts');return JSON.stringify({pages:await db.pages.toArray(),books:await db.notebooks.toArray(),items:await db.sienaItems.toArray()})})
 assert.equal(after,before,'opening Theology does not create or rewrite records')
 await p.getByRole('button',{name:'Up',exact:true}).click();await p.waitForURL(/\/overview$/)
 if(width===1440){
  await p.evaluate(async()=>{
   const {db}=await import('/src/lib/db.ts')
   const extra=Array.from({length:6},(_,i)=>({id:'extra-today-'+i,title:'Additional current appointment '+i,date:'2026-10-19',startTime:`${String(10+i).padStart(2,'0')}:00`,created:1,updated:1}))
   extra.push(...Array.from({length:7},(_,i)=>({id:'extra-ahead-'+i,title:'Additional upcoming appointment '+i,date:`2026-10-${20+i}`,startTime:'09:00',created:1,updated:1})))
   await db.events.bulkPut(extra)
  })
  await p.reload()
  await p.locator('.board-today-schedule').getByText('Additional current appointment 5',{exact:true}).waitFor()
  await p.locator('.board-day-coming').getByText('Additional upcoming appointment 6',{exact:true}).waitFor()
  const columns=await p.evaluate(()=>[...document.querySelectorAll('.day-content>section')].map(e=>({height:e.clientHeight,scroll:e.scrollHeight})))
  assert.equal(columns.length,2);assert.ok(columns.every(e=>e.scroll>e.height),'long schedules scroll independently')
  await p.evaluate(async()=>{const {db}=await import('/src/lib/db.ts');await db.events.clear();localStorage.removeItem('field-notes.vault')})
  await p.reload()
  assert.equal(await p.locator('.board-today-schedule,.board-day-coming').count(),0,'empty columns have no heading or placeholder')
 }
 assert.deepEqual(errors,[])
 report.push({width,height,...m});console.log('PASS approved home',width,height,JSON.stringify(m));await c.close()
}}finally{await b.close()}
writeFileSync(`${out}/measurements.json`,JSON.stringify(report,null,2))
