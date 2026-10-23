import assert from 'node:assert/strict'
import {execSync} from 'node:child_process'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
const {chromium}=await import(`${execSync('npm root -g',{encoding:'utf8'}).trim()}/playwright/index.mjs`)
const BASE=process.env.BASE||'http://127.0.0.1:5197',out='work/check-results/theology-reader'
if(!['localhost','127.0.0.1'].includes(new URL(BASE).hostname))throw Error('Local synthetic fixtures only')
await mkdir(out,{recursive:true})
// All words here are invented; never load the private book for this suite.
const paragraph='A quiet page leaves room to notice a connection. These invented words exercise reading controls without reproducing any book text.'
const source='# Source text\n# Daily Readings\n'+Array.from({length:9},(_,topic)=>`\n## Sample topic ${topic+1}\n### Week ${topic+1}\n`+Array.from({length:2},(_,day)=>`\n#### DAY ${topic*2+day+1}\n##### Sample reading ${topic*2+day+1}\n\n${paragraph}\n\n${paragraph}\n\nReturn to the [reference note](#sample-note).\n`).join('')).join('')+'\n<a id="sample-note"></a>\n# Notes\nReference material is separate from the daily sequence.\n'
const browser=await chromium.launch(),report=[]
try{for(const touch of [false,true]){
 const width=touch?390:1440,context=await browser.newContext({viewport:{width,height:touch?844:1000},hasTouch:touch,isMobile:touch,acceptDownloads:true})
 await context.route('**/*',r=>new URL(r.request().url()).origin===BASE?r.continue():r.abort())
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000)
 await page.goto(BASE+'/tests/redesign-check.html')
 const installed=await page.evaluate(async source=>{
  const {installStudySource}=await import('/src/theology/store.ts'),e=await installStudySource(new TextEncoder().encode(source),{title:'Synthetic reader preview',filename:'synthetic-reader.md'})
  return {id:e.id,readings:e.sections.filter(s=>s.reading),reference:e.sections.find(s=>s.title==='Notes').id}
 },source)
 const go=async id=>{await page.goto(BASE+'/theology/doctrine'+(id?'/'+id:''));await page.locator(id?'.study-source-text':'.study-collection').first().waitFor()}
 const activate=async locator=>touch?locator.tap():locator.click()
 const screenshot=async name=>{await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`${out}/${width}-${name}.png`})}
 const fit=async()=>assert.deepEqual(await page.evaluate(()=>({document:document.documentElement.scrollWidth-innerWidth,screen:document.querySelector('.study-screen').scrollWidth-document.querySelector('.study-screen').clientWidth})),{document:0,screen:0})
 await go();assert.equal(await page.locator('.study-collection').count(),9)
 const colors=await page.locator('.study-collection').evaluateAll(cards=>cards.map(c=>getComputedStyle(c).backgroundColor))
 assert.deepEqual(colors,Array.from({length:9},(_,i)=>['rgb(20, 50, 46)','rgb(41, 43, 50)','rgb(58, 41, 45)'][i%3]))
 await screenshot('unchanged-topics')
 for(let i=0;i<3;i++){
  await activate(page.locator('.study-collection').nth(i));await page.locator('.study-topic').first().waitFor()
  assert.equal(await page.locator('.study-topic').first().evaluate(el=>getComputedStyle(el).backgroundColor),colors[i]);await fit();await screenshot(`topic-${i+1}-list`)
  await activate(page.getByRole('button',{name:'All topics',exact:true}))
 }
 const first=installed.readings[0],second=installed.readings[1],third=installed.readings[2],last=installed.readings.at(-1)
 await go(first.id)
 const pager=()=>page.getByRole('navigation',{name:'Daily readings',exact:true})
 assert.equal(await pager().getByRole('link',{name:/^Previous:/}).count(),0)
 assert.match(await pager().getByRole('link',{name:/^Next:/}).textContent(),/^Next/)
 assert.equal(await page.getByRole('button',{name:'Save original Markdown',exact:true}).count(),0)
 const textBefore=await page.locator('.study-source-text').textContent(),settingsBefore=await page.evaluate(()=>localStorage.getItem('field-notes.settings'))
 // Save a real selected annotation with the existing contextual highlighter.
 await page.locator('.study-source-text p').first().evaluate(el=>{const node=el.querySelector('[data-study-start]').firstChild,r=document.createRange();r.setStart(node,2);r.setEnd(node,32);getSelection().removeAllRanges();getSelection().addRange(r);document.dispatchEvent(new Event('selectionchange'))})
 await activate(page.getByRole('button',{name:'Highlight brass',exact:true}));await page.locator('[data-study-highlight]').first().waitFor()
 const saved=await page.evaluate(async()=>{const {studyDB}=await import('/src/theology/store.ts');return studyDB.annotations.toCollection().first()})
 await page.reload();await page.locator('[data-study-highlight]').first().waitFor()
 assert.equal(await page.getByRole('dialog',{name:'Highlight actions',exact:true}).count(),0)
 const mark=()=>page.locator('[data-study-highlight]').first()
 if(touch)await mark().tap();else{await mark().focus();await page.keyboard.press('Enter')}
 const dialog=()=>page.getByRole('dialog',{name:'Highlight actions',exact:true})
 await dialog().waitFor();assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Remove saved highlight')
 await screenshot('highlight-actions')
 await page.keyboard.press('Escape');await dialog().waitFor({state:'detached'})
 assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute('data-study-highlight')),true)
 if(touch)await mark().tap();else await page.keyboard.press('Space')
 await dialog().waitFor();await activate(dialog().getByRole('button',{name:'Remove saved highlight',exact:true}))
 await page.getByRole('status').filter({hasText:'Highlight removed.'}).waitFor()
 await screenshot('highlight-undo')
 assert.equal(await page.locator('[data-study-highlight]').count(),0)
 assert.equal(await page.locator('.study-source-text').textContent(),textBefore)
 // Feed an older edit through the same merge function sync uses. The tombstone wins in either argument order, including equal clocks.
 const stale=await page.evaluate(async saved=>{
  const {studyDB}=await import('/src/theology/store.ts'),{mergeStudyRecord}=await import('/src/theology/sync.ts'),{changed}=await import('/src/lib/db.ts')
  const deleted=await studyDB.annotations.get([saved.scope,saved.id]),old={...saved,color:'forest'}
  const merged=mergeStudyRecord(deleted,old),reversed=mergeStudyRecord(old,deleted),tied=mergeStudyRecord({...old,updated:deleted.updated},deleted)
  await studyDB.annotations.put(merged);changed();return {deleted,merged,reversed,tied}
 },saved)
 assert.ok(stale.deleted.deleted);assert.equal(stale.merged.deleted,stale.deleted.deleted);assert.equal(stale.reversed.deleted,stale.deleted.deleted);assert.equal(stale.tied.deleted,stale.deleted.deleted)
 await activate(page.getByRole('button',{name:'Undo',exact:true}));await mark().waitFor()
 const undone=await page.evaluate(async()=>{const {studyDB}=await import('/src/theology/store.ts');return studyDB.annotations.toArray()})
 assert.equal(undone.length,2);assert.ok(undone.find(a=>a.id===saved.id).deleted)
 const restored=undone.find(a=>!a.deleted);assert.notEqual(restored.id,saved.id);assert.equal(restored.quote,saved.quote)
 await page.reload();await mark().waitFor()
 // The existing folded list remains an accessible fallback, including marks inside links.
 await activate(page.locator('.study-highlight-list summary'));await activate(page.locator('.study-highlight-list').getByRole('button',{name:'Remove saved highlight',exact:true}))
 await page.getByRole('button',{name:'Undo',exact:true}).waitFor();await page.reload();await page.locator('.study-source-text').waitFor();assert.equal(await page.locator('[data-study-highlight]').count(),0)
 // Put all four colors on the page for contrast verification in both modes.
 await page.evaluate(async id=>{const {activeEdition,saveHighlight}=await import('/src/theology/store.ts'),{readingFor}=await import('/src/theology/reading.ts'),e=await activeEdition(),r=readingFor(e,id),start=r.blocks.find(b=>b.kind==='paragraph').from;for(const [i,color] of ['brass','forest','oxblood','navy'].entries())await saveHighlight(e,id,r.text,start+i*12,start+i*12+10,color)},first.id)
 await page.locator('[data-study-highlight]').first().waitFor()
 const toggle=()=>page.getByRole('button',{name:'Dark reading mode',exact:true})
 assert.equal(await toggle().getAttribute('aria-pressed'),'false');await screenshot('topic-1-light-reading')
 await activate(toggle());assert.equal(await toggle().getAttribute('aria-pressed'),'true')
 const night=await page.locator('.study-paper').evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color}))
 assert.equal(night.background,'rgb(14, 36, 33)');assert.equal(night.color,'rgb(246, 243, 236)')
 await screenshot('topic-1-dark-reading');await fit()
 const contrast=await page.locator('mark').evaluateAll(marks=>marks.map(el=>({color:getComputedStyle(el).color,blend:getComputedStyle(el).mixBlendMode,highlight:getComputedStyle(el).getPropertyValue('--hl')})))
 assert.ok(contrast.every(c=>c.color===night.color&&c.blend==='normal'))
 // Conservative full overlap of all three existing gradient layers, across
 // every tonal background; the actual gradient often has fewer layers.
 const luminance=rgb=>rgb.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0)
 const contrastRatios=contrast.flatMap(c=>{
  const [r,g,b,opacity]=c.highlight.match(/[\d.]+/g).map(Number),alpha=1-(1-opacity)**3
  return [[14,36,33],[28,30,37],[40,27,32]].map(background=>(luminance([246,243,236])+.05)/(luminance(background.map((x,i)=>x*(1-alpha)+[r,g,b][i]*alpha))+.05))
 })
 assert.ok(contrastRatios.every(ratio=>ratio>=4.5),'all four highlight colors retain normal-text contrast in each dark topic tone')
 await page.reload();await toggle().waitFor();assert.equal(await toggle().getAttribute('aria-pressed'),'true')
 assert.equal(await page.evaluate(()=>localStorage.getItem('field-notes.settings')),settingsBefore,'reader mode leaves global preference untouched')
 assert.equal(await page.evaluate(()=>localStorage.getItem('field-notes.doctrine-dark')),'true')
 // Keyboard navigation reaches the next daily reading, skips week/topic headings, and resets to its start.
 let nextLink=pager().getByRole('link',{name:/^Next:/});await nextLink.focus();await page.keyboard.press('Enter');await page.waitForURL('**/'+second.id)
 await page.waitForFunction(async({edition,id})=>{const {studyDB}=await import('/src/theology/store.ts');return (await studyDB.places.get(['local-device',edition]))?.section===id},{edition:installed.id,id:second.id})
 assert.equal(await page.locator('.study-screen').evaluate(el=>el.scrollTop),0)
 assert.equal(await page.evaluate(()=>document.activeElement.className),'study-source-text')
 await activate(pager().getByRole('link',{name:/^Next:/}));await page.waitForURL('**/'+third.id)
 assert.equal(await page.locator('.study-paper').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(28, 30, 37)')
 await screenshot('topic-2-dark-reading');await page.locator('.study-screen').evaluate(el=>{el.scrollTop=el.scrollHeight});assert.ok((await pager().boundingBox()).y+(await pager().boundingBox()).height<=(touch?844:1000)-90,'bottom controls clear the navigation pill');await screenshot('previous-next');await activate(toggle());await screenshot('topic-2-light-reading');await activate(toggle())
 await activate(pager().getByRole('link',{name:/^Previous:/}));await page.waitForURL('**/'+second.id)
 await go(installed.readings[4].id);await screenshot('topic-3-dark-reading');await activate(toggle());await screenshot('topic-3-light-reading');await activate(toggle())
 await go(last.id);assert.equal(await pager().getByRole('link',{name:/^Next:/}).count(),0);assert.equal(await pager().getByRole('link',{name:/^Previous:/}).count(),1)
 assert.equal(await pager().getByRole('link').evaluate(el=>getComputedStyle(el).textAlign),'start')
 // Source links retain their own navigation; reference pages retain source-order pagination and light paper.
 await activate(page.locator('.study-source-text a'));await page.waitForURL('**/'+installed.reference+'/**');await page.locator('.study-source-text').waitFor()
 assert.equal(await toggle().count(),0);assert.equal(await page.getByRole('navigation',{name:'Source order',exact:true}).count(),1)
 assert.equal(await page.locator('.study-paper').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(246, 243, 236)')
 await go(first.id)
 // Hidden downloads still round-trip the original bytes and mark/place envelope.
 await activate(page.getByRole('button',{name:'Study actions',exact:true}))
 let downloaded=page.waitForEvent('download');await activate(page.getByRole('button',{name:'Save original Markdown',exact:true}));assert.equal(await readFile(await (await downloaded).path(),'utf8'),source)
 await activate(page.getByRole('button',{name:'Study actions',exact:true}));downloaded=page.waitForEvent('download');await activate(page.getByRole('button',{name:'Back up highlights & place',exact:true}))
 const backup=JSON.parse(await readFile(await (await downloaded).path(),'utf8'));assert.equal(backup.place.section,first.id);assert.ok(backup.annotations.some(a=>a.deleted));assert.ok(backup.annotations.every(a=>!a.scope));assert.equal(backup.source,undefined)
 await activate(page.getByRole('button',{name:'Topics',exact:true}));await page.waitForURL(BASE+'/theology/doctrine');await page.locator('.study-collection').first().waitFor()
 await activate(page.getByRole('link',{name:'Back to Theology',exact:true}));await page.waitForURL(BASE+'/theology')
 await go(first.id);assert.equal(await toggle().getAttribute('aria-pressed'),'true');await activate(toggle());await page.reload();await toggle().waitFor();assert.equal(await toggle().getAttribute('aria-pressed'),'false')
 const hash=await page.evaluate(async id=>{const {studyDB}=await import('/src/theology/store.ts'),{sourceHash}=await import('/src/theology/source.ts');return sourceHash((await studyDB.editions.get(['local-device',id])).source)},installed.id)
 assert.equal(hash,installed.id);assert.deepEqual(errors,[])
 report.push({width,touch,contextualRemoval:true,keyboardEscape:true,touchEmulation:touch,reloadDeletion:true,undoNewId:true,staleEditTombstone:true,dailyBoundaries:true,crossTopicNavigation:true,placePersistence:true,hiddenDownloads:true,unchangedCards:9,topicColors:3,lightDark:true,darkPreferenceReload:true,sourceUnchanged:true,contrast,minimumHighlightContrast:Math.min(...contrastRatios)})
 console.log('PASS daily reader controls',width,touch?'touch emulation':'keyboard/mouse');await context.close()
}}finally{await browser.close()}
await writeFile(`${out}/checks.json`,JSON.stringify({browser:'Chromium; synthetic fixtures only; no physical iPhone or Safari testing',results:report},null,2))
