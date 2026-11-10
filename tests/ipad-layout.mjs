import assert from 'node:assert/strict'
import {execSync} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
const{chromium}=await import(`${execSync('npm root -g',{encoding:'utf8'}).trim()}/playwright/index.mjs`)
const base=process.env.BASE||'http://127.0.0.1:5199',out=process.env.IPAD_OUT||'work/ipad-acceptance'
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local fictional unpaired fixtures only')
mkdirSync(out,{recursive:true});const browser=await chromium.launch(),report=[]
try{
 const cases=[[true,744,1133],[true,1133,744],[true,834,1194],[true,1194,834],[true,1032,1376],[true,1376,1032],[true,640,900],[true,800,600],[true,500,900],[false,834,1194],[false,1194,834]]
 const widths=(process.env.IPAD_WIDTHS||'').split(',').filter(Boolean).map(Number)
 if(widths.some(w=>!cases.some(c=>c[1]===w)))throw Error('IPAD_WIDTHS must name existing case widths')
 for(const[native,width,height]of cases.filter(c=>!widths.length||widths.includes(c[1]))){
  const c=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:false})
  await c.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort())
  await c.addInitScript(native=>{if(native){window.CapacitorCustomPlatform={name:'ios'};window.reviewKeyboardEvents={};window.Capacitor={PluginHeaders:[{name:'Keyboard',methods:[{name:'setAccessoryBarVisible',rtype:'promise'},{name:'hide',rtype:'promise'},{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'promise'}]}],nativePromise:async()=>{},nativeCallback:(_p,_m,o,cb)=>{window.reviewKeyboardEvents[o.eventName]=cb;return'test'}}}document.addEventListener('DOMContentLoaded',()=>{document.documentElement.style.setProperty('--safe-top','24px');document.documentElement.style.setProperty('--raw-inset-bottom','20px')})},native)
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message))
  await p.goto(base+'/tests/redesign-check.html');await p.getByRole('button',{name:'Load redesign fixtures'}).click();await p.getByText('Fixtures ready').waitFor()
  const{id,month}=await p.evaluate(async()=>{if(localStorage.getItem('field-notes.vault'))throw Error('Unpaired fixtures only');const{createPage}=await import('/src/lib/db.ts');const{isoDay}=await import('/src/lib/format.ts');return{id:(await createPage('field-notes','# Tablet writing\n\n'+Array.from({length:35},(_,i)=>`Fictional tablet line ${i+1}`).join('\n'))).id,month:isoDay().slice(0,7)}})
  const box=async s=>{const r=await p.locator(s).boundingBox();assert(r,`Visible ${s}`);return r}
  const clearNav=async s=>{const r=await box(s),n=await box('.floating-nav');assert(r.y+r.height<=n.y+1,`${s} clears navigation`)}
  await p.goto(base+'/overview');await p.getByRole('region',{name:'Month overview'}).waitFor();await p.evaluate(()=>document.fonts.ready)
  const quietMonth=await box('.board-month')
  await p.evaluate(async()=>{const{saveEvent}=await import('/src/lib/events.ts');const{isoDay}=await import('/src/lib/format.ts');for(let i=0;i<18;i++){const d=new Date();d.setDate(d.getDate()+Math.floor(i/3));await saveEvent({title:`Fictional tablet schedule ${i+1} with a longer wrapping title`,date:isoDay(d),startTime:'10:00'})}})
  await p.locator('.board-day').getByText('Fictional tablet schedule 18 with a longer wrapping title',{exact:true}).waitFor()
  const busyMonth=await box('.board-month')
  if(width>=600){
   assert(Math.abs(busyMonth.height-quietMonth.height)<1,'Busy schedule never stretches the month')
   assert(busyMonth.height<=500,'Month stays compact')
   const lastDay=await p.locator('.board-month .cal-day').last().boundingBox();assert(lastDay.y+lastDay.height<=busyMonth.y+busyMonth.height-8,'Last week stays inside month')
   for(const d of await p.locator('.board-month .cal-day').all()){const r=await d.boundingBox();assert(r.width>=44&&r.height>=44,'Tablet calendar touch targets are usable')}
   const q=await box('.board-weather-tile');assert(q.height<=120,'Capture tile does not dominate the board')
   await clearNav('.approved-content')
   const day=p.locator('.board-day');assert(await day.evaluate(n=>n.scrollHeight>n.clientHeight),'Busy agenda can scroll independently')
   await day.evaluate(n=>n.scrollTop=n.scrollHeight)
   const last=await p.locator('.board-day .event-row').last().boundingBox(),d=await box('.board-day');assert(last.y+last.height<=d.y+d.height+1,'Last board event is reachable')
  }
  await p.screenshot({path:`${out}/${native?'native':'web'}-${width}-home.png`})
  await p.goto(base+'/calendar/2026-08');await p.locator('.month-mobile').waitFor();assert.equal(await p.locator('.month-mobile .cal-day').count(),42,'Six-week month keeps every date')
  await p.locator('.month-mobile button[aria-label="2026-08-15"]').click();assert.match(await p.locator('.month-selected h2').innerText(),/15/)
  if(width>=600)await clearNav('.approved-content')
  await p.screenshot({path:`${out}/${native?'native':'web'}-${width}-calendar.png`})
  await p.goto(base+'/p/'+id);await p.locator('.cm-content').waitFor()
  if(native&&width>=600){const leaf=await box('.leaf');if(width<1000)assert(leaf.width>width*.8,'Portrait/windowed editor has useful reading width');assert.equal(await p.locator('.pagefoot').evaluate(n=>getComputedStyle(n).display),'none','Native metadata is available on demand')}
  if(native){
   await p.locator('.cm-content').click();await p.evaluate(()=>window.reviewKeyboardEvents.keyboardDidShow({keyboardHeight:300}))
   const bar=p.getByRole('toolbar',{name:'Note formatting',exact:true});await bar.waitFor()
   const before=await p.evaluate(async()=>{const{EditorView}=await import('/node_modules/@codemirror/view/dist/index.js');const v=EditorView.findFromDOM(document.querySelector('.cm-editor'));window.ipadView=v;v.focus();v.dispatch({selection:{anchor:v.state.doc.length-3,head:v.state.doc.length}});return{body:v.state.doc.toString(),selection:v.state.selection.main.toJSON()}})
   await bar.getByRole('button',{name:'Style',exact:true}).click()
   const state=()=>p.evaluate(async()=>{const{EditorView}=await import('/node_modules/@codemirror/view/dist/index.js');const v=EditorView.findFromDOM(document.querySelector('.cm-editor'));assertSame();function assertSame(){if(v!==window.ipadView)throw Error('Editor remounted during resize')}return{body:v.state.doc.toString(),selection:v.state.selection.main.toJSON()}})
   const panelFits=async()=>{try{await p.waitForFunction(()=>{const a=document.querySelector('.leaf').getBoundingClientRect(),b=document.querySelector('.tray').getBoundingClientRect(),d=document.querySelector('.keyboard-format-dock').getBoundingClientRect();return b.left>=a.left&&b.right<=a.right&&b.width>=100&&b.bottom<=d.top+1})}catch(e){console.log('FAILED panel geometry',await p.evaluate(()=>Object.fromEntries(['.leaf','.tray','.keyboard-format-dock','.keyboard-format-bar'].map(s=>[s,document.querySelector(s).getBoundingClientRect().toJSON()]))));await p.screenshot({path:out+'/failed-formatting.png'});throw e}}
   await panelFits();assert.deepEqual(await state(),before,'Opening tools preserves exact document and selection')
   if(width===800&&height===600){await p.waitForFunction(async()=>{const{EditorView}=await import('/node_modules/@codemirror/view/dist/index.js');const v=EditorView.findFromDOM(document.querySelector('.cm-editor')),r=v.coordsAtPos(v.state.selection.main.head),s=v.scrollDOM.getBoundingClientRect(),t=document.querySelector('.tray').getBoundingClientRect();return r&&r.top>=s.top&&r.bottom<=Math.min(s.bottom,t.top)-2});await p.screenshot({path:out+'/shallow-window-caret.png'})}
   if(width===834){for(const[w,h]of[[1194,834],[640,900],[1032,1376],[834,1194]]){console.log('CHECK editor resize',w,h);await p.setViewportSize({width:w,height:h});await panelFits();assert.deepEqual(await state(),before,'Rotation/resizing preserves editor identity, content and selected range')}
    await p.screenshot({path:out+'/native-resized-formatting.png'})
   }
   await bar.getByRole('button',{name:'Hide keyboard',exact:true}).click();await p.evaluate(()=>window.reviewKeyboardEvents.keyboardDidHide());await bar.waitFor({state:'detached'});assert.deepEqual(await state(),before)
  }
  for(const route of ['/workshop','/settings','/search','/theology']){await p.goto(base+route);await p.locator('.floating-nav').waitFor();assert(await p.evaluate(()=>document.body.scrollWidth<=innerWidth),`${route} does not overflow horizontally`);if(width>=600)await clearNav('.approved-content')}
  assert.deepEqual(errors,[]);report.push({native,width,height,quietMonth,busyMonth});console.log('PASS adaptive tablet home/calendar/editor/navigation',native?'native':'web',width,height);await c.close()
 }
 // Exact unchanged geometry at the phone and pointer-only desktop boundaries.
 for(const[w,h]of[[440,956],[1440,900]]){const c=await browser.newContext({viewport:{width:w,height:h},hasTouch:false});const p=await c.newPage();await p.goto(base+'/tests/redesign-check.html');await p.getByRole('button',{name:'Load redesign fixtures'}).click();await p.getByText('Fixtures ready').waitFor();await p.goto(base+'/overview');await p.locator('.board-month').waitFor();const geometry=()=>p.evaluate(()=>['.board-month','.board-day','.board-date','.floating-nav'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return[r.x,r.y,r.width,r.height]}));const now=await geometry();await p.evaluate(()=>document.querySelector('style[data-vite-dev-id$="/src/styles/tablet.css"]').disabled=true);assert.deepEqual(await geometry(),now,'Phone and pointer desktop composition unchanged');console.log('PASS untouched boundary',w);await c.close()}
 writeFileSync(out+'/report.json',JSON.stringify(report,null,2))
}finally{await browser.close()}
