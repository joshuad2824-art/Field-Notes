import assert from 'node:assert/strict'
import {execSync} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
const {chromium}=await import(`${execSync('npm root -g',{encoding:'utf8'}).trim()}/playwright/index.mjs`)
const BASE=process.env.BASE||'http://127.0.0.1:5197',out='work/check-results/theology'
if(!['localhost','127.0.0.1'].includes(new URL(BASE).hostname))throw Error('Local synthetic fixtures only')
mkdirSync(out,{recursive:true})
// Neutral writing, never an excerpt from the supplied book.
const source=`# Conversion guide\nThis synthetic preview is a navigation aid.\n\n# Source Text\n# A study sample\nA neutral document for checking private study tools.\n\n## Week 1 — Foundations\n<a id="reading-one"></a>\n### Reading 1 — Attention\nTake time to **notice the connection** between an idea and its context. This paragraph is synthetic sample text for testing selection and highlights.\n\nA second paragraph keeps the reading calm and gives the page enough text to test reflow. Return to the [reference note](#reference).\n\n### Reading 2 — Understanding\nA thoughtful question can open a useful conversation. *Read carefully and return when ready.*\n\n## Week 2 — Connections\n### Reading 3 — Practice\nBring the question back to the passage. A small note can help preserve a connection.\n\n<a id="reference"></a>\n## Notes\nThe reference-only token is silverbirch. Return to [the first reading](#reading-one).\n\n## Appendix\nNeutral supporting material remains searchable.\n\n## Works Cited\nInvented source for a synthetic preview only.\n\n## General Index\nAttention: reading one.\n\n## Scripture Index\nReference fixture: no verse text is reproduced.\n`
const browser=await chromium.launch(),report=[]
try{for(const [width,height] of [[1440,900],[820,1180],[390,844],[320,740],[2560,1440]].filter(([w])=>!process.env.STUDY_WIDTH||w===Number(process.env.STUDY_WIDTH))){
 const context=await browser.newContext({viewport:{width,height}})
 await context.route('**/*',r=>new URL(r.request().url()).origin===BASE?r.continue():r.abort())
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000)
 await page.goto(BASE+'/tests/redesign-check.html');await page.getByRole('button',{name:'Load redesign fixtures'}).click();await page.getByText('Fixtures ready').waitFor()
 const installed=await page.evaluate(async source=>{
  const {db,changed}=await import('/src/lib/db.ts'),{installStudySource}=await import('/src/theology/store.ts'),at=Date.now()
  await db.pages.bulkPut([{id:'synthetic-prayer',notebook:'field-notes',body:'# Prayer Log\n\nSynthetic prayer note.',created:at,updated:at,pinned:0},{id:'synthetic-devotional',notebook:'devotionals',body:'# Morning and Evening — 2026-10-20\n\n## Morning\nNeutral presentation sample.\n\n## Evening\nSynthetic text for layout verification.',entryDate:'2026-10-20',created:at,updated:at,pinned:0},{id:'synthetic-church-reminders',notebook:'church',purpose:'reminders',body:'# Reminders',created:at,updated:at,pinned:1}])
  await db.sienaItems.put({id:'synthetic-church-item',notebook:'church',type:'reminder',body:'Choose a passage for the gathering',title:'Choose a passage for the gathering',created:at,updated:at,dueAt:at-1000})
  const edition=await installStudySource(new TextEncoder().encode(source),{title:'Daily Doctrine · synthetic preview',filename:'synthetic-study.md'});changed()
  return {id:edition.id,sections:edition.sections}
 },source)
 await page.goto(BASE+'/theology');await page.getByRole('heading',{name:'Theology',exact:true,level:1}).waitFor();await page.evaluate(()=>document.fonts.ready)
 const records=await page.evaluate(async()=>{const {db}=await import('/src/lib/db.ts');return JSON.stringify({pages:await db.pages.toArray(),items:await db.sienaItems.toArray()})})
 assert.equal(await page.locator('.theology-reminders').getByText('Choose a passage for the gathering',{exact:true}).count(),1)
 assert.equal(await page.locator('.theology-intro').count(),0)
 assert.equal(await page.locator('.theology-doctrine .fn-icon,.theology-devotional .fn-icon,.theology-prayer .fn-icon').count(),0)
 const devotion=page.getByRole('link',{name:'Morning & Evening',exact:true});await devotion.focus();await page.keyboard.press('Enter');await page.waitForURL(/\/theology\/devotional\/synthetic-devotional$/);await page.goto(BASE+'/theology')
 const church=page.locator('.theology-reminders');await church.scrollIntoViewIfNeeded();const churchBox=await church.boundingBox();await page.mouse.click(churchBox.x+6,churchBox.y+6);await page.waitForURL(/\/p\/synthetic-church-reminders$/);await page.goto(BASE+'/theology')
 await page.screenshot({path:`${out}/${width}-dashboard.png`,fullPage:true})
 await page.locator('.theology-prayer').click();await page.waitForURL(/\/p\/synthetic-prayer/);await page.goto(BASE+'/theology')
 await page.locator('.theology-doctrine').click();await page.waitForURL(/\/theology\/doctrine$/);await page.locator('.study-topic').first().waitFor()
 await page.screenshot({path:`${out}/${width}-topics.png`,fullPage:true})
 assert.equal(await page.locator('.study-exploration-heading,.study-topic>.fn-icon').count(),0)
 assert.equal(await page.getByRole('toolbar',{name:'Highlight',exact:true}).count(),0)
 await page.getByRole('button',{name:'Search the complete book',exact:true}).click();await page.getByRole('searchbox').fill('silverbirch');await page.locator('.study-results>a').waitFor();assert.equal(await page.locator('.study-results>a').count(),1)
 await page.locator('.study-results>a').click();await page.locator('.study-source-text').getByText(/reference-only token/).waitFor();await page.locator('.study-source-text a').click();await page.locator('.study-source-text').getByText(/Take time to/).waitFor()
 const reading=installed.sections.find(s=>s.reading===1)
 // A stable canonical text anchor crosses inline emphasis, then survives reload and viewport reflow.
 await page.evaluate(()=>{const el=document.querySelector('.study-source-text strong'),selection=getSelection(),r=document.createRange();r.selectNodeContents(el);selection.removeAllRanges();selection.addRange(r);document.dispatchEvent(new Event('selectionchange'))})
 await page.getByRole('button',{name:'Highlight brass',exact:true}).click();await page.locator('[data-study-highlight]').first().waitFor()
 const before=await page.evaluate(async id=>{const {studyDB}=await import('/src/theology/store.ts');return {source:Array.from((await studyDB.editions.get(['local-device',id])).source),marks:await studyDB.annotations.toArray()}},installed.id)
 assert.equal(before.marks.length,1);assert.equal(before.marks[0].quote,'notice the connection')
 assert.equal(new TextDecoder().decode(Uint8Array.from(before.source)),source)
 await page.reload();await page.locator('[data-study-highlight]').first().waitFor();await page.waitForFunction(()=>!document.querySelector('.study-arrival'))
 await page.screenshot({path:`${out}/${width}-reading.png`,fullPage:true})
 const metrics=await page.evaluate(()=>({horizontal:document.documentElement.scrollWidth-innerWidth,screenOverflow:document.querySelector('.study-screen').scrollWidth-document.querySelector('.study-screen').clientWidth,paperWidth:document.querySelector('.study-paper').getBoundingClientRect().width,bodySize:getComputedStyle(document.querySelector('.study-source-text')).fontSize,bodyLine:getComputedStyle(document.querySelector('.study-source-text')).lineHeight}))
 assert.equal(metrics.horizontal,0);assert.equal(metrics.screenOverflow,0);assert.ok(parseFloat(metrics.bodySize)>=18)
 await page.setViewportSize({width:width>650?390:1440,height:900});assert.equal(await page.locator('[data-study-highlight]').first().textContent(),'notice the connection')
 const after=await page.evaluate(async()=>{const {db}=await import('/src/lib/db.ts');return JSON.stringify({pages:await db.pages.toArray(),items:await db.sienaItems.toArray()})});assert.equal(after,records,'study navigation/highlights never rewrite existing pages or reminders')
 const exportResult=await page.evaluate(async id=>{const {exportStudyMarks,studyDB}=await import('/src/theology/store.ts');const body=JSON.parse(await exportStudyMarks(id));return {body,source:Array.from((await studyDB.editions.get(['local-device',id])).source)}},installed.id)
 assert.equal(exportResult.body.annotations.length,1);assert.equal(exportResult.body.annotations[0].scope,undefined);assert.equal(exportResult.body.source,undefined)
 if(width===1440){
  // A mounted reader must clear its in-memory source/marks when the vault changes.
  await page.evaluate(async()=>{const {setVault}=await import('/src/sync/vault.ts');setVault({url:'https://scope-fixture.invalid',anonKey:'fictional-anon',key:'fictional-key',id:'other-study-scope'})})
  await page.locator('.study-empty').waitFor();assert.equal(await page.locator('.study-source-text,[data-study-highlight]').count(),0)
  await page.evaluate(async source=>{const {installStudySource}=await import('/src/theology/store.ts');await installStudySource(new TextEncoder().encode(source),{title:'Separate synthetic scope',filename:'scope-sample.md'})},source)
  await page.locator('.study-source-text').waitFor();assert.equal(await page.locator('[data-study-highlight]').count(),0,'the same edition in another vault must not reuse cached marks')
  await page.evaluate(async()=>(await import('/src/sync/vault.ts')).setVault(null));await page.locator('[data-study-highlight]').first().waitFor();assert.equal(await page.locator('[data-study-highlight]').first().textContent(),'notice the connection')
 }
 assert.deepEqual(errors,[]);report.push({width,height,...metrics,highlightReload:true,highlightReflow:true,sourceUnchanged:true,referenceSearch:true,...(width===1440?{mountedScopeIsolation:true}:{} )});console.log('PASS private study',width,height,JSON.stringify(metrics));await context.close()
 }}finally{await browser.close()}
writeFileSync(`${out}/measurements.json`,JSON.stringify(report,null,2))
