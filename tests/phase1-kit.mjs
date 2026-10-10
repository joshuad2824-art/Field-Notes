import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { clock, dueStamp, lateBy } from '../src/lib/format.ts'
assert.equal(clock('00:00'),'12 AM');assert.equal(clock('16:00'),'4 PM');assert.equal(clock('09:30'),'9:30 AM');assert.equal(clock('24:01'),'');assert.equal(clock('bad'),'')
assert.equal(lateBy(0,86400000),'1 day late');assert.equal(lateBy(0,86400000*16),'16 days late');assert.equal(lateBy(86400000,0),'');assert.equal(dueStamp(NaN),'')
const {chromium}=await import(`${execSync('npm root -g',{encoding:'utf8'}).trim()}/playwright/index.mjs`)
const BASE=process.env.BASE||'http://127.0.0.1:5197'
if(!['127.0.0.1','localhost'].includes(new URL(BASE).hostname))throw Error('Local fixtures only')
const out=process.env.KIT_OUT||'/tmp/field-notes-kit';mkdirSync(out,{recursive:true})
const browser=await chromium.launch()
try{for(const width of [1440,744,390]){
 const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width<1024,reducedMotion:width===744?'reduce':'no-preference'})
 await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(BASE).origin?r.continue():r.abort())
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto(BASE+'/tests/design-check.html');await page.getByRole('button',{name:'Load fixtures'}).click();await page.getByText('Fixtures ready').waitFor()
 const snapshot=()=>page.evaluate(async()=>{const {db}=await import('/src/lib/db.ts');return {pages:await db.pages.toArray(),events:await db.events.toArray(),notes:await db.sienaItems.toArray(),notebooks:await db.notebooks.toArray()}})
 const before=await snapshot()
 await page.goto(BASE+'/kit');await page.getByRole('heading',{name:'At the desk.',exact:true}).waitFor()
 assert.equal(await page.locator('.kit-paper').count()>=7,true)
 assert.equal(await page.locator('.kit-card').count(),3)
 const fit=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${width}: no overflow`)
 await fit()
 const trigger=page.getByRole('button',{name:'Choose paper',exact:true});await trigger.scrollIntoViewIfNeeded();await trigger.focus();await page.keyboard.press('Enter')
 await page.getByRole('dialog',{name:'Choose paper'}).waitFor();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.equal(await trigger.innerText(),'MANILA\n▾');assert.equal(await trigger.evaluate(e=>e===document.activeElement),true)
 await trigger.click();await page.keyboard.press('End');await page.keyboard.press('Enter');assert.equal(await trigger.innerText(),'NIGHT PLATE\n▾')
 await trigger.click();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await trigger.evaluate(e=>e===document.activeElement),true)
 const fold=page.getByRole('button',{name:/^Other notes/});await fold.focus();await page.keyboard.press('Space');assert.equal(await fold.getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await fold.getAttribute('aria-expanded'),'false')
 const words=page.locator('.kit-row-reminder .kit-row-words').first();await words.click();assert.equal(await words.getAttribute('aria-expanded'),'true')
 const complete=page.locator('.kit-row-toggle').first();await complete.click();await page.locator('.kit-row-wrap.is-done').first().waitFor();await page.waitForTimeout(1300);assert.equal(await complete.isVisible(),false)
 const rail=page.locator('.kit-rail'),heights=await rail.locator('.kit-spine').evaluateAll(es=>es.map(e=>e.style.height));await page.getByRole('button',{name:'Fold navigation'}).click();assert.equal(await rail.evaluate(e=>e.getBoundingClientRect().width),72);await page.getByRole('button',{name:'Expand navigation'}).click();assert.deepEqual(await rail.locator('.kit-spine').evaluateAll(es=>es.map(e=>e.style.height)),heights)
 assert.equal(await page.getByRole('button',{name:'Jot',exact:true}).isDisabled(),true)
 await page.getByRole('button',{name:'Preview room transition'}).click()
 const duration=await page.locator('.kit-room').evaluate(e=>e.getAnimations()[0]?.effect.getTiming().duration);assert.equal(duration,width===744?90:420)
 await page.waitForTimeout(450);await fit();await page.screenshot({path:`${out}/kit-navigation-${width}.png`});await page.locator('.kit-preview').evaluate(e=>e.scrollTop=0);await page.screenshot({path:`${out}/kit-${width}.png`})
 assert.deepEqual(await snapshot(),before,'Kit preview does not alter real local records')
 for(const path of ['/overview','/calendar','/workshop']){
  await page.goto(BASE+path);await page.locator('.fn-app').waitFor();await page.waitForTimeout(100)
  const tiny=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&e.getBoundingClientRect().width>1&&e.getBoundingClientRect().height>1&&getComputedStyle(e).visibility!=='hidden').map(e=>({class:e.className,font:getComputedStyle(e).fontFamily,size:parseFloat(getComputedStyle(e).fontSize)})).filter(e=>/Courier|Archivo/.test(e.font)&&e.size<11))
  assert.deepEqual(tiny,[],`${width} ${path} metadata type floor`)
 }
 assert.deepEqual(errors,[]);console.log(`PASS ${width}: kit layouts, menu keyboard/focus, fold, completion, stable rail, reduced motion, real-data preservation, and Phase 1 type floor`);await context.close()
}}finally{await browser.close()}
