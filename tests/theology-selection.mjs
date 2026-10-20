import assert from 'node:assert/strict'
import {execSync} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
const {chromium}=await import(`${execSync('npm root -g',{encoding:'utf8'}).trim()}/playwright/index.mjs`)
const BASE=process.env.BASE||'http://127.0.0.1:5197',out='work/check-results/theology'
if(!['localhost','127.0.0.1'].includes(new URL(BASE).hostname))throw Error('Local neutral selection fixtures only')
mkdirSync(out,{recursive:true})
const paragraph='A short passage keeps its context. These words are for a private interface test. A second thought leaves enough room to select text across a line.'
const source='# Selection sample\n\n'+Array.from({length:8},()=>paragraph).join('\n\n')
const browser=await chromium.launch(),results=[]
try{for(const touch of [false,true]){
 const context=await browser.newContext({viewport:{width:touch?390:1440,height:touch?844:900},hasTouch:touch,isMobile:touch})
 await context.route('**/*',r=>new URL(r.request().url()).origin===BASE?r.continue():r.abort())
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000)
 await page.goto(BASE+'/tests/redesign-check.html')
 const {id,section}=await page.evaluate(async source=>{const {installStudySource}=await import('/src/theology/store.ts');const e=await installStudySource(new TextEncoder().encode(source),{title:'Synthetic selection preview',filename:'selection-sample.md'});return {id:e.id,section:e.sections[0].id}},source)
 await page.goto(BASE+'/theology/doctrine/'+section);await page.locator('.study-source-text p').first().waitFor();await page.evaluate(()=>document.fonts.ready)
 const toolbar=()=>page.getByRole('toolbar',{name:'Highlight',exact:true})
 assert.equal(await toolbar().count(),0,'highlighter is absent before selection')
 await page.evaluate(()=>document.addEventListener('pointerdown',e=>{if(e.target.closest('[role=toolbar]'))window.selectionActivation={pointerType:e.pointerType,text:getSelection()?.toString()}},true))
 const select=async(n=1)=>page.locator('.study-source-text p').nth(n).evaluate(el=>{const node=el.querySelector('[data-study-start]').firstChild,r=document.createRange();r.setStart(node,2);r.setEnd(node,26);const s=getSelection();s.removeAllRanges();s.addRange(r);document.dispatchEvent(new Event('selectionchange'));return s.toString()})
 let expected
 if(touch)expected=await select(0)
 else{
  const box=await page.locator('.study-source-text p').first().locator('[data-study-start]').first().evaluate(el=>{const r=document.createRange();r.setStart(el.firstChild,0);r.setEnd(el.firstChild,24);const a=r.getClientRects()[0];return {x:a.x,y:a.y,width:a.width,height:a.height}})
  await page.mouse.move(box.x+1,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width-1,box.y+box.height/2,{steps:12});await page.mouse.up();expected=await page.evaluate(()=>getSelection().toString());assert.ok(expected.length>10,'desktop native pointer drag selects text')
 }
 await toolbar().waitFor();const r=await toolbar().boundingBox();assert.ok(r.x>=10&&r.x+r.width<=(touch?390:1440)-8)
 await page.screenshot({path:`${out}/${touch?'390-touch':'1440-desktop'}-selection.png`})
 const color=touch?'navy':'forest',button=page.getByRole('button',{name:'Highlight '+color,exact:true});if(touch)await button.tap();else await button.click()
 await toolbar().waitFor({state:'detached'});await page.locator('[data-study-highlight]').first().waitFor()
 const activation=await page.evaluate(()=>window.selectionActivation);assert.equal(activation.pointerType,touch?'touch':'mouse');assert.equal(activation.text,expected)
 const marks=await page.evaluate(async()=>{const {studyDB}=await import('/src/theology/store.ts');return studyDB.annotations.toArray()});assert.equal(marks[0].quote,expected);assert.equal(marks[0].color,color)
 await page.reload();await page.locator('[data-study-highlight]').first().waitFor();await page.setViewportSize({width:touch?820:390,height:900});assert.equal(await page.locator('[data-study-highlight]').first().textContent(),expected)
 // Tab enters the contextual toolbar; arrows change color focus, Enter applies.
 const keyboardQuote=await select(1);await toolbar().waitFor();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Highlight brass');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Highlight oxblood');assert.equal(await page.evaluate(()=>getSelection().toString()),keyboardQuote);await page.keyboard.press('Enter');await toolbar().waitFor({state:'detached'})
 const keyboardMarks=await page.evaluate(async()=>{const {studyDB}=await import('/src/theology/store.ts');return studyDB.annotations.toArray()});assert.ok(keyboardMarks.some(m=>m.quote===keyboardQuote&&m.color==='oxblood'))
 await select(2);await toolbar().waitFor();await page.evaluate(()=>getSelection().removeAllRanges());await toolbar().waitFor({state:'detached'})
 await select(2);await toolbar().waitFor();await page.keyboard.press('Tab');await page.keyboard.press('Escape');await toolbar().waitFor({state:'detached'});assert.ok(await page.evaluate(()=>getSelection().isCollapsed))
 await select(2);await toolbar().waitFor();await page.getByRole('heading',{name:'Daily Doctrine',exact:true,level:1}).click();await toolbar().waitFor({state:'detached'})
 const sourceHash=await page.evaluate(async id=>{const {studyDB}=await import('/src/theology/store.ts'),{sourceHash}=await import('/src/theology/source.ts');return sourceHash((await studyDB.editions.get(['local-device',id])).source)},id);assert.equal(sourceHash,id);assert.deepEqual(errors,[])
 results.push({touch,nativeDesktopSelection:!touch,pointerActivation:activation.pointerType,selectionPreserved:true,keyboardAccess:true,escapeDismissal:true,deselectionDismissal:true,reload:true,reflow:true,sourceUnchanged:true});console.log('PASS contextual highlighter',touch?'touch':'desktop');await context.close()
}}finally{await browser.close()}
writeFileSync(`${out}/selection-checks.json`,JSON.stringify({browser:'Chromium emulation; no physical Safari selection-handle claim',results},null,2))
