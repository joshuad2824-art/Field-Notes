import assert from 'node:assert/strict'
import {execSync} from 'node:child_process'
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs'
const root=process.cwd()
const {chromium}=await import(`${execSync('npm root -g',{encoding:'utf8'}).trim()}/playwright/index.mjs`)
const base=process.env.BASE||'http://127.0.0.1:5199',out=process.env.IOS_SPACING_OUT||'work/ios-spacing'
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Local fictional fixtures only')
mkdirSync(out,{recursive:true})
const priorCSS=process.env.IOS_BASELINE_CSS?readFileSync(process.env.IOS_BASELINE_CSS,'utf8'):null
const browser=await chromium.launch(),report=[]
try {
 for(const [native,width,height] of [[true,440,956],[true,402,874],[true,320,740],[true,874,402],[false,390,844],[false,1440,900]]) {
  const landscape=width>height&&width<1000, safeTop=landscape?0:62
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:width<1000})
  await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort())
  await context.addInitScript(({native,landscape})=>{
   if(native){window.CapacitorCustomPlatform={name:'ios'};window.reviewKeyboardEvents={};window.Capacitor={PluginHeaders:[{name:'Keyboard',methods:[{name:'setAccessoryBarVisible',rtype:'promise'},{name:'hide',rtype:'promise'},{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'promise'}]}],nativePromise:async()=>{},nativeCallback:(_p,_m,o,cb)=>{window.reviewKeyboardEvents[o.eventName]=cb;return 'test'}}}
   document.addEventListener('DOMContentLoaded',()=>{const s=document.documentElement.style;s.setProperty('--safe-top',landscape?'0px':'62px');s.setProperty('--raw-inset-bottom','34px');if(native){s.setProperty('--safe-left',landscape?'59px':'0px');s.setProperty('--safe-right',landscape?'59px':'0px')}})
  },{native,landscape})
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto(base+'/tests/redesign-check.html');await page.getByRole('button',{name:'Load redesign fixtures'}).click();await page.getByText('Fixtures ready').waitFor()
  const id=await page.evaluate(async()=>{
   assertUnpaired();function assertUnpaired(){if(localStorage.getItem('field-notes.vault'))throw Error('Fixtures must stay unpaired')}
   const {createPage}=await import('/src/lib/db.ts');const {saveEvent}=await import('/src/lib/events.ts')
   for(let i=0;i<3;i++)await saveEvent({title:`Fictional balanced event ${i+1}`,date:'2026-11-06',startTime:`10:0${i}`})
   for(let i=0;i<14;i++)await saveEvent({title:`Fictional schedule item ${i+1}`,date:'2026-11-04',startTime:`09:${String(i).padStart(2,'0')}`})
   return(await createPage('field-notes','# Native reading sample\n\n'+Array.from({length:45},(_,i)=>`${i+1}. Fictional line ${i+1}`).join('\n'))).id
  })
  // Native CSS baseline is the preceding commit; data/components are identical
  // in these closed-toolbar views. This measures the space reclaimed by CSS.
  const geometry=async()=>page.evaluate(()=>{
   const box=s=>{const n=document.querySelector(s);if(!n)return null;const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,left:r.left,right:r.right,display:getComputedStyle(n).display}}
   return{editor:box('.editor'),foot:box('.pagefoot'),agenda:box('.month-selected'),header:box('.month-header')}
  })
  const prior=async()=>{await page.evaluate(css=>{const n=document.querySelector('style[data-vite-dev-id$="/src/styles/native-ios.css"]');window.currentNativeStyle=n.textContent;n.textContent=css},priorCSS);await page.waitForTimeout(80);return geometry()}
  const restore=()=>page.evaluate(()=>{document.querySelector('style[data-vite-dev-id$="/src/styles/native-ios.css"]').textContent=window.currentNativeStyle})
  await page.goto(base+'/calendar/2026-11');await page.locator('.month-header').waitFor()
  if(native) await page.locator('.month-mobile button[aria-label="2026-11-05"]').click()
  let beforeCalendar
  if(native&&priorCSS){beforeCalendar=await prior();if(width===440)await page.screenshot({path:out+'/calendar-before.png'});await restore()}
  const calendar=await geometry()
  if(native){
   const heading=await page.locator('.month-header h1').boundingBox();assert(heading.y>=safeTop,'Calendar heading clears status area')
   for(const b of await page.locator('.month-controls button').all()){const r=await b.boundingBox();assert(r.x>=0&&r.x+r.width<=width&&r.height>=44,'Month controls are usable and not clipped')}
   const days=await page.locator('.month-mobile .cal-day').evaluateAll(ns=>ns.map(n=>{const r=n.getBoundingClientRect();return[r.width,r.height]}));for(const [w,h]of days)assert(w>=43.9&&h>=44,'Day targets stay 44pt')
   assert(calendar.agenda.bottom>=height-1,'Black agenda reaches bottom even on an empty selected day')
   assert.equal(await page.locator('.title-chevron,.notebook-switcher-chevron,.pill-room-caret').count(),0,'Navigation has no decorative expansion arrows')
   if(!landscape){
    const breathing=await page.locator('.month-mobile .cal-grid').evaluate(n=>parseFloat(getComputedStyle(n).rowGap))
    assert(breathing>=2,'Calendar rows have breathing space')
    if(width>=400)assert(calendar.agenda.top>=460,'Tall portrait gives the month a balanced share of the screen')
    await page.locator('.month-mobile button[aria-label="2026-11-06"]').click()
    await page.locator('.month-selected').getByText('Fictional balanced event 3',{exact:true}).waitFor()
    await page.screenshot({path:out+`/calendar-${width}-balanced.png`})
   }
   await page.locator('.month-mobile button[aria-label="2026-11-04"]').click()
   await page.locator('.month-selected').getByText('Fictional schedule item 14',{exact:true}).waitFor()
   await page.evaluate(()=>{for(const s of ['.month-screen','.month-selected']){const n=document.querySelector(s);n.scrollTop=n.scrollHeight}})
   const last=await page.locator('.month-selected').getByText('Fictional schedule item 14',{exact:true}).boundingBox(),nav=await page.locator('.floating-nav').boundingBox()
   assert(last.y>=0&&last.y+last.height<nav.y,'Last schedule item scrolls clear of navigation')
   await page.screenshot({path:out+`/calendar-${width}-scrolled.png`})
   await page.goto(base+'/calendar/2026-08');await page.locator('.month-mobile').waitFor();assert.equal(await page.locator('.month-mobile .cal-day').count(),42,'Six-week month retains every date')
   assert(await page.evaluate(()=>document.body.scrollWidth<=innerWidth),'No horizontal overflow')
  }
  await page.goto(base+'/p/'+id);await page.locator('.cm-content').waitFor()
  let beforePage
  if(native&&priorCSS){beforePage=await prior();if(width===440)await page.screenshot({path:out+'/page-before.png'});await restore()}
  const reading=await geometry()
  if(native){
   assert.equal(reading.foot.display,'none','Permanent metadata footer no longer shrinks reading area')
   if(beforePage)assert(reading.editor.height>beforePage.editor.height+75,'Reading viewport reclaims footer space')
   assert(reading.editor.bottom>=height-2,'Writing viewport reaches the screen foot')
   await page.screenshot({path:out+`/page-${width}.png`})
   await page.getByRole('button',{name:'Page options',exact:true}).click();await page.locator('.native-page-info').waitFor();assert.match(await page.locator('.native-page-info').innerText(),/words.*Edited/i,'Metadata remains available in options')
   await page.keyboard.press('Escape')
   await page.getByRole('button',{name:'Style',exact:true}).click()
   const bar=page.getByRole('toolbar',{name:'Note formatting',exact:true});await bar.waitFor()
   const top=await page.locator('.tools').boundingBox();assert(top.height<=45,'Formatting at rest does not add header rows')
   const panel=await page.getByRole('toolbar',{name:'Style',exact:true}).boundingBox(),dock=await bar.boundingBox();assert(panel.y>height/2&&panel.y+panel.height<=dock.y+2,'Resting formatting stays at bottom')
   await bar.getByRole('button',{name:'Close formatting',exact:true}).click();await bar.waitFor({state:'detached'})
   await page.locator('.cm-content').click();await page.evaluate(h=>window.reviewKeyboardEvents.keyboardDidShow({keyboardHeight:h}),landscape?174:330)
   await bar.waitFor()
   const selected=await page.evaluate(async()=>{const{EditorView}=await import('/node_modules/@codemirror/view/dist/index.js');const v=EditorView.findFromDOM(document.querySelector('.cm-editor'));const n=v.state.doc.length;v.focus();v.dispatch({selection:{anchor:n-2,head:n},effects:v.constructor.scrollIntoView(n,{y:'end',yMargin:0})});return {selection:v.state.selection.main.toJSON(),body:v.state.doc.toString()}})
   await page.waitForTimeout(120)
   await bar.getByRole('button',{name:'Style',exact:true}).click()
   const visibleCaret=()=>page.waitForFunction(async()=>{const{EditorView}=await import('/node_modules/@codemirror/view/dist/index.js');const v=EditorView.findFromDOM(document.querySelector('.cm-editor')),r=v.coordsAtPos(v.state.selection.main.head),p=document.querySelector('.tray').getBoundingClientRect();return r&&r.bottom<=p.top-2&&r.top>=v.scrollDOM.getBoundingClientRect().top})
   await visibleCaret()
   const unchanged=()=>page.evaluate(async()=>{const{EditorView}=await import('/node_modules/@codemirror/view/dist/index.js');const v=EditorView.findFromDOM(document.querySelector('.cm-editor'));return {selection:v.state.selection.main.toJSON(),body:v.state.doc.toString()}})
   assert.deepEqual(await unchanged(),selected,'Opening tools preserves selected range and content')
   await page.evaluate(()=>document.querySelector('.cm-scroller').scrollTop-=30);await page.waitForTimeout(100)
   assert.deepEqual(await unchanged(),selected,'Manual scrolling preserves selection and content')
   await bar.getByRole('button',{name:'Style',exact:true}).click();assert.deepEqual(await unchanged(),selected,'Closing tools preserves selection and content')
   await bar.getByRole('button',{name:'Style',exact:true}).click();await visibleCaret()
   const kb=landscape?174:330,b=await bar.boundingBox();assert(b.y+b.height<=height-kb+1,'Dock remains above keyboard')
   await page.getByRole('button',{name:'Appearance tools',exact:true}).click()
   const strip=page.locator('.tray-strip');await strip.evaluate(n=>n.scrollLeft=n.scrollWidth)
   const lastTool=strip.locator('button').last();await lastTool.scrollIntoViewIfNeeded();assert(await lastTool.isVisible(),'Last formatting action remains reachable')
   await page.screenshot({path:out+`/formatting-${width}.png`})
   if(width===440){
    await bar.getByRole('button',{name:'Style',exact:true}).click()
    await bar.getByRole('button',{name:'Insert table',exact:true}).click()
    const cell=page.locator('.md-table td').first();await cell.click()
    await bar.getByRole('button',{name:'Style',exact:true}).click()
    await page.waitForFunction(()=>{const c=document.activeElement?.getBoundingClientRect(),p=document.querySelector('.tray').getBoundingClientRect();return c&&c.bottom<=p.top-2})
    await bar.getByRole('button',{name:'Style',exact:true}).click()
    await cell.fill('Native selected cell')
    await cell.evaluate(n=>{n.focus();const r=document.createRange();r.setStart(n.firstChild,7);r.setEnd(n.firstChild,15);const s=getSelection();s.removeAllRanges();s.addRange(r)})
    await page.waitForTimeout(150)
    const cellBefore=await page.evaluate(()=>getSelection().toString())
    await bar.getByRole('button',{name:'Style',exact:true}).click()
    await page.waitForFunction(()=>{const s=getSelection();if(!s.rangeCount)return false;const r=s.getRangeAt(0).getBoundingClientRect(),p=document.querySelector('.tray').getBoundingClientRect(),v=document.querySelector('.cm-scroller').getBoundingClientRect();return r.bottom<=p.top-2&&r.top>=v.top})
    assert.equal(await page.evaluate(()=>getSelection().toString()),cellBefore,'Expanded tools preserve the visible table-cell selection')
    await bar.getByRole('button',{name:'Style',exact:true}).click()
    assert.equal(await page.evaluate(()=>getSelection().toString()),cellBefore,'Closing tools preserves table-cell selection')
   }
   const beforeSwipe=await unchanged()
   await page.evaluate(()=>{
    const n=document.querySelector('.cm-content'),touch=(x,y)=>new Touch({identifier:1,target:n,clientX:x,clientY:y})
    n.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[touch(100,100)]}))
    n.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,touches:[touch(105,160)]}))
   })
   assert.deepEqual(await unchanged(),beforeSwipe,'Downward dismissal preserves content and editor range')
   await page.evaluate(()=>window.reviewKeyboardEvents.keyboardDidHide())
   await bar.waitFor({state:'detached'})
   assert(await page.locator('.floating-nav').isVisible(),'Navigation returns after swipe dismissal')
   await page.locator('.cm-content').click();await page.evaluate(h=>window.reviewKeyboardEvents.keyboardDidShow({keyboardHeight:h}),kb)
   await bar.getByRole('button',{name:'Hide keyboard',exact:true}).click();await page.evaluate(()=>window.reviewKeyboardEvents.keyboardDidHide())
   await page.evaluate(()=>{const n=document.querySelector('.cm-scroller');n.scrollTop=n.scrollHeight})
   await page.screenshot({path:out+`/page-${width}-end.png`})
  }else{assert.notEqual(reading.foot.display,'none','Web footer remains unchanged');assert.equal(await page.getByRole('toolbar',{name:'Note formatting',exact:true}).count(),0)}
  assert.deepEqual(errors,[])
  report.push({native,width,height,beforeCalendar,calendar,beforePage,reading});console.log('PASS',native?'native spacing/scroll/formatting':'web preserved',width)
  await context.close()
 }
 writeFileSync(out+'/report.json',JSON.stringify(report,null,2))
}finally{await browser.close()}
