import assert from 'node:assert/strict'
import {execSync} from 'node:child_process'
import {mkdir,writeFile} from 'node:fs/promises'
const {chromium}=await import(`${execSync('npm root -g',{encoding:'utf8'}).trim()}/playwright/index.mjs`)
const BASE=process.env.BASE||'http://127.0.0.1:5197',out='work/check-results/theology-references'
if(!['localhost','127.0.0.1'].includes(new URL(BASE).hostname))throw Error('Local synthetic references only')
await mkdir(out,{recursive:true})
const browser=await chromium.launch(),report=[]
try{for(const width of [1440,820,390,320]){
 const context=await browser.newContext({viewport:{width,height:900}});await context.route('**/*',route=>new URL(route.request().url()).origin===BASE?route.continue():route.abort())
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(10000)
 await page.goto(BASE+'/tests/redesign-check.html');await page.getByRole('button',{name:'Load redesign fixtures'}).click();await page.getByText('Fixtures ready').waitFor()
 await page.goto(BASE+'/theology');await page.locator('.theology-screen').evaluate(el=>{el.scrollTop=el.scrollHeight});await page.screenshot({path:`${out}/${width}-theology-cards.png`});const card=page.getByRole('link',{name:'Baptist Faith and Message',exact:true});await card.focus();await page.keyboard.press('Enter');await page.waitForURL('**/theology/reference/bfm')
 assert.equal(await page.getByRole('searchbox').count(),0,'no document/search before pairing')
 await page.evaluate(async()=>{const {setVault}=await import('/src/sync/vault.ts');setVault({id:'synthetic-reference-one',key:'synthetic-reference-key',url:'https://reference-fixture.invalid',anonKey:'synthetic-anon'})})
 await page.getByRole('button',{name:'Import private reference',exact:true}).waitFor()
 const folding=await page.evaluate(async()=>{const {foldReference}=await import('/src/theology/references.ts');return foldReference('Cafe\u0301')});assert.equal(folding.folded,'cafe');assert.equal(folding.ends.at(-1),5)
 const packages=await page.evaluate(async()=>{
  const {sourceHash}=await import('/src/theology/source.ts')
  const make=async key=>{
   const text='Invented source bytes for '+key,raw=new TextEncoder().encode(text),source={filename:'synthetic-'+key+'.txt',sha256:await sourceHash(raw),bytes:raw.length,base64:btoa(text)}
   const blocks=[{id:'preamble',kind:'heading',level:2,text:'Sample preamble',origin:{part:'synthetic',paragraph:1}}]
   for(let i=0;i<65;i++)blocks.push({id:'passage-'+i,kind:i%8===0?'heading':'paragraph',...(i%8===0?{level:2}:{}),text:i===8?'B001 · Family Assistance':i===9?'The October sample describes a fictional Family Assistance process. Café, œ and ﬃ remain unchanged.':i===10?'A synthetic search row mentions pastor, elder and overseer as query tokens.':i%8===0?`Sample section ${i}`:`Sample passage ${i}. This invented paragraph keeps the original wording for reader tests. October sample marker ${i}.`,origin:{part:'synthetic',paragraph:i+2}})
   blocks.push({id:'form',kind:'heading',level:2,text:'Sample request form',origin:{part:'synthetic',paragraph:68}},{id:'table',kind:'table',text:'',origin:{part:'synthetic'},rows:[{header:true,cells:[{span:1,blocks:[{id:'field',kind:'paragraph',text:'Field',origin:{part:'synthetic',paragraph:69}}]},{span:1,blocks:[{id:'value',kind:'paragraph',text:'Value',origin:{part:'synthetic',paragraph:70}}]}]},{header:false,cells:[{span:1,blocks:[{id:'applicant',kind:'paragraph',text:'Applicant',origin:{part:'synthetic',paragraph:71}}]},{span:1,blocks:[{id:'blank',kind:'paragraph',text:'__________',origin:{part:'synthetic',paragraph:72}}]}]}]})
   if(key==='mbc')for(let i=0;i<2100;i++)blocks.push({id:'long-'+i,kind:'paragraph',text:`Long reference paragraph ${i}. October synthetic text remains complete and searchable.`,origin:{part:'synthetic',paragraph:100+i}})
   return {format:'field-notes-private-reference',version:1,key,source,blocks,assets:{},contentSha256:await sourceHash(new TextEncoder().encode(JSON.stringify(blocks))),coverage:{synthetic:true},synthetic:true}
  }
  return [await make('bfm'),await make('mbc')]
 })
 // Exercise the actual private package file input, then install a second fixture through the same validated store.
 await page.locator('input[type=file]').setInputFiles({name:'synthetic-bfm.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(packages[0]))})
 await page.locator('.reference-paper').waitFor();
 const invalid=await page.evaluate(async doc=>{const {installPrivateReference}=await import('/src/theology/references.ts');const changed=structuredClone(doc);changed.blocks[1].text='Tampered fixture';try{await installPrivateReference(changed);return false}catch{return true}},packages[0]);assert.ok(invalid,'altered paragraph data fails integrity checks')
 await page.evaluate(async doc=>(await import('/src/theology/references.ts')).installPrivateReference(doc),packages[1])
 assert.equal(await page.locator('.reference-paper [data-reference-block]').count(),72)
 const captured=await page.locator('.reference-paper').textContent()
 await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`${out}/${width}-reading.png`})
 const input=page.getByRole('searchbox',{name:'Search Baptist Faith and Message',exact:true})
 for(const query of ['October','Family Assistance','B001','pastor elder overseer','pastor/elder/overseer','CAFE','oe','ffi']){
  await input.fill(query);await page.locator('.reference-results>a').first().waitFor()
  if(query==='B001')assert.match(await page.locator('.reference-results h2').first().textContent(),/B001/)
  if(query==='CAFE')assert.equal(await page.locator('.reference-results mark').first().textContent(),'Café')
  if(query==='oe')assert.equal(await page.locator('.reference-results mark').first().textContent(),'œ')
  if(query==='ffi')assert.equal(await page.locator('.reference-results mark').first().textContent(),'ﬃ')
 }
 await input.fill('October');await page.locator('.reference-results>a').first().waitFor();await page.locator('.reference-results>a').nth(5).scrollIntoViewIfNeeded()
 await page.locator('.reference-results>a').nth(5).focus();const before=await page.locator('.reference-screen').evaluate(el=>el.scrollTop)
 await page.keyboard.press('Enter');await page.locator('.reference-paper').waitFor();assert.equal(await page.locator('.reference-paper').textContent(),captured)
 assert.ok(await page.evaluate(()=>document.activeElement.hasAttribute('data-reference-block')))
 await page.getByRole('link',{name:'Back to results',exact:true}).click();await page.locator('.reference-results').waitFor();await page.waitForFunction(top=>Math.abs(document.querySelector('.reference-screen').scrollTop-top)<3,before)
 assert.equal(await input.inputValue(),'October')
 await page.locator('.reference-results>a').nth(5).focus();await page.keyboard.press('Enter');await page.locator('.reference-paper').waitFor();await page.goBack();await page.locator('.reference-results').waitFor();assert.equal(await input.inputValue(),'October')
 await page.screenshot({path:`${out}/${width}-search.png`})
 await page.getByRole('link',{name:'Read reference',exact:true}).click();await page.locator('.reference-paper').waitFor()
 await page.locator('.reference-contents summary').click();const formLink=page.getByRole('navigation',{name:'Reference sections',exact:true}).getByRole('link',{name:'Sample request form',exact:true});await formLink.focus();await page.keyboard.press('Enter');await page.locator('.reference-table').waitFor()
 assert.equal(await page.getByRole('columnheader').count(),2);assert.equal(await page.locator('.reference-table').getByText('Applicant',{exact:true}).count(),1);assert.equal(await page.locator('.reference-table input').count(),0,'source form stays read-only')
 await page.screenshot({path:`${out}/${width}-source-form.png`})
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0)
 assert.equal(await page.locator('.reference-screen').evaluate(el=>el.scrollWidth-el.clientWidth),0)
 await page.reload();await page.locator('.reference-paper').waitFor();assert.equal(await page.locator('.reference-paper').textContent(),captured)
 const privacy=await page.evaluate(()=>({local:Object.values(localStorage),url:location.href}));assert.ok(!privacy.local.some(value=>value.includes('October')||value.includes('Family Assistance')));assert.ok(!privacy.url.includes('October'))
 await page.goto(BASE+'/theology');await page.getByRole('link',{name:'MBC Bylaws, Policies & Procedures',exact:true}).click();await page.locator('.reference-paper').waitFor();assert.equal(await page.locator('.reference-paper [data-reference-block]').count(),2172);await page.locator('[data-reference-block=long-2099]').waitFor();assert.equal(await page.getByRole('searchbox').inputValue(),'');await page.getByRole('searchbox').fill('October');await page.locator('.reference-results>a').first().waitFor();assert.equal(await page.locator('.reference-results>a').count(),40);await page.getByRole('button',{name:'Show more passages',exact:true}).click();assert.equal(await page.locator('.reference-results>a').count(),80);await page.getByRole('searchbox').fill('Family Assistance');await page.locator('.reference-results>a').first().waitFor();await page.screenshot({path:`${out}/${width}-mbc-search.png`})
 await page.evaluate(async()=>{const {setVault}=await import('/src/sync/vault.ts');setVault({id:'synthetic-reference-two',key:'other-synthetic-key',url:'https://reference-fixture.invalid',anonKey:'synthetic-anon'})});await page.getByRole('button',{name:'Import private reference',exact:true}).waitFor();assert.equal(await page.locator('.reference-paper,.reference-results,[type=search]').count(),0,'mounted references clear on vault change')
 await page.evaluate(async()=>{const {setVault}=await import('/src/sync/vault.ts');setVault(null)});await page.getByText('Pair this device to open private references.',{exact:true}).waitFor();assert.equal(await page.getByRole('searchbox').count(),0)
 await page.goto(BASE+'/theology');await page.getByRole('link',{name:'MBC Bylaws, Policies & Procedures',exact:true}).click();await page.waitForURL('**/reference/mbc')
 assert.deepEqual(errors,[]);report.push({width,readOnlyForm:true,semanticHeaders:true,caseDiacriticsLigatures:true,queryAndResultsScrollReturn:true,sourceExact:true,reload:true,vaultIsolation:true,privateQueryMemoryOnly:true});console.log('PASS private reference reader',width);await context.close()
}}finally{await browser.close()}
await writeFile(`${out}/checks.json`,JSON.stringify(report,null,2))
