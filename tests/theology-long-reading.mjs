import assert from 'node:assert/strict'
import {execSync} from 'node:child_process'
import {mkdir,writeFile} from 'node:fs/promises'
const {chromium}=await import(`${execSync('npm root -g',{encoding:'utf8'}).trim()}/playwright/index.mjs`)
const BASE=process.env.BASE||'http://127.0.0.1:5197',out='work/check-results/theology-long-reading'
if(!['localhost','127.0.0.1'].includes(new URL(BASE).hostname))throw Error('Local synthetic long readings only')
await mkdir(out,{recursive:true})
const source='# Source text\n# Daily Readings\n## Synthetic topic\n### Week 1\n#### DAY 1\n##### Long sample\n\n'+Array.from({length:90},(_,i)=>`Paragraph ${i}. A synthetic passage keeps its full context. These invented words make a long reading without using private book text. A second thought gives the paragraph a stable anchor.`).join('\n\n')+'\n\n#### DAY 2\n##### Next sample\n\nA separate synthetic reading.\n'
const browser=await chromium.launch(),report=[]
const until=async(read,predicate)=>{const end=Date.now()+10000;while(Date.now()<end){const value=await read();if(predicate(value))return value;await new Promise(resolve=>setTimeout(resolve,50))}throw Error('Timed out waiting for persisted reading place')}
try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:900},hasTouch:width===390,isMobile:width===390});await context.route('**/*',r=>new URL(r.request().url()).origin===BASE?r.continue():r.abort())
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000)
 await page.goto(BASE+'/tests/redesign-check.html')
 const installed=await page.evaluate(async source=>{const {installStudySource,saveHighlight}=await import('/src/theology/store.ts'),{readingFor}=await import('/src/theology/reading.ts'),e=await installStudySource(new TextEncoder().encode(source),{title:'Synthetic long reading',filename:'long-synthetic.md'}),section=e.sections.find(s=>s.reading===1),r=readingFor(e,section.id),paragraph=r.blocks.find(b=>b.kind==='paragraph');const mark=await saveHighlight(e,section.id,r.text,paragraph.from,paragraph.from+35,'brass');return {edition:e.id,section:section.id,mark:mark.id}},source)
 await page.goto(BASE+'/theology/doctrine/'+installed.section);const mark=page.locator('[data-study-highlight]').first();await mark.waitFor()
 assert.ok(await page.locator('.study-screen').evaluate(el=>el.scrollHeight>el.clientHeight*8))
 await mark.focus();await page.keyboard.press('Enter');await page.getByRole('dialog',{name:'Highlight actions',exact:true}).waitFor();await page.getByRole('button',{name:'Remove saved highlight',exact:true}).click()
 const undo=page.getByRole('button',{name:'Undo',exact:true});await undo.waitFor();await page.waitForFunction(()=>document.activeElement?.textContent==='Undo')
 const box=await undo.boundingBox();assert.ok(box.y>=0&&box.y+box.height<800,'Undo is visible above the floating navigation in a multi-screen reading')
 assert.equal(await page.locator('.study-source-text').evaluate(el=>getComputedStyle(el).boxShadow),'none')
 assert.notEqual(await undo.evaluate(el=>getComputedStyle(el).boxShadow),'none','interactive Undo retains its focus indicator')
 assert.ok(await undo.evaluate(el=>getComputedStyle(el).outlineStyle!=='none'))
 await page.screenshot({path:`${out}/${width}-visible-undo.png`})
 await page.keyboard.press('Enter');await mark.waitFor();assert.equal(await page.locator('.study-source-text').evaluate(el=>getComputedStyle(el).boxShadow),'none')
 const rows=await page.evaluate(async()=>{const {studyDB}=await import('/src/theology/store.ts');return studyDB.annotations.toArray()});assert.ok(rows.find(a=>a.id===installed.mark).deleted);assert.equal(rows.filter(a=>!a.deleted).length,1)
 // Save a real nonzero paragraph offset, then leave and use the existing Continue link.
 await page.locator('.study-source-text p').nth(35).scrollIntoViewIfNeeded()
 const place=()=>page.evaluate(async edition=>{const {studyDB}=await import('/src/theology/store.ts');return studyDB.places.get(['local-device',edition])},installed.edition)
 const saved=await until(place,value=>value?.offset>4000)
 assert.ok(saved.offset>0)
 await page.getByRole('button',{name:'Topics',exact:true}).click();await page.waitForURL(BASE+'/theology/doctrine');const resume=page.locator('.study-continue');await resume.waitFor();assert.ok((await resume.getAttribute('href')).endsWith('/t'+saved.offset.toString(36)))
 await resume.click();await page.waitForURL('**/t'+saved.offset.toString(36));await page.locator('.study-arrival').waitFor()
 const restored=await page.evaluate(()=>{const e=document.querySelector('.study-arrival'),r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,scroll:document.querySelector('.study-screen').scrollTop}})
 assert.ok(restored.scroll>0&&restored.top>=0&&restored.top<900&&restored.bottom>0,'the saved paragraph is visible after Continue')
 await page.reload();await page.locator('.study-arrival').waitFor();assert.ok(await page.locator('.study-screen').evaluate(el=>el.scrollTop>0))
 // Persisting another scroll must not snap back to the URL's earlier target.
 const before=await page.evaluate(async edition=>{const {studyDB}=await import('/src/theology/store.ts');return (await studyDB.places.get(['local-device',edition])).updated},installed.edition)
 const wanted=await page.locator('.study-screen').evaluate(el=>{el.scrollTop+=260;return el.scrollTop})
 await until(place,value=>value?.updated>before)
 assert.ok(Math.abs(await page.locator('.study-screen').evaluate(el=>el.scrollTop)-wanted)<3)
 await page.screenshot({path:`${out}/${width}-restored-place.png`});assert.deepEqual(errors,[])
 report.push({width,visibleKeyboardUndo:true,tombstoneRetained:true,readingFocusFrameRemoved:true,nonzeroOffset:saved.offset,continueRestoresParagraph:true,reloadRestoresParagraph:true,scrollPersistenceDoesNotSnap:true});console.log('PASS long reading Undo and nonzero-place round trip',width);await context.close()
}}finally{await browser.close()}
await writeFile(`${out}/checks.json`,JSON.stringify(report,null,2))
