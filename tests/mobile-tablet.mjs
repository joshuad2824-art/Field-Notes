import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const { chromium } = await import(`${execSync('npm root -g',{encoding:'utf8'}).trim()}/playwright/index.mjs`)
const BASE=process.env.BASE||'http://127.0.0.1:5188', out='/tmp/field-notes-mobile-tablet'
if(!['localhost','127.0.0.1'].includes(new URL(BASE).hostname))throw Error('Unpaired localhost only')
mkdirSync(out,{recursive:true})
const browser=await chromium.launch()
try {for(const [width,height] of [[320,760],[390,844],[600,960],[744,1133],[768,1024],[1024,768],[1133,744],[1440,900]]) {
 const context=await browser.newContext({viewport:{width,height},hasTouch:width<1280})
 await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(BASE).origin?r.continue():r.abort())
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto(`${BASE}/tests/design-check.html`);await page.getByRole('button',{name:'Load fixtures'}).click();await page.getByText('Fixtures ready').waitFor()
 const saved=()=>page.evaluate(async()=>{const {db}=await import('/src/lib/db.ts');return {pages:await db.pages.toArray(),events:await db.events.toArray(),notes:await db.sienaItems.toArray(),images:await Promise.all((await db.images.toArray()).map(async i=>({...i,blob:Array.from(new Uint8Array(await i.blob.arrayBuffer()))})))}})
 const before=await saved(),rect=el=>el.getBoundingClientRect().toJSON()
 const fit=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth && [...document.querySelectorAll('.approved-content,.fn-shell,.plan-paper,.leaf,.listcol,.event-form')].every(el=>el.scrollWidth<=el.clientWidth+1)),`${width} ${page.url()} no overflow: ${JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll(".approved-content,.fn-shell,.plan-paper,.leaf,.listcol,.event-form")].filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>({class:el.className,scroll:el.scrollWidth,width:el.clientWidth}))))}`)
 const nav=page.locator('.fn-mobile-navigation')
 const icons=async()=>{if(width>=1024)return;assert.equal(await nav.locator('a').count(),4);assert.equal((await nav.innerText()).trim(),'');for(const name of ['Today','Notebooks','Workshop','Calendar']){const link=nav.getByRole('link',{name,exact:true});const r=await link.evaluate(rect);assert.ok(r.width>=44&&r.height>=44);assert.equal(await link.getAttribute('title'),name)}assert.equal(await nav.locator('[aria-current="page"]').count(),new URL(page.url()).pathname==='/settings'?0:1)}
 await page.goto(BASE);await page.getByText('Afternoon workshop',{exact:true}).first().waitFor();await icons();await fit()
 const [left,right,spread,ribbon]=await Promise.all(['.fn-page-left','.fn-page-right','.fn-book-spread','.fn-book-ribbon'].map(s=>page.locator(s).evaluate(rect)))
 if(width<=640){assert.equal(left.x,right.x);assert.equal(left.width,right.width);assert.ok(Math.abs(left.bottom-right.top)<=1,'Flush seam');assert.ok(ribbon.top>=right.top,'Ribbon contained in events page');assert.ok(right.bottom<=spread.bottom+1);assert.equal(await page.locator('.fn-book-spread').evaluate(el=>getComputedStyle(el).overflow),'hidden')}
 else {assert.ok(left.right<=right.left+1);assert.ok(Math.abs(left.top-right.top)<=1);if(width<=1279){const rem=await page.locator('.fn-open-reminder').evaluate(rect),parent=await page.locator('.dashboard-today').evaluate(rect);assert.ok(Math.abs(rem.width-parent.width)<=1,'Reminder uses full tablet width');const reminders=await page.locator('.reminder-compact').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().x));assert.ok(reminders[0]<reminders[1],'Tablet reminders share row')}}
 assert.equal(await page.locator('.fn-forecast-day:visible').count(),width<=640?5:7)
 await page.screenshot({path:`${out}/dashboard-${width}.png`})
 if(width<1024)await nav.getByRole('link',{name:'Calendar',exact:true}).tap();else await page.locator('.fn-date-link').click()
 await page.getByRole('heading',{name:'Your month.',exact:true}).waitFor();await icons();await fit();if(width<1024){await nav.getByRole('link',{name:'Calendar',exact:true}).focus();await page.keyboard.press('Enter');assert.equal(await nav.getByRole('link',{name:'Calendar',exact:true}).evaluate(el=>el===document.activeElement),true)}
 const title=page.locator('.calendar-agenda .event-row-title').first();assert.equal(await title.evaluate(el=>getComputedStyle(el).color),'rgb(20, 42, 43)')
 if(width>640&&width<=1279){const cal=await page.locator('.calendar-overview').evaluate(rect),agenda=await page.locator('.calendar-agenda').evaluate(rect);assert.ok(cal.right<=agenda.left);const panel=await page.locator('.fn-calendar-large').evaluate(rect),count=await page.locator('.calendar-count').evaluate(rect);assert.ok(count.top-panel.bottom<30,'Count stays with calendar')}
 await page.screenshot({path:`${out}/calendar-${width}.png`})
 await page.locator('.fn-calendar-large').getByRole('button',{name:'The month after',exact:true}).click();const monthUrl=page.url()
 if(width<1024){await nav.getByRole('link',{name:'Workshop',exact:true}).tap();await page.getByRole('heading',{name:'Workshop',exact:true}).waitFor();await icons();await nav.getByRole('link',{name:'Calendar',exact:true}).tap();await page.waitForURL(monthUrl);await icons();await page.reload();await page.getByRole('heading',{name:'Your month.',exact:true}).waitFor();await icons()}
 for(const path of ['/workshop','/plan/design-plan','/n/field-notes','/p/design-project','/event/new','/settings']){
  await page.goto(`${BASE}${path}`);await page.locator('.approved-content').waitFor();if(path==='/p/design-project')await page.locator('.cm-content').waitFor();if(path==='/plan/design-plan')await page.locator('.plan-section').first().waitFor();await fit();await icons()
  if(path==='/p/design-project'&&width>=1120&&width<=1279){const list=await page.locator('.listcol').evaluate(rect),leaf=await page.locator('.leaf').evaluate(rect);assert.ok(list.width<=280);assert.ok(leaf.width>=600,'Tablet gets a comfortable writing page')}
  if(path==='/event/new'&&width<1024){await page.locator('.event-form-actions').scrollIntoViewIfNeeded();const actions=await page.locator('.event-form-actions').evaluate(rect),bar=await nav.evaluate(rect);assert.ok(actions.bottom<=bar.top+1,'Save controls stay above navigation');await page.evaluate(()=>document.documentElement.style.setProperty('--browser-bottom','34px'));const safe=await nav.evaluate(rect);assert.ok(safe.height>=94,'Home-indicator clearance');await page.evaluate(()=>document.documentElement.style.removeProperty('--browser-bottom'))}
  if(path==='/p/design-project')await page.screenshot({path:`${out}/editor-${width}.png`})
  if(width<1024){await nav.getByRole('link',{name:'Calendar',exact:true}).tap();await page.getByRole('heading',{name:'Your month.',exact:true}).waitFor();assert.equal(await nav.getByRole('link',{name:'Calendar',exact:true}).getAttribute('aria-current'),'page')}
 }
 assert.deepEqual(await saved(),before,'Responsive presentation and navigation preserve pages, images, events and notes');assert.deepEqual(errors,[])
 console.log(`PASS ${width}×${height}: named icon navigation, calendar memory, notebook geometry, tablet cards/editor, contrast and source preservation`)
 await context.close()
}}finally{await browser.close()}
