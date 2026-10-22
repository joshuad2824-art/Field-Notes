import assert from 'node:assert/strict'
import {execSync} from 'node:child_process'
import {mkdir,writeFile} from 'node:fs/promises'
const {chromium}=await import(`${execSync('npm root -g',{encoding:'utf8'}).trim()}/playwright/index.mjs`)
const BASE=process.env.BASE||'http://127.0.0.1:5205',host='highlight-sync-fixture.invalid',scope='synthetic-highlight-vault',key='synthetic-highlight-key',out='work/check-results/highlight-removal-sync'
if(!['localhost','127.0.0.1'].includes(new URL(BASE).hostname))throw Error('Synthetic localhost only')
const source='# Source text\n# Daily Readings\n## Synthetic topic\n### Week 1\n#### DAY 1\n##### Example reading\n\nA stored synthetic passage has several words worth marking. An unrelated passage remains intact.\n'
const tables={study_editions:new Map(),study_annotations:new Map(),study_places:new Map()},calls=[],errors=[],contexts=[]
const browser=await chromium.launch()
function merge(a,b){if(!a||b.updated>a.updated)return b;if(b.updated<a.updated)return a;return (b.deleted??0)>(a.deleted??0)?b:a}
async function device(){
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});contexts.push(context)
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.origin===BASE)return route.continue();if(url.hostname!==host)return route.abort()
  const headers={'access-control-allow-origin':BASE,'access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'}
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers})
  assert.equal(req.headers()['x-vault-key'],key)
  const table=url.pathname.split('/').pop(),rows=tables[table];if(!rows)return route.fulfill({json:[],headers})
  calls.push({table,method:req.method()})
  if(req.method()==='POST'){
   const data=req.postDataJSON();for(const row of Array.isArray(data)?data:[data]){assert.equal(row.vault,scope);rows.set(row.id,structuredClone(table==='study_editions'?rows.get(row.id)??row:merge(rows.get(row.id),row)))}
   return route.fulfill({status:201,body:'',headers})
  }
  return route.fulfill({json:[...rows.values()],headers})
 })
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000)
 await page.goto(BASE+'/tests/redesign-check.html')
 const installed=await page.evaluate(async({source,scope,key,host})=>{
  const {setVault}=await import('/src/sync/vault.ts');setVault({id:scope,key,url:'https://'+host,anonKey:'synthetic-anon'})
  const {installStudySource}=await import('/src/theology/store.ts'),{DAILY_DOCTRINE}=await import('/src/theology/model.ts')
  const edition=await installStudySource(new TextEncoder().encode(source),{title:'Synthetic transport edition',filename:'synthetic.md'})
  // Replace the catalog only in this isolated local browser's module instance.
  // Production source validation is unchanged; no private book is loaded.
  Object.assign(DAILY_DOCTRINE,{sha256:edition.id,bytes:edition.bytes})
  return {id:edition.id,section:edition.sections.find(s=>s.reading===1).id}
 },{source,scope,key,host})
 return {page,...installed}
}
const catalog=(page,id)=>page.evaluate(async({id,bytes})=>Object.assign((await import('/src/theology/model.ts')).DAILY_DOCTRINE,{sha256:id,bytes}),{id,bytes:Buffer.byteLength(source)})
const sync=page=>page.evaluate(async()=>{const {syncStudy,studySyncStatus}=await import('/src/theology/sync.ts');await syncStudy();return studySyncStatus()})
const marks=page=>page.evaluate(async()=>{const {studyDB,studyScope}=await import('/src/theology/store.ts');return studyDB.annotations.where('scope').equals(studyScope()).toArray()})
try{
 const a=await device()
 const originals=await a.page.evaluate(async({id,section})=>{
  const {studyDB,studyScope}=await import('/src/theology/store.ts'),{readingFor}=await import('/src/theology/reading.ts'),{annotationToRow}=await import('/src/theology/sync.ts')
  const e=await studyDB.editions.get([studyScope(),id]),r=readingFor(e,section),start=r.text.indexOf('stored synthetic'),end=r.text.indexOf('marking.')+8,at=Date.UTC(2026,9,20)
  const mark={scope:e.scope,edition:id,section,start,end,quote:r.text.slice(start,end),prefix:r.text.slice(Math.max(0,start-40),start),suffix:r.text.slice(end,end+40),color:'brass',created:at,updated:at}
  const rows=[{...mark,id:'old-one'},{...mark,id:'old-two',updated:Date.now()+60000},{...mark,id:'partial',start:start+4,end:end+8,quote:r.text.slice(start+4,end+8),color:'forest'}];await studyDB.annotations.bulkPut(rows);return rows.map(annotationToRow)
 },{id:a.id,section:a.section})
 for(const row of originals)tables.study_annotations.set(row.id,row)
 assert.equal(await sync(a.page),'synced')
 const b=await device();assert.equal(await sync(b.page),'synced')
 await b.page.evaluate(async()=>{const {studyDB,studyScope}=await import('/src/theology/store.ts');const row=await studyDB.annotations.get([studyScope(),'old-one']);await studyDB.annotations.put({...row,color:'navy',updated:row.updated+100})})
 await a.page.goto(BASE+'/theology/doctrine/'+a.section);await catalog(a.page,a.id);await a.page.locator('[data-study-highlight="old-two"]').first().tap();await a.page.getByRole('dialog',{name:'Highlight actions'}).getByRole('button',{name:'Remove highlight',exact:true}).tap()
 await a.page.getByRole('button',{name:'Undo',exact:true}).waitFor();assert.equal(await sync(a.page),'synced')
 assert.ok(['old-one','old-two'].every(id=>tables.study_annotations.get(id).deleted))
 assert.equal(await sync(b.page),'synced');assert.ok((await marks(b.page)).filter(r=>r.id.startsWith('old-')).every(r=>r.deleted),'offline stale color edit cannot resurrect either old id')
 assert.ok(!tables.study_annotations.get('partial').deleted)
 await a.page.getByRole('button',{name:'Undo',exact:true}).tap();assert.equal(await sync(a.page),'synced');assert.equal(await sync(b.page),'synced')
 const live=(await marks(a.page)).filter(r=>!r.deleted&&r.id!=='partial');assert.equal(live.length,1);assert.ok(!live[0].id.startsWith('old-'));assert.equal(live[0].color,'brass')
 await a.page.reload();await catalog(a.page,a.id);await a.page.locator(`[data-study-highlight="${live[0].id}"]`).first().waitFor();assert.equal(await a.page.locator('[data-study-highlight^="old-"]').count(),0)
 await a.page.locator('.study-highlight-list summary').click();await a.page.locator('.study-highlight-list>div').filter({hasText:live[0].quote.slice(0,25)}).getByRole('button',{name:'Remove highlight',exact:true}).tap();await a.page.getByRole('button',{name:'Undo',exact:true}).waitFor()
 await sync(a.page);await sync(b.page);await a.page.reload();await catalog(a.page,a.id);await a.page.locator('.study-source-text').waitFor();assert.equal((await marks(a.page)).filter(r=>!r.deleted&&r.id!=='partial').length,0);assert.ok(!tables.study_annotations.get('partial').deleted)
 assert.equal(await a.page.evaluate(async id=>{const {studyDB,studyScope}=await import('/src/theology/store.ts'),{sourceHash}=await import('/src/theology/source.ts');return sourceHash((await studyDB.editions.get([studyScope(),id])).source)},a.id),a.id)
 assert.deepEqual(errors,[])
 const result={devices:2,transport:'actual syncStudy with synthetic catalog and intercepted mirror',oldDuplicateRemoval:true,futureKnownClock:true,staleOfflineColor:true,undoFreshId:true,reloadedRemoval:true,partialOverlapPreserved:true,sourceUnchanged:true,calls:calls.length}
 await mkdir(out,{recursive:true});await writeFile(out+'/checks.json',JSON.stringify(result,null,2));console.log('PASS stored highlight transport',JSON.stringify(result))
}finally{for(const context of contexts)await context.close();await browser.close()}
