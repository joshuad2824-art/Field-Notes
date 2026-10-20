import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { isSienaArchived, SIENA_RETENTION_MS } from '../src/lib/siena-archive.ts'
import { sienaItemToRow, rowToSienaItem, sameSienaItem } from '../src/sync/wire.ts'
const now = Date.now(), old = now - SIENA_RETENTION_MS
const base = {id:'old-message',type:'note',title:'Reference update',body:'A useful reference.',created:old,updated:old}
assert.equal(isSienaArchived({...base,requiresAction:false},now),true)
assert.equal(isSienaArchived({...base,requiresAction:false,created:old+1},now),false)
assert.equal(isSienaArchived({...base,seenAt:now},now),false,'seen legacy message stays active')
assert.equal(isSienaArchived({...base,requiresAction:true,seenAt:now},now),false)
assert.equal(isSienaArchived({...base,resolvedAt:now},now),true)
assert.equal(isSienaArchived({...base,resolvedAt:now,retainedAt:now},now),false)
assert.equal(isSienaArchived({...base,resolvedAt:now,created:now},now),false)
assert.equal(isSienaArchived({...base,type:'reminder',completedAt:now,created:now},now),true)
assert.equal(isSienaArchived({...base,type:'reminder',seenAt:now},now),false)
for (const item of [base,{...base,requiresAction:false},{...base,requiresAction:true,resolvedAt:now,retainedAt:now,stateAt:now}]) {
 assert.deepEqual(rowToSienaItem(sienaItemToRow(item,'fixture')),item)
 assert.equal(sameSienaItem(item,{...item,retainedAt:now+1}),false)
 assert.equal(sameSienaItem(item,{...item,stateAt:now+1}),false)
}
const {chromium}=await import(`${execSync('npm root -g',{encoding:'utf8'}).trim()}/playwright/index.mjs`)
const BASE=process.env.BASE||'http://127.0.0.1:5197'
if(!['127.0.0.1','localhost'].includes(new URL(BASE).hostname)) throw Error('Unpaired localhost only')
mkdirSync('work/2026-10-19-siena-archive',{recursive:true})
const browser=await chromium.launch()
try {
 for(const width of [1440,820,390]) {
  const context=await browser.newContext({viewport:{width,height:900}})
  await context.route('**/*',r=>new URL(r.request().url()).origin===BASE?r.continue():r.abort())
  const p=await context.newPage(),errors=[]
  p.on('pageerror',e=>errors.push(e.message))
  await p.goto(BASE+'/tests/redesign-check.html')
  await p.getByRole('button',{name:'Load redesign fixtures'}).click()
  await p.getByText('Fixtures ready').waitFor()
  await p.evaluate(async()=>{
   const {db,changed}=await import('/src/lib/db.ts')
   const now=Date.now(),old=now-4*86400000
   const item=(id,extra={})=>({id,type:'note',title:id,body:'## What changed\n\nA **clear heading**, *gentle emphasis*, and ==one highlight==.\n\nNext step:\nConfirm the choice.\n\n<script>window.bad=1</script>\n\n[unsafe](javascript:alert) and [reference](https://example.com).',created:old,updated:old,notebook:'church',...extra})
   await db.sienaItems.bulkPut([item('Archive reference',{requiresAction:false}),item('Open decision',{seenAt:now}),item('Recent reference',{requiresAction:false,created:now}),item('Completed fixture',{type:'reminder',dueAt:old,completedAt:now}),item('Work brief',{notebook:'d97288df-10bc-451f-8903-82d4e0c74873'})])
   await db.meta.put({key:'siena-test-pages',value:JSON.stringify(await db.pages.toArray())})
   await db.meta.put({key:'siena-test-count',value:await db.sienaItems.count()})
   changed()
  })
  await p.goto(BASE+'/from-siena')
  await p.getByRole('heading',{name:'Open decision',exact:true}).waitFor()
  assert.equal(await p.locator('details.siena-history, .siena-featured details').count(),0)
  assert.equal(await p.getByRole('heading',{name:'Archive reference',exact:true}).count(),0)
  const card=p.locator('.siena-item').filter({has:p.getByRole('heading',{name:'Open decision',exact:true})})
  assert.equal(await card.locator('.siena-prose strong').count(),1)
  assert.equal(await card.locator('.siena-prose em').count(),1)
  assert.equal(await card.locator('.siena-prose mark').count(),1)
  assert.equal(await card.locator('.siena-prose h4').count(),2)
  assert.equal(await card.locator('.siena-prose script, a[href^="javascript:"]').count(),0)
  await card.getByRole('button',{name:'Resolve',exact:true}).click()
  await p.getByRole('heading',{name:'Open decision',exact:true}).waitFor({state:'detached'})
  await p.getByRole('link',{name:'Archive',exact:true}).click()
  await p.getByRole('heading',{name:'Archive',exact:true}).waitFor()
  await p.getByRole('searchbox',{name:'Search archive'}).fill('decision')
  const archived=p.locator('.siena-item').filter({has:p.getByRole('heading',{name:'Open decision',exact:true})})
  await archived.getByRole('button',{name:'Restore to active',exact:true}).click()
  await p.getByText('No matching items.').waitFor()
  await p.reload()
  await p.getByRole('searchbox',{name:'Search archive'}).fill('decision')
  await p.getByText('No matching items.').waitFor()
  await p.getByRole('searchbox',{name:'Search archive'}).fill('completed fixture')
  await p.getByRole('button',{name:'Reopen reminder',exact:true}).click()
  await p.getByText('No matching items.').waitFor()
  await p.getByRole('searchbox',{name:'Search archive'}).fill('')
  await p.screenshot({path:`work/2026-10-19-siena-archive/${width}-archive.png`,fullPage:true})
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  await p.goto(BASE+'/n/d97288df-10bc-451f-8903-82d4e0c74873/desk')
  await p.getByRole('heading',{name:'Work brief',exact:true}).waitFor()
  assert.equal(await p.locator('.work-brief .siena-prose strong').count(),1)
  assert.equal(await p.locator('.work-earlier,.work-done').count(),0)
  await p.screenshot({path:`work/2026-10-19-siena-archive/${width}-st-john.png`,fullPage:true})
  const proof=await p.evaluate(async()=>{
    const {db}=await import('/src/lib/db.ts')
    const {sienaItemToRow,rowToSienaItem}=await import('/src/sync/wire.ts')
    const a=await db.sienaItems.get('Open decision'),r=await db.sienaItems.get('Completed fixture')
    const before=(await db.meta.get('siena-test-pages')).value
    return {pagesUnchanged:before===JSON.stringify(await db.pages.toArray()),restored:!!a.retainedAt,resolved:!!a.resolvedAt,reopened:!r.completedAt,roundtrip:JSON.stringify(rowToSienaItem(sienaItemToRow(a,'fixture')))===JSON.stringify(a),bodyIntact:a.body.includes('<script>window.bad=1</script>'),count:await db.sienaItems.count(),originalCount:(await db.meta.get('siena-test-count')).value}
  })
  assert.equal(proof.pagesUnchanged,true)
  assert.equal(proof.restored,true)
  assert.equal(proof.resolved,true)
  assert.equal(proof.reopened,true)
  assert.equal(proof.bodyIntact,true)
  assert.equal(proof.count,proof.originalCount)
  const backupProof=await p.evaluate(async()=>{
    const {db}=await import('/src/lib/db.ts')
    const {importFiles}=await import('/src/lib/import.ts')
    const {zipSync,strToU8}=await import('/node_modules/fflate/esm/browser.js')
    const item={...(await db.sienaItems.get('Open decision')),id:'backup-roundtrip',requiresAction:false}
    const bytes=zipSync({'field-notes-data.json':strToU8(JSON.stringify({format:'field-notes-data',version:1,events:[],sienaItems:[item]}))})
    await importFiles([new File([bytes],'fixture.zip',{type:'application/zip'})])
    return {expected:item,actual:await db.sienaItems.get(item.id)}
  })
  assert.deepEqual(backupProof.actual,backupProof.expected,'Archive metadata survives backup import')
  assert.deepEqual(errors,[])
  await context.close()
  console.log('PASS Siena Archive/render/restore/notebook preservation',width)
 }
} finally {await browser.close()}
console.log('PASS 72-hour boundary, unknown actions retained, read != resolved, completion/archive, wire metadata roundtrip')
