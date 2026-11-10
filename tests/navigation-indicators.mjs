import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
const { chromium } = await import(`${execSync('npm root -g',{encoding:'utf8'}).trim()}/playwright/index.mjs`)
const base=process.env.BASE||'http://127.0.0.1:5199'
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local fictional fixtures only')
const browser=await chromium.launch()
try {
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:956}})
  await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort())
  const page=await context.newPage()
  await page.goto(base+'/tests/redesign-check.html');await page.getByRole('button',{name:'Load redesign fixtures'}).click();await page.getByText('Fixtures ready').waitFor()
  const visit=async route=>{await page.goto(base+route);await page.locator('.floating-nav').waitFor();assert.equal(await page.locator('.title-chevron,.notebook-switcher-chevron,.pill-room-caret').count(),0)}
  await visit('/calendar/2026-11')
  await page.getByRole('button',{name:'Next month',exact:true}).click();await page.waitForURL('**/calendar/2026-12')
  await page.getByRole('button',{name:'Previous month',exact:true}).click();await page.waitForURL('**/calendar/2026-11')
  await page.locator('.month-toggle').click();await page.waitForURL('**/day/*')
  if(await page.locator('.agenda-day-heading').isVisible()){await page.locator('.agenda-day-heading').click();await page.waitForURL('**/calendar/2026-11')}else await visit('/calendar/2026-11')
  await page.locator('.pill-room').click();assert.equal(await page.locator('.pill-room').getAttribute('aria-expanded'),'true')
  await page.getByRole('link',{name:'Workshop',exact:true}).click();await page.waitForURL('**/workshop')
  await page.getByRole('button',{name:'Workshop menu',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Workshop menu',exact:true}).getAttribute('aria-expanded'),'true');assert(await page.locator('.workshop-menu').getByRole('button',{name:'New plan',exact:true}).isVisible())
  await visit('/plan/redesign-plan');await page.locator('.plan-title-button').click();assert.equal(await page.locator('.plan-title-button').getAttribute('aria-expanded'),'true');assert(await page.getByRole('menu',{name:'Plan',exact:true}).isVisible())
  await visit('/n/d97288df-10bc-451f-8903-82d4e0c74873/desk');await page.locator('.notebook-switcher-name:visible').first().click();assert.equal(await page.locator('.notebook-switcher-name:visible').first().getAttribute('aria-expanded'),'true');assert(await page.getByRole('menu',{name:'Notebooks',exact:true}).isVisible())
  console.log('PASS title menus, room navigation, calendar directions and notebook switching',width)
  await context.close()
 }
} finally {await browser.close()}
