import assert from 'node:assert/strict'
import {execSync} from 'node:child_process'
import {mkdir,writeFile} from 'node:fs/promises'
const {chromium}=await import(`${execSync('npm root -g',{encoding:'utf8'}).trim()}/playwright/index.mjs`)
const BASE=process.env.BASE||'http://127.0.0.1:5197',out='work/check-results/room-headings'
if(!['localhost','127.0.0.1'].includes(new URL(BASE).hostname))throw Error('Local synthetic fixtures only')
await mkdir(out,{recursive:true})
const browser=await chromium.launch(),report=[]
try{for(const width of [1440,820,390]){
 const context=await browser.newContext({viewport:{width,height:900}})
 await context.route('**/*',r=>new URL(r.request().url()).origin===BASE?r.continue():r.abort())
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto(BASE+'/tests/redesign-check.html');await page.getByRole('button',{name:'Load redesign fixtures'}).click();await page.getByText('Fixtures ready').waitFor()
 const style=async selector=>page.locator(selector).evaluate(el=>{const s=getComputedStyle(el);return {size:s.fontSize,weight:s.fontWeight,family:s.fontFamily,spacing:s.letterSpacing,transform:s.textTransform,lineHeight:s.lineHeight}})
 await page.goto(BASE+'/overview');await page.locator('.board-header h1').waitFor();const today=await style('.board-header h1')
 assert.equal(today.size,'15px');assert.equal(today.weight,'500');assert.equal(today.spacing,'3.6px');assert.equal(today.transform,'uppercase')
 await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`${out}/${width}-today.png`})
 await page.goto(BASE+'/theology');await page.locator('.theology-heading h1').waitFor();assert.deepEqual(await style('.theology-heading h1'),today)
 await page.screenshot({path:`${out}/${width}-theology.png`})
 const work=await page.evaluate(async()=>(await import('/src/lib/notebook-desk.ts')).ST_JOHN_NOTEBOOK)
 await page.goto(BASE+'/n/'+work+'/desk');await page.locator('.redesign-desk-header h1').waitFor();assert.deepEqual(await style('.redesign-desk-header h1'),today)
 assert.deepEqual(await style('.redesign-desk-header .notebook-switcher-name'),today)
 await page.screenshot({path:`${out}/${width}-st-john.png`})
 const switcher=page.getByRole('button',{name:'St. John — switch notebook',exact:true});await switcher.click();assert.equal(await switcher.getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await switcher.getAttribute('aria-expanded'),'false')
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0)
 assert.deepEqual(errors,[]);report.push({width,style:today,switcher:true});console.log('PASS room headings',width);await context.close()
}}finally{await browser.close()}
await writeFile(`${out}/checks.json`,JSON.stringify(report,null,2))
