import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
const {chromium}=await import(`${execSync('npm root -g',{encoding:'utf8'}).trim()}/playwright/index.mjs`)
const base=process.env.BASE||'http://127.0.0.1:5199'
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Unpaired local fixtures only')
const browser=await chromium.launch()
try {
 for (const [width,height] of [[440,956],[834,1194]]) {
  const context=await browser.newContext({viewport:{width,height},hasTouch:true})
  await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort())
  await context.addInitScript(()=>{
   window.CapacitorCustomPlatform={name:'ios'};window.widgetNativeCallbacks={}
   window.Capacitor={PluginHeaders:[
    {name:'App',methods:[{name:'getLaunchUrl',rtype:'promise'},{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'promise'}]},
    {name:'Keyboard',methods:[{name:'setAccessoryBarVisible',rtype:'promise'},{name:'hide',rtype:'promise'},{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'promise'}]}],
    nativePromise:async(plugin,method)=>{if(plugin==='App'&&method==='getLaunchUrl'&&!sessionStorage.getItem('widget-cold-used')){sessionStorage.setItem('widget-cold-used','1');return{url:'fieldnotes-test://calendar/2026-11'}}},
    nativeCallback:(_plugin,_method,options,callback)=>{window.widgetNativeCallbacks[options.eventName]=callback;return options.eventName}}
  })
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message))
  await p.goto(base+'/tests/redesign-check.html');await p.getByRole('button',{name:'Load redesign fixtures'}).click();await p.getByText('Fixtures ready').waitFor()
  const id=await p.evaluate(async()=>{if(localStorage.getItem('field-notes.vault'))throw Error('Unpaired fixtures only');const{createPage}=await import('/src/lib/db.ts');return(await createPage('field-notes','# Widget link note')).id})
  await p.goto(base+'/overview');await p.waitForURL('**/calendar/2026-11');await p.locator('.month-screen').waitFor()
  await p.evaluate(async id=>{const{navigate}=await import('/src/lib/router.ts');navigate('/p/'+id)},id)
  await p.locator('.cm-content').waitFor()
  const body='# Widget link note\n\nKeep this native widget edit.'
  await p.evaluate(async body=>{const{EditorView}=await import('/node_modules/@codemirror/view/dist/index.js');const v=EditorView.findFromDOM(document.querySelector('.cm-editor'));v.dispatch({changes:{from:0,to:v.state.doc.length,insert:body}})},body)
  await p.evaluate(()=>window.widgetNativeCallbacks.appUrlOpen({url:'fieldnotes-test://quick-note'}))
  const dialog=p.locator('.quick-note-dialog');await dialog.waitFor()
  await p.waitForFunction(async({id,body})=>{const{getPage}=await import('/src/lib/db.ts');return(await getPage(id)).body===body},{id,body})
  const draft='Fictional native widget draft '+width
  await dialog.locator('textarea').fill(draft)
  await p.evaluate(()=>window.widgetNativeCallbacks.appUrlOpen({url:'fieldnotes-test://calendar/2026-11'}))
  await dialog.waitFor({state:'hidden',timeout:5000});await p.locator('.month-screen').waitFor()
  assert.equal(await p.evaluate(async()=>{const{readQuickNote}=await import('/src/lib/quick-note.ts');return(await readQuickNote()).body}),draft,'Widget navigation saves the open draft before closing its sheet')
  const path=await p.evaluate(()=>location.pathname)
  await p.evaluate(()=>window.widgetNativeCallbacks.appUrlOpen({url:'fieldnotes-test://quick-note?key=private'}))
  assert.equal(await p.evaluate(()=>location.pathname),path);assert.deepEqual(errors,[])
  console.log('PASS native widget cold/warm links, page autosave and open-draft preservation',width,height)
  await context.close()
 }
} finally { await browser.close() }
