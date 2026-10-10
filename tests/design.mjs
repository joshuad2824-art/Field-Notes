import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { readingBlocks, planReading, safeReadingUrl, decorationFor, planPapers } from '../src/lib/reading.ts'
const nested = readingBlocks('- first\n  - nested\n- second\n\n5. step\n6. next\n\n```text\n# literal\n```')
assert.equal(nested[0].items.length,2);assert.equal(nested[0].items[0].blocks[1].kind,'list');assert.equal(nested[1].start,5);assert.equal(nested[2].text,'# literal')
assert.equal(safeReadingUrl('javascript:alert(1)'),null);assert.equal(safeReadingUrl('//evil.example'),null);assert.equal(safeReadingUrl('https://example.com'),'https://example.com')
assert.equal(planReading('# Title\n#project-plan\nVersion: 2\n\n## Keep\nVersion: this is prose','Title').sections[0].blocks[0].text,'Version: this is prose')
const fitted = readingBlocks('{table 70}\n| A | B |\n| :--- | ---: |\n| merged | < |\n| ^ | ^ |')[0].table
assert.equal(fitted.width,70);assert.equal(fitted.rows[1][0].span,2);assert.equal(fitted.rows[1][0].rows,2);assert.equal(fitted.aligns[1],'right')
assert.equal(readingBlocks('{center}## Centered title')[0].align,'center')
assert.equal(readingBlocks('```text\n{center}literal\n```')[0].text,'{center}literal')
assert.equal(decorationFor('stable'),decorationFor('stable'))
const mix=planPapers('plan',Array.from({length:26},(_,i)=>`Section ${i}`));assert.deepEqual(mix,planPapers('plan',Array.from({length:26},(_,i)=>`Section ${i}`)));assert.equal(new Set(mix.slice(0,5).map(p=>p.paper)).size,5);assert.ok(mix.every((p,i)=>!i||(p.paper!==mix[i-1].paper&&p.decoration!==mix[i-1].decoration)))
const { chromium }=await import(`${execSync('npm root -g',{encoding:'utf8'}).trim()}/playwright/index.mjs`)
const BASE=process.env.BASE||'http://127.0.0.1:5188', out=process.env.DESIGN_OUT||'/tmp/field-notes-design'
if(!['127.0.0.1','localhost'].includes(new URL(BASE).hostname))throw Error('Local fixtures only')
mkdirSync(out,{recursive:true});const browser=await chromium.launch()
try { for(const [width,height] of [[1920,1080],[1440,900],[1280,800],[1024,768],[768,1024],[390,844],[320,760]]) {
 const context=await browser.newContext({viewport:{width,height}});await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(BASE).origin?route.continue():route.abort())
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto(`${BASE}/tests/design-check.html`);await page.getByRole('button',{name:'Load fixtures'}).click();await page.getByText('Fixtures ready').waitFor()
 const snapshot=()=>page.evaluate(async()=>{const {db}=await import('/src/lib/db.ts');return {pages:await db.pages.toArray(),notebooks:await db.notebooks.toArray(),image:Array.from(new Uint8Array(await (await db.images.get('design-image')).blob.arrayBuffer()))}})
 const before=await snapshot()
 const fit=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth && Array.from(document.querySelectorAll('main,.approved-content,.plan-paper,.fn-shell')).every(el=>el.scrollWidth<=el.clientWidth+1)),true,`${width} no horizontal overflow`)
 await page.goto(`${BASE}/workshop`);await page.locator('.desk-plan-link').first().waitFor();assert.equal(await page.locator('.desk-plan-link').count(),4);assert.equal(await page.getByRole('link',{name:/Open (?:The )?Workshop notebook/}).count(),0)
 assert.equal(await page.locator('.desk-revision-edit').first().innerText(),'');assert.ok(await page.getByRole('button',{name:'Add plan',exact:true}).isVisible());await fit()
 await page.screenshot({path:`${out}/workshop-${width}.png`})
 await page.goto(`${BASE}/n/workshop`);await page.getByRole('heading',{name:'Workshop',exact:true}).waitFor();assert.equal(await page.locator('.desk-plan-link').count(),4)
 await page.goto(`${BASE}/n/design-workshop-folder`);await page.getByRole('heading',{name:'Workshop',exact:true}).waitFor();await page.waitForURL(`${BASE}/workshop`);assert.equal(await page.getByRole('link',{name:'New page',exact:true}).getAttribute('href'),'/new/field-notes')
 await page.goto(`${BASE}/plan/design-plan`);await page.locator('.plan-image img').waitFor();assert.equal(await page.locator('.plan-image').count(),1);assert.equal(await page.locator('.plan-paper h1').count(),1);assert.equal(await page.locator('.reading-content h3').count(),2)
 assert.ok(await page.locator('.reading-content ul ul').count());assert.equal(await page.locator('ol').getAttribute('start'),'1');assert.equal(await page.locator('.reading-content pre').first().textContent(),'┌───────────────┐\n│  tray A       │\n├───────────────┤\n│  tray B       │\n└───────────────┘')
 assert.equal(await page.locator('.reading-content strong').first().textContent(),'wooden field case');assert.equal(await page.locator('a[href^="javascript:"]').count(),0);assert.equal(await page.evaluate(()=>window.designInjected),undefined)
 const papers = await page.locator('.plan-section').evaluateAll(nodes => nodes.map(el => ({paper:el.dataset.paper,background:getComputedStyle(el).backgroundColor,texture:getComputedStyle(el).backgroundImage,x:el.getBoundingClientRect().x,width:el.getBoundingClientRect().width})))
 assert.equal(new Set(papers.map(p=>p.background)).size,5,'Five varied paper colors');assert.ok(new Set(papers.map(p=>p.texture)).size>=4,'Distinct paper textures');if(width>=1024)assert.ok(papers[0].x<papers[1].x,'Desktop cards sit side by side');else assert.equal(papers[0].x,papers[1].x,'Phone keeps one column');
 assert.equal(await page.locator('.plan-tools').innerText(),'');await fit();assert.deepEqual(await snapshot(),before)
 await page.screenshot({path:`${out}/plan-${width}.png`})
 await page.getByLabel('Jump to plan section').selectOption({label:'Build sequence'});assert.ok(await page.locator('.plan-screen').evaluate(el=>el.scrollTop)>0);assert.equal(await page.evaluate(()=>document.activeElement.id),'plan-section-4')
 await page.getByRole('button',{name:'Edit plan',exact:true}).click();await page.locator('.cm-content').waitFor();assert.equal(await page.locator('.listcol').count(),0);await page.getByRole('button',{name:'Back to plan',exact:true}).first().click();await page.locator('.plan-section').first().waitFor();assert.deepEqual(await snapshot(),before)
 await page.goto(BASE);await page.getByText('Afternoon workshop',{exact:true}).first().waitFor();assert.equal(await page.locator('.fn-reminder-items .reminder-compact').count(),4)
 assert.equal(await page.locator('.fn-page-right').getByText('Afternoon workshop',{exact:true}).count(),1);assert.equal(await page.locator('.dashboard-today .overview-events').count(),0);assert.equal(await page.locator('.fn-page-right').getByText('Work at the desk',{exact:true}).count(),0);assert.equal(await page.locator('.desk-project').count(),1);assert.equal(await page.locator('.desk-note-summary').textContent(),'Lay out the boards');assert.deepEqual(await snapshot(),before)
 const weather=page.getByRole('region',{name:'Out the window'});assert.ok(await weather.isVisible());assert.equal(await weather.evaluate(el=>!!el.closest('details')),false);assert.ok(await weather.evaluate(el=>el.getBoundingClientRect().bottom)<=await page.locator('.dashboard-priority').evaluate(el=>el.getBoundingClientRect().top),'Weather stays above dashboard cards')
 assert.equal(await weather.locator('.fn-forecast-day:visible').count(),width<=640?5:7,'Five forecast days on phones, seven on desktop')
 if(width>=1024){const separated = await page.evaluate(()=>document.querySelector('.fn-date').getBoundingClientRect().right <= document.querySelector('.fn-header-actions').getBoundingClientRect().left - 2);assert.ok(separated,'Header controls do not cover date');const top=await page.locator('.overview-events').evaluate(el=>el.getBoundingClientRect().top);assert.ok(top<height/2,'Today visible in opening desktop view')}
 await fit();await page.screenshot({path:`${out}/dashboard-${width}.png`})
 await page.getByRole('link',{name:'All reminders',exact:true}).click();await page.locator('.siena-collection .reminder-compact').first().waitFor();assert.equal(await page.locator('.reminder-compact').count(),12)
 await page.goto(`${BASE}/settings`);await page.locator('#settings-appearance').waitFor();assert.equal(await page.locator('#settings-advanced').getAttribute('open'),null);await fit();await page.screenshot({path:`${out}/settings-${width}.png`})
 await page.goto(`${BASE}/calendar`);await page.locator('.rows .row-title').first().waitFor();assert.equal(await page.locator('.rows .row-title').first().evaluate(el=>getComputedStyle(el).color),'rgb(20, 42, 43)','Calendar note titles use dark ink');await fit();
 await page.goto(`${BASE}/event/new`);await page.locator('.event-form').waitFor();await fit();await page.screenshot({path:`${out}/event-${width}.png`})
 await page.goto(`${BASE}/review/design-plan`);await page.locator('.review-reading strong').first().waitFor();await fit()
 assert.deepEqual(await snapshot(),before)
 await page.goto(`${BASE}/trash`);const disposable=page.locator('.row-page').filter({hasText:'Discardable design fixture'})
 await disposable.getByRole('button',{name:'Delete now',exact:true}).click();await page.getByRole('alertdialog').waitFor();assert.deepEqual(await snapshot(),before)
 await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await disposable.count(),1)
 await disposable.getByRole('button',{name:'Delete now',exact:true}).click();await page.getByRole('button',{name:'Delete permanently',exact:true}).click();await disposable.waitFor({state:'detached'})
 assert.deepEqual(await snapshot(),{...before,pages:before.pages.filter(p=>p.id!=='design-trash')});assert.deepEqual(errors,[])
 console.log(`PASS ${width}×${height}: plan structure and safe text, image/source preservation, Workshop routing, focused edit, reminder reachability, desktop priority, forms and no overflow`)
 await context.close()
}}finally{await browser.close()}
