import assert from 'node:assert/strict'
import {execSync} from 'node:child_process'
import {mkdir,writeFile} from 'node:fs/promises'
const {chromium}=await import(`${execSync('npm root -g',{encoding:'utf8'}).trim()}/playwright/index.mjs`)
const BASE=process.env.BASE||'http://127.0.0.1:5205',out='work/check-results/highlight-removal'
if(!['localhost','127.0.0.1'].includes(new URL(BASE).hostname))throw Error('Synthetic localhost only')
await mkdir(out,{recursive:true})
const source='# Source text\n# Daily Readings\n## Fictional topic\n### Week 1\n#### DAY 1\n##### Stored passage fixture\n\nA fictional saved passage crosses **several words** and keeps its exact location. Another separate passage stays highlighted.\n\n'+Array.from({length:18},(_,i)=>`Synthetic paragraph ${i} leaves space for a realistic reading view.\n\n`).join('')
const browser=await chromium.launch(),report=[]
try{for(const touch of [false,true].filter(t=>!process.env.TOUCH_ONLY||t))for(const path of ['context','list']){
 const context=await browser.newContext({viewport:{width:touch?390:1440,height:900},hasTouch:touch,isMobile:touch})
 await context.route('**/*',r=>new URL(r.request().url()).origin===BASE?r.continue():r.abort())
 const page=await context.newPage();page.setDefaultTimeout(10000)
 await page.goto(BASE+'/tests/redesign-check.html')
 const ids=await page.evaluate(async source=>{
  const {installStudySource,studyDB}=await import('/src/theology/store.ts'),{readingFor}=await import('/src/theology/reading.ts')
  const e=await installStudySource(new TextEncoder().encode(source),{title:'Synthetic saved highlights',filename:'synthetic.md'}),s=e.sections.find(s=>s.reading===1),r=readingFor(e,s.id),start=r.text.indexOf('fictional saved'),end=r.text.indexOf('location.')+9,other=r.text.indexOf('Another separate'),at=Date.UTC(2026,9,20)
  const mark={scope:e.scope,edition:e.id,section:s.id,start,end,quote:r.text.slice(start,end),prefix:r.text.slice(Math.max(0,start-40),start),suffix:r.text.slice(end,end+40),color:'brass',created:at,updated:at}
  // Persist the pre-existing row shape before mounting the reading. Repeated
  // highlighting used distinct ids, including records edited on another clock.
  await studyDB.annotations.bulkPut([{...mark,id:'legacy-first'},{...mark,id:'legacy-second',updated:at+1000},{...mark,id:'legacy-future',updated:Date.now()+60000},{...mark,id:'partial',start:start+5,end:end+15,quote:r.text.slice(start+5,end+15),color:'forest',updated:at},{...mark,id:'separate',start:other,end:other+24,quote:r.text.slice(other,other+24)},{...mark,scope:'other-vault',id:'other-scope'}])
  return {edition:e.id,section:s.id,quote:mark.quote}
 },source)
 await page.goto(BASE+'/theology/doctrine/'+ids.section);await page.locator('[data-study-highlight]').first().waitFor()
 const originalText=await page.locator('.study-source-text').textContent()
 await page.evaluate(()=>{window.removalEvents=[];for(const type of ['pointerdown','touchstart','pointerup','touchend','click','selectionchange','scroll'])document.addEventListener(type,event=>{const target=event.target instanceof Element?event.target:null;window.removalEvents.push({type,action:!!target?.closest('.study-highlight-actions,.study-highlight-list'),collapsed:getSelection()?.isCollapsed})},true)})
 const activate=locator=>touch?locator.tap():locator.click()
 if(path==='context'){
  const mark=page.locator('[data-study-highlight="legacy-future"]').first()
  if(touch)await mark.tap();else{await mark.focus();await page.keyboard.press('Enter')}
  await page.getByRole('dialog',{name:'Highlight actions'}).waitFor()
  await activate(page.getByRole('dialog',{name:'Highlight actions'}).getByRole('button',{name:'Remove highlight',exact:true}))
 }else{
  await page.locator('.study-highlight-list summary').click()
  await activate(page.locator('.study-highlight-list>div').filter({hasText:ids.quote.slice(0,30)}).first().getByRole('button',{name:'Remove highlight',exact:true}))
 }
 await page.getByRole('status').filter({hasText:'Highlight removed.'}).waitFor()
 const state=await page.evaluate(async()=>{const {studyDB}=await import('/src/theology/store.ts');const rows=await studyDB.annotations.toArray();return {liveLegacy:rows.filter(r=>r.scope==='local-device'&&r.id.startsWith('legacy-')&&!r.deleted).length,deleted:rows.filter(r=>r.id.startsWith('legacy-')&&r.deleted).length}})
 await writeFile(`${out}/${touch?'390':'1440'}-${path}-events.json`,JSON.stringify({state,events:await page.evaluate(()=>window.removalEvents)},null,2))
 assert.equal(state.liveLegacy,0,'Removing a saved passage must not expose a coincident older highlight')
 assert.equal(await page.locator('[data-study-highlight^="legacy-"]').count(),0,'The passage is visibly unhighlighted immediately')
 assert.ok(await page.locator('[data-study-highlight="separate"]').count()>0,'Unrelated passage stays highlighted')
 assert.ok(await page.locator('[data-study-highlight="partial"]').count()>0,'Distinct partial overlap stays highlighted')
 assert.equal(await page.locator('.study-source-text').textContent(),originalText)
 await page.screenshot({path:`${out}/${touch?'390':'1440'}-${path}-removed.png`})
 await page.getByRole('button',{name:'Undo',exact:true}).click();await page.locator('[data-study-highlight]').first().waitFor()
 const undone=await page.evaluate(async()=>{const {studyDB}=await import('/src/theology/store.ts');return studyDB.annotations.toArray()})
 assert.equal(undone.filter(r=>r.scope==='local-device'&&!r.deleted&&r.quote===ids.quote).length,1,'Undo restores one visible passage with a fresh id')
 assert.equal(undone.filter(r=>r.id.startsWith('legacy-')&&r.deleted).length,3,'Undo retains every old tombstone')
 await page.reload();await page.locator('.study-source-text').waitFor()
 const fresh=undone.find(r=>r.scope==='local-device'&&!r.deleted&&r.quote===ids.quote)
 await page.locator(`[data-study-highlight="${fresh.id}"]`).first().waitFor()
 // Feed every stale copy through the exact merge used by the study transport.
 await page.evaluate(async()=>{const {studyDB}=await import('/src/theology/store.ts'),{mergeStudyRecord}=await import('/src/theology/sync.ts'),{changed}=await import('/src/lib/db.ts');for(const row of await studyDB.annotations.toArray()){if(!row.id.startsWith('legacy-'))continue;const stale={...row,deleted:undefined,updated:row.updated-1,color:'forest'};if(mergeStudyRecord(row,stale)!==row||mergeStudyRecord(stale,row)!==row)throw Error('Stale annotation won');await studyDB.annotations.put(mergeStudyRecord(row,stale))}changed()})
 await page.reload();await page.locator(`[data-study-highlight="${fresh.id}"]`).first().waitFor();assert.equal(await page.locator('[data-study-highlight^="legacy-"]').count(),0)
 assert.ok((await page.evaluate(async()=>(await import('/src/theology/store.ts')).studyDB.annotations.get(['other-vault','other-scope']))).deleted===undefined)
 const noop=await page.evaluate(async()=>(await import('/src/theology/store.ts')).removeHighlight('missing-fixture-id'));assert.deepEqual(noop,[])
 // A stale rendered control must not claim a successful removal or offer Undo.
 await page.locator(`[data-study-highlight="${fresh.id}"]`).first().waitFor()
 await page.evaluate(async id=>{const {studyDB}=await import('/src/theology/store.ts');await studyDB.annotations.delete(['local-device',id])},fresh.id)
 const staleMark=page.locator(`[data-study-highlight="${fresh.id}"]`).first()
 if(touch)await staleMark.tap();else{await staleMark.focus();await page.keyboard.press('Enter')}
 await activate(page.getByRole('dialog',{name:'Highlight actions'}).getByRole('button',{name:'Remove highlight',exact:true}))
 await page.getByRole('alert').filter({hasText:'no longer available'}).waitFor()
 assert.equal(await page.getByRole('button',{name:'Undo',exact:true}).count(),0)
 await page.locator(`[data-study-highlight="${fresh.id}"]`).waitFor({state:'detached'})
 await page.screenshot({path:`${out}/${touch?'390':'1440'}-${path}.png`})
 report.push({touch,path,...state,undo:true,reload:true,staleCopies:true,sourceUnchanged:true,otherScopeUnchanged:true});console.log('PASS saved highlight removal',touch?'touch emulation':'keyboard',path);await context.close()
}}finally{await browser.close()}
await writeFile(out+'/checks.json',JSON.stringify(report,null,2))
