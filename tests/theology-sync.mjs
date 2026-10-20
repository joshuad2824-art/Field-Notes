import assert from 'node:assert/strict'
import {execSync} from 'node:child_process'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {unzipSync,strFromU8} from 'fflate'
const {chromium}=await import(`${execSync('npm root -g',{encoding:'utf8'}).trim()}/playwright/index.mjs`)
const BASE=process.env.BASE||'http://127.0.0.1:5197',scope='fictional-study-vault',key='fictional-study-key',host='study-fixture.invalid'
if(!['localhost','127.0.0.1'].includes(new URL(BASE).hostname))throw Error('Local isolated fixtures only')
if(!process.env.STUDY_SOURCE){console.log('SKIP paired study test: provide private STUDY_SOURCE outside repository');process.exit(0)}
const source=await readFile(process.env.STUDY_SOURCE),base64=source.toString('base64'),editionId='f35227ef7917f20ef0bf5003653e4174869889fa399cc73968c3ea02311e50d2'
const tables={study_editions:new Map(),study_annotations:new Map(),study_places:new Map()},calls=[],errors=[]
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}}
let gate=null,fail=null,tamper=null
function hold(table,method='GET'){const next={table,method,entered:deferred(),release:deferred()};gate=next;return next}
function merge(old,row,table){if(!old||row.updated>old.updated)return row;if(row.updated<old.updated)return old;if(table==='study_annotations')return (row.deleted??0)>(old.deleted??0)||(row.deleted??0)===(old.deleted??0)&&row.color>old.color?row:old;return row.section>old.section||row.section===old.section&&row.offset>old.offset?row:old}
const browser=await chromium.launch(),contexts=[]
async function device(){
 const context=await browser.newContext({viewport:{width:1440,height:900}});contexts.push(context)
 await context.route('**/*',async r=>{
  const url=new URL(r.request().url());if(url.origin===BASE)return r.continue();if(url.hostname!==host)return r.abort()
  const headers={'access-control-allow-origin':BASE,'access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'}
  if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers})
  const table=url.pathname.split('/').pop(),method=r.request().method(),body=method==='POST'?JSON.parse(r.request().postData()):null
  assert.equal(r.request().headers()['x-vault-key'],key);assert.equal(url.searchParams.get('vault')??'eq.'+scope,'eq.'+scope)
  calls.push({table,method,count:body?(Array.isArray(body)?body.length:1):0,offset:Number(url.searchParams.get('offset')??0)})
  if(fail===table){fail=null;return r.fulfill({status:404,json:{message:'Synthetic missing table'},headers})}
  let result=method==='GET'?[...tables[table].values()].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0).slice(Number(url.searchParams.get('offset')??0),Number(url.searchParams.get('offset')??0)+Number(url.searchParams.get('limit')??500)):null
  if(tamper&&table==='study_editions'&&method==='GET'){result=structuredClone(result);if(tamper==='scope')result[0].vault='other-fixture';if(tamper==='bytes')result[0].source_base64=Buffer.from('Corrupted synthetic bytes').toString('base64');if(tamper==='manifest'){result[0].sections=[];result[0].anchors={};result[0].source_boundary=0}tamper=null}
  if(gate?.table===table&&gate.method===method){const current=gate;gate=null;current.entered.resolve();await current.release.promise}
  if(method==='POST')for(const row of Array.isArray(body)?body:[body]){assert.equal(row.vault,scope);const old=tables[table].get(row.id);if(table==='study_editions'){assert.equal(row.id,editionId);assert.equal(row.source_base64,base64);if(!old)tables[table].set(row.id,structuredClone(row))}else tables[table].set(row.id,structuredClone(merge(old,row,table)))}
  try{return method==='POST'?await r.fulfill({status:201,body:'',headers}):await r.fulfill({json:result,headers})}catch(e){if(!String(e).match(/closed|handled|cancel|Target page/i))throw e}
 })
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.goto(BASE+'/tests/redesign-check.html')
 await page.evaluate(async({scope,key,host})=>{const {setVault}=await import('/src/sync/vault.ts');setVault({url:'https://'+host,anonKey:'fictional-anon',key,id:scope})},{scope,key,host})
 return page
}
const sync=p=>p.evaluate(async()=>{const {syncStudy,studySyncStatus}=await import('/src/theology/sync.ts');await syncStudy();return studySyncStatus()})
const marks=p=>p.evaluate(async()=>{const {studyDB}=await import('/src/theology/store.ts');return studyDB.annotations.toArray()})
const mark=p=>p.evaluate(async()=>{const {activeEdition,saveHighlight}=await import('/src/theology/store.ts'),{readingFor}=await import('/src/theology/reading.ts');const e=await activeEdition(),section=e.sections.find(s=>s.reading===1),r=readingFor(e,section.id),from=r.blocks.find(b=>b.kind==='paragraph').from;return saveHighlight(e,section.id,r.text,from,from+20,'brass')})
try{
 const a=await device(),b=await device()
 await a.evaluate(async base64=>{const {installStudySource}=await import('/src/theology/store.ts'),{DAILY_DOCTRINE}=await import('/src/theology/model.ts');return (await installStudySource(Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),{...DAILY_DOCTRINE,expected:DAILY_DOCTRINE})).id},base64)
 assert.equal(await sync(a),'synced');assert.equal(tables.study_editions.size,1)
 tamper='manifest';assert.equal(await sync(b),'synced')
 assert.equal(await b.evaluate(async()=>{const {activeEdition}=await import('/src/theology/store.ts');return (await activeEdition()).sections.filter(s=>s.reading).length}),260,'navigation is rebuilt from immutable bytes')
 const first=await mark(a);await sync(a);await sync(b);assert.equal((await marks(b))[0].quote,first.quote)
 // A deletion survives another device's stale color edit.
 await b.evaluate(async id=>{const {studyDB}=await import('/src/theology/store.ts');const r=await studyDB.annotations.toCollection().first();await studyDB.annotations.put({...r,id,color:'forest',updated:r.updated+1})},first.id)
 await a.evaluate(async id=>{const {studyDB,removeHighlight}=await import('/src/theology/store.ts');const r=await studyDB.annotations.toCollection().first();await studyDB.annotations.put({...r,updated:r.updated+2});await removeHighlight(id)},first.id)
 await sync(a);await sync(b);await sync(a);assert.ok((await marks(b)).find(m=>m.id===first.id).deleted)
 // Equal clocks converge using the same ordering as the SQL guard.
 const equal=await mark(a);await sync(a);await sync(b)
 for(const [p,color] of [[a,'forest'],[b,'navy']])await p.evaluate(async({id,color})=>{const {studyDB,studyScope}=await import('/src/theology/store.ts');const r=await studyDB.annotations.get([studyScope(),id]);await studyDB.annotations.put({...r,color,updated:r.updated+100})},{id:equal.id,color})
 await sync(a);await sync(b);await sync(a);assert.equal((await marks(a)).find(m=>m.id===equal.id).color,'navy')
 // A local edit made during a pull is included in a fresh outgoing read.
 const pull=hold('study_annotations'),pulling=sync(a);await pull.entered.promise;const duringPull=await mark(a);await a.evaluate(async()=>{void (await import('/src/theology/sync.ts')).syncStudy()});pull.release.resolve();await pulling;assert.ok(tables.study_annotations.has(duringPull.id))
 // A local edit after POST serialization schedules another pass.
 const post=hold('study_annotations','POST'),posting=sync(a);await post.entered.promise
 await a.evaluate(async id=>{const {studyDB,studyScope}=await import('/src/theology/store.ts'),{syncStudy}=await import('/src/theology/sync.ts');const r=await studyDB.annotations.get([studyScope(),id]);await studyDB.annotations.put({...r,color:'forest',updated:r.updated+1000});void syncStudy()},duringPull.id)
 post.release.resolve();await posting;assert.equal(tables.study_annotations.get(duringPull.id).color,'forest')
 // More than one pull page and more than one upload batch.
 await a.evaluate(async()=>{const {studyDB,studyScope}=await import('/src/theology/store.ts'),r=await studyDB.annotations.toCollection().first();await studyDB.annotations.bulkPut(Array.from({length:501},(_,i)=>({...r,id:'pack-'+String(i).padStart(3,'0'),deleted:undefined})))})
 await sync(a);const beforePages=calls.length;await sync(b);assert.ok(calls.slice(beforePages).some(c=>c.table==='study_annotations'&&c.method==='GET'&&c.offset===500));assert.ok(calls.filter(c=>c.method==='POST'&&c.table==='study_annotations').every(c=>c.count<=100));assert.equal((await marks(b)).length,tables.study_annotations.size)
 const preserved=(await marks(a)).length;fail='study_editions';assert.equal(await sync(a),'unavailable');assert.equal((await marks(a)).length,preserved);assert.equal(await sync(a),'synced')
 const c=await device();tamper='scope';assert.equal(await sync(c),'error');assert.equal(await c.evaluate(async()=>(await import('/src/theology/store.ts')).studyDB.editions.count()),0)
 tamper='bytes';assert.equal(await sync(c),'error');assert.equal(await c.evaluate(async()=>(await import('/src/theology/store.ts')).studyDB.editions.count()),0)
 const switched=hold('study_editions'),switching=sync(c);await switched.entered.promise;await c.evaluate(async()=>(await import('/src/sync/vault.ts')).setVault(null));switched.release.resolve();assert.equal(await switching,'device');assert.equal(await c.evaluate(async()=>(await import('/src/theology/store.ts')).studyDB.editions.count()),0)
 await c.evaluate(async({scope,key,host})=>(await import('/src/sync/vault.ts')).setVault({url:'https://'+host,anonKey:'fictional-anon',key,id:scope}),{scope,key,host})
 await c.clock.install();const timeout=hold('study_editions'),timing=sync(c);await timeout.entered.promise;await c.clock.runFor(20001);assert.equal(await timing,'error');timeout.release.resolve();assert.equal(await sync(c),'synced')
 // Device scope hides the existing cached source after switching vaults.
 await b.evaluate(async()=>{const {getVault,setVault}=await import('/src/sync/vault.ts');setVault({...getVault(),id:'other-fixture'})});assert.equal(await b.evaluate(async()=>(await import('/src/theology/store.ts')).activeEdition()),null)
 await b.evaluate(async({scope,key,host})=>(await import('/src/sync/vault.ts')).setVault({url:'https://'+host,anonKey:'fictional-anon',key,id:scope}),{scope,key,host});assert.equal(await sync(b),'synced')
 const backup=await a.evaluate(async id=>JSON.parse(await (await import('/src/theology/store.ts')).exportStudyMarks(id)),editionId);assert.equal(backup.source,undefined);assert.ok(backup.annotations.every(m=>m.scope===undefined));assert.ok(backup.annotations.some(m=>m.deleted))
 const downloading=a.waitForEvent('download');await a.evaluate(async()=>(await import('/src/lib/export.ts')).exportShelf());const download=await downloading,stream=await download.createReadStream(),parts=[];for await(const part of stream)parts.push(part);const zip=unzipSync(Buffer.concat(parts));assert.ok(Object.keys(zip).every(name=>!name.toLowerCase().includes('doctrine')));assert.ok(Object.values(zip).every(bytes=>!strFromU8(bytes).includes(editionId)),'ordinary export excludes the book and study marks')
 assert.equal(await a.evaluate(async()=>{const {activeEdition}=await import('/src/theology/store.ts'),{sourceHash}=await import('/src/theology/source.ts');return sourceHash((await activeEdition()).source)}),editionId)
 assert.deepEqual(errors,[])
 const result={devices:3,mockOnly:true,actualSourceHash:editionId,sourceUploads:calls.filter(c=>c.table==='study_editions'&&c.method==='POST').length,annotations:tables.study_annotations.size,sourceReadback:true,manifestRederived:true,deletionConflict:true,equalClockConvergence:true,editDuringPull:true,editDuringPost:true,pagination:true,boundedBatches:true,missingTableRetained:true,wrongVaultDenied:true,corruptSourceDenied:true,unpairDuringPull:true,timeoutRecovery:true,vaultCacheIsolation:true,exportBoundaries:true}
 await mkdir('work/check-results/theology',{recursive:true});await writeFile('work/check-results/theology/sync-checks.json',JSON.stringify(result,null,2));console.log('PASS paired study mock:',JSON.stringify(result))
}finally{for(const c of contexts)await c.close();await browser.close()}
