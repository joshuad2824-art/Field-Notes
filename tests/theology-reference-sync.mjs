import assert from 'node:assert/strict'
import {execSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
const {chromium}=await import(`${execSync('npm root -g',{encoding:'utf8'}).trim()}/playwright/index.mjs`)
const BASE=process.env.BASE||'http://127.0.0.1:5197',host='reference-sync-fixture.invalid',out='work/check-results/theology-reference-sync'
if(!['localhost','127.0.0.1'].includes(new URL(BASE).hostname))throw Error('Local synthetic sync only')
await mkdir(out,{recursive:true})
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),documents={},catalog={}
for(const key of ['bfm','mbc']){
 const text='Original synthetic '+key+' source. Café and punctuation remain exact.',raw=Buffer.from(text)
 const blocks=[{id:key+'-article',kind:'heading',level:2,text:'Synthetic '+key+' reference',origin:{part:'fixture',paragraph:1}},{id:key+'-passage',kind:'paragraph',text:key==='bfm'?'October sample: a fictional pastor, elder and overseer search passage.':'B001 · Family Assistance. A fictional October sample preserves its own distinct wording.',origin:{part:'fixture',paragraph:2}}]
 const doc={format:'field-notes-private-reference',version:1,key,source:{filename:key+'-synthetic.txt',sha256:hash(raw),bytes:raw.length,base64:raw.toString('base64')},blocks,assets:{},contentSha256:hash(JSON.stringify(blocks)),coverage:{synthetic:true},synthetic:true}
 const packet=Buffer.from(JSON.stringify(doc));documents[key]=doc;catalog[key]={sha256:doc.source.sha256,contentSha256:doc.contentSha256,packageSha256:hash(packet),packageBytes:packet.length}
}
const rows=new Map(),calls=[],errors=[],contexts=[]
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}}
let gate=null,fault=null,failReadback=false
function hold(method,key){const next={method,key,entered:deferred(),release:deferred()};gate=next;return next}
const browser=await chromium.launch()
async function device(scope='vault-one',secret='fixture-key-one'){
 const context=await browser.newContext({viewport:{width:1440,height:900}});contexts.push(context)
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url())
  if(url.origin===BASE)return route.continue()
  if(url.hostname!==host)return route.abort()
  const headers={'access-control-allow-origin':BASE,'access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'}
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers})
  assert.equal(url.pathname,'/rest/v1/study_reference_editions');assert.equal(request.headers().apikey,'fixture-anon');assert.equal(request.headers().authorization,'Bearer fixture-anon')
  const own=request.headers()['x-vault-key']==='fixture-key-one'?'vault-one':request.headers()['x-vault-key']==='fixture-key-two'?'vault-two':null
  if(!own)return route.fulfill({status:403,json:{message:'Fixture denied'},headers})
  const method=request.method(),body=method==='POST'?JSON.parse(request.postData()):null,key=body?.document_key??url.searchParams.get('document_key')?.slice(3)
  calls.push({method,key,scope:own})
  if(method==='GET'){assert.equal(url.searchParams.get('vault'),'eq.'+own);assert.equal(url.searchParams.get('limit'),'1');assert.equal(url.searchParams.get('id'),'eq.'+catalog[key].packageSha256)}
  else {assert.equal(method,'POST');assert.equal(body.vault,own);assert.equal(body.id,catalog[key].packageSha256);assert.equal(body.source_sha256,catalog[key].sha256);assert.equal(body.byte_length,catalog[key].packageBytes);assert.equal(hash(Buffer.from(body.package_base64,'base64')),body.id);assert.match(request.headers().prefer,/ignore-duplicates/)}
  const pk=own+':'+catalog[key].packageSha256
  let result=method==='GET'?(rows.has(pk)?[structuredClone(rows.get(pk))]:[]):null
  if(gate?.method===method&&gate.key===key){const current=gate;gate=null;current.entered.resolve();await current.release.promise}
  if(fault==='missing-table'){fault=null;return route.fulfill({status:404,json:{message:'Synthetic table absent'},headers})}
  if(fault==='post-failure'&&method==='POST'){fault=null;return route.fulfill({status:503,json:{message:'Synthetic unavailable'},headers})}
  if(method==='POST'){if(!rows.has(pk))rows.set(pk,structuredClone(body));if(failReadback){failReadback=false;fault='empty-readback'}return route.fulfill({status:201,body:'',headers})}
  if(fault==='empty-readback'){fault=null;result=[]}
  if(fault==='scope'&&result.length){fault=null;result[0].vault='vault-two'}
  if(fault==='key'&&result.length){fault=null;result[0].document_key=key==='bfm'?'mbc':'bfm'}
  if(fault==='bytes'&&result.length){fault=null;result[0].package_base64='AAAA'+result[0].package_base64.slice(4)}
  if(fault==='oversize'){fault=null;return route.fulfill({json:[],headers:{...headers,'content-length':'99999999'}})}
  return route.fulfill({json:result,headers})
 })
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));await page.goto(BASE+'/tests/redesign-check.html')
 await page.evaluate(async({scope,secret,catalog})=>{const {setVault}=await import('/src/sync/vault.ts'),{createReferenceSync}=await import('/src/theology/reference-sync.ts');setVault({id:scope,key:secret,url:'https://reference-sync-fixture.invalid',anonKey:'fixture-anon'});window.referenceClient=createReferenceSync(catalog)},{scope,secret,catalog})
 return {page,context}
}
const sync=(page,key='bfm',publish=false)=>page.evaluate(({key,publish})=>window.referenceClient.sync(key,publish),{key,publish})
const install=(page,key='bfm')=>page.evaluate(async doc=>(await import('/src/theology/references.ts')).installPrivateReference(doc),documents[key])
const local=(page,key='bfm')=>page.evaluate(async key=>(await import('/src/theology/references.ts')).privateReference(key),key)
try{
 const {page:a,context:ca}=await device(),{page:b,context:cb}=await device()
 assert.equal(await sync(b),'missing');assert.equal(await local(b),null);assert.equal(calls.filter(c=>c.method==='POST').length,0)
 await install(a);assert.equal(await sync(a),'device');assert.equal(calls.filter(c=>c.method==='POST').length,0,'pull-only startup never uploads an existing local file')
 assert.equal(await sync(a,'bfm',true),'synced');assert.equal(rows.size,1);assert.equal(await sync(b),'synced');assert.deepEqual((await local(b)).document,documents.bfm)
 const matches=await b.evaluate(async()=>{const {privateReference,searchReference}=await import('/src/theology/references.ts'),doc=(await privateReference('bfm')).document;return searchReference(doc.blocks,'pastor/elder/overseer').map(hit=>hit.block.id)});assert.deepEqual(matches,['bfm-passage'])
 // A publish requested during an earlier pull must get its own pass.
 const held=hold('GET','mbc');await a.evaluate(()=>{window.pendingReference=window.referenceClient.sync('mbc')});await held.entered.promise;await install(a,'mbc');await a.evaluate(()=>{window.publishReference=window.referenceClient.sync('mbc',true)});held.release.resolve();assert.equal(await a.evaluate(()=>window.publishReference),'synced');assert.equal(rows.size,2)
 assert.equal(await sync(b,'mbc'),'synced');assert.deepEqual((await local(b,'mbc')).document,documents.mbc)
 const mbcMatches=await b.evaluate(async()=>{const {privateReference,searchReference}=await import('/src/theology/references.ts');return searchReference((await privateReference('mbc')).document.blocks,'Family Assistance')[0].block.text});assert.equal(mbcMatches,documents.mbc.blocks[1].text)
 // Real offline/reload caching, with no network request while offline.
 const beforeOffline=calls.length;await cb.setOffline(true);assert.equal(await sync(b),'offline');assert.deepEqual((await local(b)).document,documents.bfm);assert.equal(calls.length,beforeOffline);await cb.setOffline(false)
 await b.reload();await b.evaluate(async catalog=>{const {createReferenceSync}=await import('/src/theology/reference-sync.ts');window.referenceClient=createReferenceSync(catalog)},catalog);assert.deepEqual((await local(b)).document,documents.bfm);assert.equal(await sync(b),'synced')
 // A bad response must never replace the previously verified offline copy.
 for(const kind of ['scope','key','bytes','oversize']){fault=kind;assert.equal(await sync(b),'error');assert.deepEqual((await local(b)).document,documents.bfm)}
 fault='missing-table';assert.equal(await sync(b),'unavailable');assert.deepEqual((await local(b)).document,documents.bfm);assert.equal(await sync(b),'synced')
 // Failed upload/readback retains the local copy and does not claim Saved.
 rows.delete('vault-one:'+catalog.mbc.packageSha256);fault='post-failure';assert.equal(await sync(a,'mbc',true),'error');assert.deepEqual((await local(a,'mbc')).document,documents.mbc)
 failReadback=true;assert.equal(await sync(a,'mbc',true),'error');assert.equal(await sync(a,'mbc'),'synced')
 // Switch pairing during a pull: no old-vault document may enter the new scope.
 const {page:c}=await device(),pull=hold('GET','bfm');await c.evaluate(()=>{window.pendingReference=window.referenceClient.sync('bfm')});await pull.entered.promise;await c.evaluate(async()=>{(await import('/src/sync/vault.ts')).setVault({id:'vault-two',key:'fixture-key-two',url:'https://reference-sync-fixture.invalid',anonKey:'fixture-anon'})});pull.release.resolve();assert.equal(await c.evaluate(()=>window.pendingReference),'device');assert.equal(await local(c),null);assert.equal(await c.evaluate(async()=>(await import('/src/theology/store.ts')).studyDB.meta.count()),0)
 assert.equal(await sync(c),'missing');assert.equal(await local(c),null)
 // A sent POST remains authorized only for its original vault; its eventual
 // completion must not mark the new pairing synced or cache into that scope.
 const {page:d}=await device('vault-two','fixture-key-two');await install(d);const post=hold('POST','bfm');await d.evaluate(()=>{window.pendingReference=window.referenceClient.sync('bfm',true)});await post.entered.promise;await d.evaluate(async()=>{(await import('/src/sync/vault.ts')).setVault({id:'vault-one',key:'fixture-key-one',url:'https://reference-sync-fixture.invalid',anonKey:'fixture-anon'})});post.release.resolve();assert.equal(await d.evaluate(()=>window.pendingReference),'device');assert.equal(await local(d),null);assert.ok(rows.has('vault-two:'+catalog.bfm.packageSha256),'already-sent request stays in its original authorized vault')
 // A request timeout is bounded and retains the offline copy.
 const timeout=await a.evaluate(async catalog=>{const {createReferenceSync}=await import('/src/theology/reference-sync.ts'),fetcher=(_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))));return createReferenceSync(catalog,fetcher,20).sync('bfm')},catalog);assert.equal(timeout,'error');assert.deepEqual((await local(a)).document,documents.bfm)
 assert.equal(await a.evaluate(async()=>(await import('/src/theology/store.ts')).studyDB.editions.count()),0,'reference sync never modifies Daily Doctrine editions')
 assert.deepEqual(errors,[])
 const report={devices:4,documents:2,firstImportAndSecondDevicePull:true,pullDoesNotUpload:true,coalescedImportDuringPull:true,exactSourceAndSearch:true,offlineAndReload:true,scopeKeyDigestSizeRejection:true,missingServerStatus:true,failedUploadAndReadback:true,scopeSwitchDuringPullAndPost:true,boundedTimeout:true,dailyDoctrineUnchanged:true,network:'synthetic route mocks only; no production calls'}
 await writeFile(`${out}/checks.json`,JSON.stringify(report,null,2));console.log('PASS private reference sync:',JSON.stringify(report))
}finally{for(const context of contexts)await context.close();await browser.close()}
