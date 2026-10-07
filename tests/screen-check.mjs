// Run against the built preview (npm run build && npm run preview).
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
const { chromium } = await import(`${execSync('npm root -g', { encoding: 'utf8' }).trim()}/playwright/index.mjs`)
const browser = await chromium.launch()
const base = process.env.BASE ?? 'http://127.0.0.1:4173'
try {
 const context=await browser.newContext({viewport:{width:430,height:932}})
 const page=await context.newPage()
 const errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(base+'/overview',{waitUntil:'domcontentloaded'})
 await page.getByRole('heading',{name:'Today in Field Notes'}).waitFor()
 await page.evaluate(async()=>{ await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready })
 await page.reload({waitUntil:'domcontentloaded'})
 const workerText=await (await page.request.get(base+'/sw.js')).text()
 const version=workerText.match(/const VERSION = '([^']+)'/)[1]
 const cacheName=`shell-${version}`
 const shell=await page.evaluate(async name=> (await (await caches.open(name)).match('/')).text(),cacheName)
 for(const [variant,status] of [['a','black-translucent'],['b','default']]) {
  await page.goto(base+'/screen-check/'+variant+'/',{waitUntil:'domcontentloaded'})
  await page.getByRole('heading',{name:new RegExp('Screen '+variant.toUpperCase())}).waitFor()
  assert.equal(await page.locator('meta[name="apple-mobile-web-app-status-bar-style"]').getAttribute('content'),status)
  const manifest=await (await page.request.get(base+'/screen-check/'+variant+'/manifest.webmanifest')).json()
  assert.equal(manifest.start_url,'/screen-check/'+variant+'/')
  await page.getByLabel('Keyboard check — temporary test text').fill('The bottom edge should remain visible.')
  await page.getByRole('button',{name:'Dismiss keyboard'}).click()
  for(const width of [320,430,932]) {
   await page.setViewportSize({width,height:width===932?430:932})
   assert.equal(await page.locator('footer').evaluate(el=>Math.round(el.getBoundingClientRect().bottom)),width===932?430:932)
   assert.equal(await page.locator('#root').evaluate(el=>el.scrollWidth<=el.clientWidth),true)
  }
  await page.setViewportSize({width:430,height:932})
  assert.equal(await page.evaluate(async name=> (await (await caches.open(name)).match('/')).text(),cacheName),shell)
 }
 await context.setOffline(true)
 await page.goto(base+'/overview',{waitUntil:'domcontentloaded'})
 await page.getByRole('heading',{name:'Today in Field Notes'}).waitFor()
 assert.deepEqual(errors,[])
 console.log('PASS distinct launch settings, manifests, phone/landscape fit, and unchanged offline app shell')
} finally {await browser.close()}
