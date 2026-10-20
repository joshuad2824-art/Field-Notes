import assert from 'node:assert/strict'
import {execSync} from 'node:child_process'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
const {chromium}=await import(`${execSync('npm root -g',{encoding:'utf8'}).trim()}/playwright/index.mjs`)
const BASE=process.env.BASE||'http://127.0.0.1:5197'
if(!['localhost','127.0.0.1'].includes(new URL(BASE).hostname))throw Error('Local private book check only')
if(!process.env.STUDY_SOURCE){console.log('SKIP actual book UI: provide private STUDY_SOURCE outside repository');process.exit(0)}
const base64=(await readFile(process.env.STUDY_SOURCE)).toString('base64'),browser=await chromium.launch(),context=await browser.newContext(),errors=[],report=[]
await context.route('**/*',r=>new URL(r.request().url()).origin===BASE?r.continue():r.abort())
try{
 const p=await context.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE+'/tests/redesign-check.html')
 const ids=await p.evaluate(async base64=>{const {installStudySource}=await import('/src/theology/store.ts'),{DAILY_DOCTRINE}=await import('/src/theology/model.ts');const e=await installStudySource(Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),{...DAILY_DOCTRINE,expected:DAILY_DOCTRINE});return {first:e.sections.find(s=>s.reading===1).id,last:e.sections.find(s=>s.reading===260).id,index:e.sections.find(s=>s.title==='Scripture Index').id}},base64)
 await mkdir('work/check-results/theology',{recursive:true})
 for(const [width,height] of [[1440,900],[820,1180],[390,844],[320,740],[2560,1440]]){
  await p.setViewportSize({width,height});await p.goto(BASE+'/theology/doctrine');await p.locator('.study-collection').first().waitFor();assert.equal(await p.locator('.study-collection').count(),9)
  const fit=async()=>p.evaluate(()=>({horizontal:document.documentElement.scrollWidth-innerWidth,internal:document.querySelector('.study-screen').scrollWidth-document.querySelector('.study-screen').clientWidth}))
  assert.deepEqual(await fit(),{horizontal:0,internal:0})
  // User-facing captures contain topic labels/counts only, never reading text.
  if(process.env.STUDY_CAPTURE!=='0'&&[1440,820,390,2560].includes(width)){await p.evaluate(()=>document.fonts.ready);await p.screenshot({path:`work/check-results/theology/${width}-topic-overview.png`})}
  await p.locator('.study-collection').first().click();await p.locator('.study-topic').first().waitFor();assert.ok(await p.locator('.study-topic').count()>0)
  await p.locator('.study-topic').first().click();await p.locator('.study-reading-title').waitFor();assert.deepEqual(await fit(),{horizontal:0,internal:0});assert.equal(await p.locator('.study-source-text [contenteditable=true]').count(),0)
  await p.goto(BASE+'/theology/doctrine/'+ids.index);await p.locator('.study-source-table table').waitFor();assert.equal(await p.locator('.study-source-table tbody tr').count(),1825);assert.deepEqual(await fit(),{horizontal:0,internal:0})
  // A source index link must reach a real numbered reading, not an empty anchor.
  await p.locator('.study-source-table tbody a').first().click();await p.locator('.study-reading-title').waitFor();assert.deepEqual(await fit(),{horizontal:0,internal:0})
  if(width===1440){
    await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
    const before=await p.evaluate(async()=>{const {studyDB}=await import('/src/theology/store.ts');return (await studyDB.places.toCollection().first())?.updated??0})
    const wanted=await p.locator('.study-screen').evaluate(el=>{el.scrollTop+=180;return el.scrollTop})
    await p.waitForFunction(async before=>{const {studyDB}=await import('/src/theology/store.ts');return ((await studyDB.places.toCollection().first())?.updated??0)>before},before)
    await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
    assert.ok(Math.abs((await p.locator('.study-screen').evaluate(el=>el.scrollTop))-wanted)<3,'bookmark updates must not snap the reader back to the original link target')
  }
  report.push({width,height,topics:9,indexRows:1825,indexLinksNavigate:true,horizontal:0,readOnly:true})
 }
 await p.goto(BASE+'/theology/doctrine');await p.getByRole('button',{name:'Search the complete book',exact:true}).click();await p.getByRole('searchbox').fill('Genesis 1:23–24');await p.locator('.study-results>a').filter({has:p.getByRole('heading',{name:'Scripture Index',exact:true})}).click();await p.waitForFunction(()=>document.querySelector('.study-arrival'))
 const passageVisible=await p.evaluate(()=>{const row=document.querySelector('.study-arrival'),box=row.getBoundingClientRect();return box.top>=0&&box.top<innerHeight});assert.ok(passageVisible,'search result scrolls to its precise table row')
 const fingerprint=await p.evaluate(async()=>{const {activeEdition}=await import('/src/theology/store.ts'),{sourceHash}=await import('/src/theology/source.ts');return sourceHash((await activeEdition()).source)});assert.equal(fingerprint,'f35227ef7917f20ef0bf5003653e4174869889fa399cc73968c3ea02311e50d2');assert.deepEqual(errors,[])
 await mkdir('work/check-results/theology',{recursive:true});await writeFile('work/check-results/theology/actual-book-ui-checks.json',JSON.stringify({mockNetworkBlocked:true,sourceUnchanged:true,preciseIndexSearch:true,bookmarkScrollStable:true,viewports:report},null,2));console.log('PASS actual private book UI:',JSON.stringify(report))
}finally{await context.close();await browser.close()}
