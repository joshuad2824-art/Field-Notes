// Removing a saved study highlight by gesture: the toolbar's Remove, the open
// highlight's actions, and what scrolling, resizing, pressing and navigating do
// to them. Only an explicit click on Remove may write, and it writes exactly the
// highlight it was given plus that highlight's exact copies.
// Synthetic localhost fixtures only; Chromium touch emulation is not iOS.
import assert from 'node:assert/strict'
import {execSync} from 'node:child_process'
import {mkdir,writeFile} from 'node:fs/promises'
const {chromium}=await import(`${execSync('npm root -g',{encoding:'utf8'}).trim()}/playwright/index.mjs`)
const BASE=process.env.BASE||'http://127.0.0.1:5205',out='work/check-results/highlight-gestures',host='gesture-sync-fixture.invalid'
if(!['localhost','127.0.0.1'].includes(new URL(BASE).hostname))throw Error('Synthetic localhost only')
await mkdir(out,{recursive:true})
const lead=Array.from({length:8},(_,i)=>`Synthetic lead paragraph ${i} keeps the fixture away from the top edge.\n\n`).join(''),tail=Array.from({length:30},(_,i)=>`Synthetic paragraph ${i} leaves room to scroll in either direction.\n\n`).join('')
const day=(n,title)=>`#### DAY ${n}\n##### ${title}\n\n${lead}Alpha target passage keeps its exact place in the fixture.\n\nSecond separate passage stays highlighted.\n\nA **bold lead** and *italic words* with [a link](https://example.invalid) run on.\n\nThe next block continues the long mark here.\n\n| Field | Entry |\n| --- | --- |\n| Far cell | Synthetic far entry text |\n\n${tail}`
const source=`# Source text\n# Daily Readings\n## Fictional topic\n### Week 1\n${day(1,'Gesture fixture one')}${day(2,'Gesture fixture two')}`
const helpers=()=>{
  window.rangeOf=(needle,length)=>{
    const root=document.querySelector('.study-source-text'),walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];let all=''
    for(let n;(n=walk.nextNode());){nodes.push([n,all.length]);all+=n.data}
    const i=all.indexOf(needle);if(i<0)throw Error('Fixture text not found: '+needle)
    const j=i+(length??needle.length),at=k=>{for(let x=nodes.length-1;x>=0;x--)if(nodes[x][1]<=k)return [nodes[x][0],k-nodes[x][1]]}
    const r=document.createRange(),[a,ao]=at(i),[b,bo]=at(j);r.setStart(a,ao);r.setEnd(b,bo);return r
  }
  window.selectNeedle=(needle,length)=>{const s=getSelection();s.removeAllRanges();s.addRange(rangeOf(needle,length))}
  window.reader=()=>document.querySelector('.study-screen')
  window.events=[];for(const type of ['pointerdown','pointerup','pointercancel','touchstart','touchend','touchcancel','click'])document.addEventListener(type,e=>{const t=e.target instanceof Element?e.target:null;window.events.push(type+':'+(t?.closest('.study-highlight-actions button')?.textContent||t?.closest('.study-highlight-actions')&&'actions'||t?.closest('.study-source-text')&&'text'||t?.tagName?.toLowerCase()||'document'))},true)
  // Hold every animation frame until released, to order a queued frame against a press deterministically.
  window.holdFrames=()=>{const held=[],raf=window.requestAnimationFrame,caf=window.cancelAnimationFrame;window.requestAnimationFrame=cb=>{held.push(cb);return -held.length};window.cancelAnimationFrame=id=>{if(id<0)held[-id-1]=null;else caf(id)};window.heldFrames=()=>held.filter(Boolean).length;window.releaseFrames=()=>{window.requestAnimationFrame=raf;window.cancelAnimationFrame=caf;const run=held.filter(Boolean);held.length=0;for(const cb of run)cb(performance.now());return run.length}}
  window.clicks=[];document.addEventListener('click',e=>{const t=e.target instanceof Element?e.target.closest('button'):null;window.clicks.push(t?.getAttribute('aria-label')||t?.textContent||'')},true)
  // Hold the annotations store with a raw IndexedDB transaction, so a removal is pending for a while.
  window.holdStore=ms=>new Promise(res=>{const rq=indexedDB.open('field-notes-study');rq.onsuccess=()=>{const db=rq.result,tx=db.transaction('annotations','readwrite'),st=tx.objectStore('annotations'),until=Date.now()+ms;const spin=()=>{if(Date.now()<until)st.count().onsuccess=spin};spin();tx.oncomplete=()=>db.close();res()}})
}
const browser=await chromium.launch(),errors=[],report=[]
async function device({width,height,touch,vault}){
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch&&width<600})
  await context.addInitScript(helpers)
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());if(url.origin===BASE)return route.continue()
    if(vault&&url.hostname===host)return vault.route(route,url)
    return route.abort()
  })
  const page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(`${width}: ${e.message}`))
  return {context,page,cdp:touch?await context.newCDPSession(page):null}
}
// Fresh fixture rows; returns the reading ids and the drawn copy of the target.
async function seed(page,vault){
  await page.goto(BASE+'/tests/redesign-check.html')
  return page.evaluate(async({source,vault,host})=>{
    if(vault){const {setVault}=await import('/src/sync/vault.ts');setVault({id:vault.scope,key:vault.key,url:'https://'+host,anonKey:'synthetic-anon'})}
    const {installStudySource,studyDB,studyScope}=await import('/src/theology/store.ts'),{readingFor}=await import('/src/theology/reading.ts'),{changed}=await import('/src/lib/db.ts')
    const e=await installStudySource(new TextEncoder().encode(source),{title:'Synthetic gestures',filename:'gestures.md'})
    if(vault)Object.assign((await import('/src/theology/model.ts')).DAILY_DOCTRINE,{sha256:e.id,bytes:e.bytes})
    const s1=e.sections.find(s=>s.reading===1),s2=e.sections.find(s=>s.reading===2),r1=readingFor(e,s1.id),r2=readingFor(e,s2.id),at=Date.UTC(2026,9,1),scope=studyScope()
    const mark=(id,s,r,from,to,extra={})=>{const start=r.text.indexOf(from),end=r.text.indexOf(to,start)+to.length;if(start<0||end<start)throw Error('fixture '+id);return {scope,id,edition:e.id,section:s.id,start,end,quote:r.text.slice(start,end),prefix:r.text.slice(Math.max(0,start-40),start),suffix:r.text.slice(end,end+40),color:'brass',created:at,updated:at,...extra}}
    const T=mark('mark-t',s1,r1,'target passage','keeps')
    const rows=[T,{...T,id:'mark-t2',created:at-1000,updated:at-1000},{...T,id:'mark-t3'},
      mark('mark-p',s1,r1,'passage keeps','exact',{color:'forest',updated:at+5000}),
      mark('mark-s',s1,r1,'Second separate','passage',{color:'navy'}),
      mark('mark-l',s1,r1,'bold lead','continues the long',{color:'oxblood'}),
      mark('mark-c',s1,r1,'Synthetic far entry','entry'),
      mark('mark-r2',s2,r2,'target passage','keeps'),
      {...T,scope:'other-vault',id:'mark-other'}]
    if(r1.text.indexOf('target passage')!==r2.text.indexOf('target passage'))throw Error('Readings must share offsets')
    await studyDB.annotations.clear();await studyDB.annotations.bulkPut(rows);changed()
    return {s1:s1.id,s2:s2.id,scope}
  },{source,vault:vault&&{scope:vault.scope,key:vault.key},host})
}
const rows=page=>page.evaluate(async()=>(await (await import('/src/theology/store.ts')).studyDB.annotations.toArray()).sort((a,b)=>(a.scope+a.id).localeCompare(b.scope+b.id)))
function onlyChanged(before,after,ids,label){
  for(const row of after){const old=before.find(r=>r.scope===row.scope&&r.id===row.id)
    if(ids.includes(row.id)&&row.scope===old?.scope&&old.scope!=='other-vault')assert.ok(row.deleted&&row.deleted>=old.updated,`${label}: ${row.id} is tombstoned`)
    else if(old)assert.deepEqual(row,old,`${label}: ${row.id} is unchanged`)
  }
  assert.ok(after.length>=before.length,`${label}: nothing is hard-deleted`)
}
async function open(page,section,id='mark-s'){
  await page.goto(BASE+'/theology/doctrine/'+section)
  await page.locator(`[data-study-highlight="${id}"]`).first().waitFor()
  await page.evaluate(id=>{const m=document.querySelector(`[data-study-highlight="${id}"]`),r=reader();r.scrollBy(0,m.getBoundingClientRect().top-innerHeight*0.45)},id)
  await page.waitForTimeout(250)
}
const toolbar=page=>page.locator('[role=toolbar][aria-label=Highlight]')
const toolbarRemove=page=>toolbar(page).getByRole('button',{name:'Remove saved highlight',exact:true})
const dialog=page=>page.getByRole('dialog',{name:'Highlight actions',exact:true})
const dialogRemove=page=>dialog(page).getByRole('button',{name:'Remove saved highlight',exact:true})
const undo=page=>page.getByRole('button',{name:'Undo',exact:true})
const scrollReader=(page,y)=>page.evaluate(y=>reader().scrollBy(0,y),y)
async function openActions(page,id='mark-s',touch=false){const m=page.locator(`[data-study-highlight="${id}"]`).first();if(touch)await m.tap();else await m.click();await dialog(page).waitFor();await page.waitForTimeout(100)}
const isOpen=async page=>(await dialog(page).count())>0
const center=async locator=>{const b=await locator.boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2}}
// Points keep their own ids, so one finger can lift while another stays down.
const touchAt=(cdp,type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map((p,i)=>({x:p.x,y:p.y,id:p.id??i}))})
async function geometry(page,locator,label){
  const g=await locator.evaluate(el=>{
    const v=visualViewport,nav=document.querySelector('nav.floating-nav')?.getBoundingClientRect(),floor=Math.min(nav&&nav.height?nav.top:Infinity,v.offsetTop+v.height),box=el.getBoundingClientRect(),style=getComputedStyle(el)
    const buttons=()=>[...el.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {w:r.width,h:r.height,t:r.top,b:r.bottom,visible:r.top>=box.top-0.5&&r.bottom<=box.bottom+0.5,hit:hit===b||b.contains(hit)}})
    const scrolls=el.scrollHeight>el.clientHeight+1,result={box:{l:box.left,t:box.top,r:box.right,b:box.bottom,w:box.width},view:{l:v.offsetLeft,t:v.offsetTop,r:v.offsetLeft+v.width,w:v.width},floor,scrolls,overflowFlag:el.hasAttribute('data-overflow'),touchAction:style.touchAction,overflowY:style.overflowY,buttons:buttons(),reachable:[]}
    // Every button must be reachable: scrolled into the popover's own view if it scrolls, then hit-tested.
    for(const b of el.querySelectorAll('button')){b.scrollIntoView({block:'nearest',inline:'nearest'});const r=b.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);result.reachable.push(hit===b||b.contains(hit))}
    el.scrollTop=0
    return result
  })
  assert.ok(g.box.l>=g.view.l+11.5&&g.box.r<=g.view.r-11.5&&g.box.t>=g.view.t+11.5&&g.box.b<=g.floor+0.5,`${label}: popover inside the visible screen and above the pill ${JSON.stringify(g.box)} view ${JSON.stringify(g.view)} floor ${g.floor}`)
  assert.ok(g.box.w<=g.view.w-23.5,`${label}: no wider than the visible screen`)
  for(const b of g.buttons)assert.ok(b.w>=43.5&&b.h>=43.5,`${label}: buttons stay 44px targets`)
  assert.ok(g.reachable.every(Boolean),`${label}: every button is reachable and is the thing under its own centre`)
  if(g.scrolls)assert.ok(g.overflowFlag&&/pan-y/.test(g.touchAction)&&/auto|scroll/.test(g.overflowY),`${label}: a popover taller than its room scrolls and can be panned`)
  else assert.ok(g.buttons.every(b=>b.visible&&b.hit),`${label}: with no scroll every button is visible and hit`)
  return g
}
const cases=[]
const test=(name,widths,fn)=>cases.push({name,widths,fn})

// 1–2. Remove from the toolbar takes the drawn copy and its exact copies, nothing else.
test('toolbar Remove after a mouse drag',[[1440,900,false]],async({page,ids})=>{
  const before=await rows(page),b=await page.evaluate(()=>{const r=rangeOf('target').getBoundingClientRect();return {l:r.left+r.width*0.15,r:r.right-2,y:r.top+r.height/2}})
  await page.mouse.move(b.l,b.y);await page.mouse.down();await page.mouse.move(b.r,b.y,{steps:6});await page.mouse.up()
  await toolbarRemove(page).waitFor();assert.equal(await toolbarRemove(page).getAttribute('data-target-id'),'mark-t3','The id tie-break picks the drawn copy')
  await geometry(page,toolbar(page),'1440 five-button toolbar');await page.screenshot({path:`${out}/1440-toolbar-remove.png`})
  await toolbarRemove(page).click();await undo(page).waitFor()
  onlyChanged(before,await rows(page),['mark-t','mark-t2','mark-t3'],'toolbar Remove')
  assert.equal(await page.evaluate(()=>getSelection().isCollapsed),true,'The selection ends with the removal')
  // 17. Undo restores one fresh highlight; the tombstones stay; reload keeps it.
  await undo(page).click();await page.waitForFunction(()=>!document.querySelector('.study-highlight-undo'))
  const restored=(await rows(page)).filter(r=>r.scope===ids.scope&&r.section===ids.s1&&!r.deleted&&r.quote==='target passage keeps')
  assert.equal(restored.length,1);assert.ok(!['mark-t','mark-t2','mark-t3'].includes(restored[0].id),'Undo makes a fresh id')
  assert.equal((await rows(page)).filter(r=>['mark-t','mark-t2','mark-t3'].includes(r.id)&&r.deleted).length,3)
  await page.reload();await page.locator(`[data-study-highlight="${restored[0].id}"]`).first().waitFor()
})
test('toolbar Remove on a touch selection',[[390,844,true]],async({page})=>{
  const before=await rows(page);await page.evaluate(()=>selectNeedle('target'));await toolbarRemove(page).waitFor()
  await geometry(page,toolbar(page),'390 five-button toolbar');await page.screenshot({path:`${out}/390-toolbar-remove.png`})
  await toolbarRemove(page).tap();await undo(page).waitFor()
  onlyChanged(before,await rows(page),['mark-t','mark-t2','mark-t3'],'touch toolbar Remove')
})
// 3. Selecting, by mouse, touch range or keyboard, writes nothing.
test('selection alone writes nothing',[[1440,900,false]],async({page})=>{
  const before=await rows(page)
  await page.evaluate(()=>selectNeedle('target'));await toolbarRemove(page).waitFor()
  await page.evaluate(()=>{const r=rangeOf('Alpha');r.collapse(true);getSelection().removeAllRanges();getSelection().addRange(r)})
  for(let i=0;i<9;i++)await page.keyboard.press('Shift+ArrowRight')
  await page.waitForTimeout(200);await page.keyboard.press('Escape');await page.waitForTimeout(200)
  assert.deepEqual(await rows(page),before,'No selection gesture writes')
})
// 4. Keyboard focus moves never change the target; Enter on Remove is an ordinary click.
test('toolbar target survives focus moves',[[1440,900,false]],async({page})=>{
  const before=await rows(page);await page.evaluate(()=>selectNeedle('target'));await toolbarRemove(page).waitFor()
  const id=await toolbarRemove(page).getAttribute('data-target-id')
  await page.keyboard.press('Tab');await page.keyboard.press('Alt+h');for(let i=0;i<4;i++)await page.keyboard.press('ArrowRight')
  assert.equal(await toolbarRemove(page).getAttribute('data-target-id'),id)
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Remove saved highlight')
  await page.keyboard.press('Enter');await undo(page).waitFor()
  onlyChanged(before,await rows(page),['mark-t','mark-t2','mark-t3'],'keyboard Remove')
})
// 5. A range that is not one drawn highlight offers no Remove.
test('ambiguous selections offer no Remove',[[1440,900,false]],async({page})=>{
  const before=await rows(page)
  // Into plain text, across two highlights, from the target onto the overlap drawn on top, and past the overlap's end.
  for(const [needle,until] of [['Alpha target',null],['target','Second separate'],['target passage',null],['exact place',null]]){
    await page.evaluate(([n,u])=>{if(!u)return selectNeedle(n);const t=document.querySelector('.study-source-text').textContent;selectNeedle(n,t.indexOf(u)+u.length-t.indexOf(n))},[needle,until]);await toolbar(page).waitFor();await page.waitForTimeout(120)
    assert.equal(await toolbarRemove(page).count(),0,`No Remove for "${needle.slice(0,24)}"`)
  }
  // Wholly under the overlap drawn on top: that overlap is what the eye sees, so it is the target.
  await page.evaluate(()=>selectNeedle('passage keeps'));await toolbarRemove(page).waitFor()
  assert.equal(await toolbarRemove(page).getAttribute('data-target-id'),'mark-p')
  assert.deepEqual(await rows(page),before)
})
// 6. Same offsets in another reading target that reading's highlight.
test('same bounds in the next reading',[[1440,900,false]],async({page,ids})=>{
  await open(page,ids.s2,'mark-r2');const before=await rows(page)
  await page.evaluate(()=>selectNeedle('target'));await toolbarRemove(page).waitFor()
  assert.equal(await toolbarRemove(page).getAttribute('data-target-id'),'mark-r2')
  await toolbarRemove(page).click();await undo(page).waitFor()
  onlyChanged(before,await rows(page),['mark-r2'],'second reading')
})
// 7. A highlight arriving during the selection withdraws Remove; it never becomes the target.
test('remote overlap invalidates, never substitutes',[[1440,900,false]],async({page,ids})=>{
  await page.evaluate(()=>selectNeedle('target'));await toolbarRemove(page).waitFor()
  await page.evaluate(async({scope,s1})=>{const {studyDB}=await import('/src/theology/store.ts'),{changed}=await import('/src/lib/db.ts'),t=await studyDB.annotations.get([scope,'mark-t']);await studyDB.annotations.put({...t,id:'mark-remote',color:'navy',updated:Date.UTC(2026,9,2)});changed()},{scope:ids.scope,s1:ids.s1})
  await page.locator('[data-study-highlight="mark-remote"]').first().waitFor()
  await page.waitForFunction(()=>!document.querySelector('[role=toolbar] [data-target-id]'))
  const before=await rows(page)
  await page.keyboard.press('Shift+ArrowLeft');await page.waitForTimeout(200)
  assert.equal(await toolbarRemove(page).count(),0,'An invalidated target stays withdrawn for the rest of the selection')
  assert.deepEqual(await rows(page),before)
  await page.evaluate(()=>getSelection().removeAllRanges());await page.waitForTimeout(150)
  await page.evaluate(()=>selectNeedle('target'));await toolbarRemove(page).waitFor()
  assert.equal(await toolbarRemove(page).getAttribute('data-target-id'),'mark-remote','A genuinely new selection decides afresh')
})
// 8. A target gone from the store is said in the dialog; a fragment gone from the page closes it.
test('missing target and vanished fragment',[[390,844,true]],async({page,ids})=>{
  await openActions(page,'mark-s',true);const before=await rows(page)
  // Deleted under a render that has not refreshed: the delete and the click happen together,
  // because any later refresh correctly closes the actions as a vanished fragment instead.
  await page.evaluate(async scope=>{const {studyDB}=await import('/src/theology/store.ts');await studyDB.annotations.delete([scope,'mark-s']);[...document.querySelectorAll('.study-highlight-actions button')].find(b=>b.textContent==='Remove saved highlight').click()},ids.scope)
  await dialog(page).getByRole('status').filter({hasText:'no longer on this device'}).waitFor()
  assert.equal(await undo(page).count(),0);assert.equal(await page.getByRole('alert').count(),0)
  onlyChanged(before.filter(r=>r.id!=='mark-s'),await rows(page),[],'missing target')
  await page.screenshot({path:`${out}/390-missing-target.png`})
  await dialog(page).getByRole('button',{name:'Close highlight actions'}).tap()
  await openActions(page,'mark-l',true)
  await page.evaluate(async scope=>{const {studyDB}=await import('/src/theology/store.ts'),{changed}=await import('/src/lib/db.ts'),l=await studyDB.annotations.get([scope,'mark-l']);await studyDB.annotations.put({...l,deleted:l.updated+1,updated:l.updated+1});changed()},ids.scope)
  await page.waitForFunction(()=>!document.querySelector('.study-highlight-actions'))
  assert.equal(await undo(page).count(),0,'A vanished fragment closes quietly, with no success or Undo')
})
// 9. The actions belong to the fragment that was tapped.
test('later fragment with the first off-screen',[[390,844,true],[1440,900,false]],async({page,touch})=>{
  await page.evaluate(()=>{const frags=[...document.querySelectorAll('[data-study-highlight="mark-l"]')],last=frags[frags.length-1];reader().scrollBy(0,last.getBoundingClientRect().top-24)})
  await page.waitForTimeout(250)
  const frags=page.locator('[data-study-highlight="mark-l"]'),last=frags.last()
  assert.ok((await frags.first().boundingBox()).y+(await frags.first().boundingBox()).height<=24.5,'The first fragment is off-screen')
  if(touch)await last.tap();else await last.click();await dialog(page).waitFor()
  const place=async()=>{const d=await dialog(page).boundingBox(),f=await last.boundingBox();return Math.min(Math.abs(d.y-(f.y+f.height)),Math.abs(d.y+d.height-f.y))}
  assert.ok(await place()<=20,'The actions sit at the tapped fragment')
  await scrollReader(page,1);await page.waitForTimeout(150);assert.ok(await isOpen(page));assert.ok(await place()<=20,'and follow it')
})
// 10. 24px is a threshold, measured cumulatively from where the passage was.
test('scroll thresholds',[[390,844,true]],async({page})=>{
  const before=await rows(page)
  await openActions(page,'mark-s',true);await scrollReader(page,23);await page.waitForTimeout(150);assert.ok(await isOpen(page),'23px keeps it open')
  await scrollReader(page,1);await page.waitForTimeout(150);assert.ok(!(await isOpen(page)),'24px closes it')
  await scrollReader(page,-24);await page.waitForTimeout(100)
  await openActions(page,'mark-s',true)
  for(let i=0;i<5;i++){await scrollReader(page,4);await page.waitForTimeout(60)}
  assert.ok(await isOpen(page),'20px in steps keeps it open')
  for(let i=0;i<3;i++){await scrollReader(page,4);await page.waitForTimeout(60)}
  await page.waitForTimeout(100);assert.ok(!(await isOpen(page)),'32px in 4px steps closes it')
  assert.deepEqual(await rows(page),before,'Scrolling writes nothing')
})
// 11. Resize sets a new starting point; then 1px is just 1px.
test('resize then 1px',[[390,844,true]],async({page})=>{
  const before=await rows(page);await openActions(page,'mark-s',true)
  await page.setViewportSize({width:390,height:760});await page.waitForTimeout(200)
  await scrollReader(page,1);await page.waitForTimeout(150);assert.ok(await isOpen(page))
  await geometry(page,dialog(page),'390 after resize');await dialogRemove(page).tap();await undo(page).waitFor()
  onlyChanged(before,await rows(page),['mark-s'],'resize then Remove')
})
// 12. The press guard, with real touch input rather than injected scroll alone.
test('press guard and touch gestures',[[390,844,true]],async({page,cdp})=>{
  let before=await rows(page);await openActions(page,'mark-s',true)
  const top=()=>page.evaluate(()=>reader().scrollTop),clicked=()=>page.evaluate(()=>window.clicks.includes('Remove saved highlight'))
  // The trace case: the reader scrolls 30px during the press; the click still lands on Remove.
  let p=await center(dialogRemove(page));await page.evaluate(()=>{window.clicks=[]})
  await touchAt(cdp,'touchStart',[p]);await scrollReader(page,30);await page.waitForTimeout(60);await touchAt(cdp,'touchEnd',[])
  await undo(page).waitFor();onlyChanged(before,await rows(page),['mark-s'],'press guard')
  // Gestures that do not end as a tap on Remove write nothing, unconditionally. The emitted events are
  // checked too, so a click that did slip through fails here rather than excusing the assertion.
  const untouched=async(label,expectOpen)=>{
    const events=await page.evaluate(()=>window.events)
    assert.ok(!events.includes('click:Remove saved highlight'),`${label}: no click on Remove (${events.join(' ')})`)
    assert.deepEqual(await rows(page),before,`${label}: annotations unchanged`)
    assert.equal(await undo(page).count(),0,`${label}: no success or Undo`)
    if(expectOpen!==undefined)assert.equal(await isOpen(page),expectOpen,`${label}: actions ${expectOpen?'still open':'closed'}`)
  }
  // Each gesture starts from a reloaded page, so a toast left by an earlier intended removal can't stand in for one.
  const fresh=async()=>{await page.reload();await page.locator('[data-study-highlight="mark-l"]').first().waitFor();await page.evaluate(()=>{const m=document.querySelector('[data-study-highlight="mark-l"]');reader().scrollBy(0,m.getBoundingClientRect().top-innerHeight*0.5)});await page.waitForTimeout(150);await openActions(page,'mark-l',true);await page.evaluate(()=>{window.events=[];window.clicks=[]});before=await rows(page);return center(dialogRemove(page))}
  // A drag that starts on Remove and is released 40px below it: no pan, no click, no write.
  p=await fresh();const startTop=await top()
  await touchAt(cdp,'touchStart',[p]);for(let i=1;i<=8;i++){await touchAt(cdp,'touchMove',[{x:p.x,y:p.y+i*5}]);await page.waitForTimeout(16)}await touchAt(cdp,'touchEnd',[]);await page.waitForTimeout(500)
  assert.equal(await top(),startTop,'No pan from a drag on the actions');await untouched('drag off Remove',true)
  // Cancel: nothing written, and the guard is released.
  p=await fresh()
  await touchAt(cdp,'touchStart',[p]);await touchAt(cdp,'touchCancel',[]);await page.waitForTimeout(450)
  await untouched('touch cancel',true)
  await scrollReader(page,30);await page.waitForTimeout(200);assert.ok(!(await isOpen(page)),'After cancel the guard has let go')
  // Release well outside the actions.
  p=await fresh()
  await touchAt(cdp,'touchStart',[p]);for(let i=1;i<=6;i++)await touchAt(cdp,'touchMove',[{x:p.x,y:p.y-i*30}]);await touchAt(cdp,'touchEnd',[]);await page.waitForTimeout(500)
  await untouched('release outside')
  // Multitouch: an unrelated finger goes down and lifts while the original stays on Remove; then the
  // original is released outside, or cancelled. Neither may write.
  for(const ending of ['release outside','cancel']){
    p=await fresh();const other={x:40,y:Math.max(60,p.y-160),id:1},held={...p,id:0}
    await touchAt(cdp,'touchStart',[held]);await touchAt(cdp,'touchStart',[held,other]);await page.waitForTimeout(40)
    await touchAt(cdp,'touchMove',[held]);await page.waitForTimeout(40)
    if(ending==='cancel')await touchAt(cdp,'touchCancel',[])
    else{for(let i=1;i<=6;i++)await touchAt(cdp,'touchMove',[{...held,y:p.y-i*30}]);await touchAt(cdp,'touchEnd',[])}
    await page.waitForTimeout(500);await untouched(`multitouch, original ${ending}`)
  }
  // The valid version: the other finger lifts, then the original lifts on Remove. That may remove the
  // passage, but only it, and only if the click is on Remove.
  p=await fresh();{const other={x:40,y:Math.max(60,p.y-160),id:1},held={...p,id:0}
    await touchAt(cdp,'touchStart',[held]);await touchAt(cdp,'touchStart',[held,other]);await page.waitForTimeout(40);await touchAt(cdp,'touchMove',[held]);await page.waitForTimeout(40);await touchAt(cdp,'touchEnd',[]);await page.waitForTimeout(600)
    const events=await page.evaluate(()=>window.events),clickedRemove=events.includes('click:Remove saved highlight')
    if(clickedRemove){await undo(page).waitFor();onlyChanged(before,await rows(page),['mark-l'],'multitouch then a valid tap')}
    else assert.deepEqual(await rows(page),before,'multitouch with no click on Remove writes nothing')
    report.push({multitouchValidTapClicked:clickedRemove})
  }
})
// The race Siena found: a frame queued by a scroll before the press began must not move or close
// the actions during the press. Frames are held so the order is scroll → pointerdown → frame → release.
test('a frame queued before the press defers to it',[[390,844,true]],async({page,cdp})=>{
  // Cancel first: the tap that follows removes the passage.
  for(const ending of ['touchCancel','touchEnd']){
    if(await isOpen(page))await page.keyboard.press('Escape')
    await page.evaluate(()=>{const m=document.querySelector('[data-study-highlight="mark-s"]');reader().scrollBy(0,m.getBoundingClientRect().top-innerHeight*0.5)});await page.waitForTimeout(150)
    await openActions(page,'mark-s',true);const before=await rows(page),p=await center(dialogRemove(page)),box=await dialog(page).boundingBox()
    await page.evaluate(()=>{window.events=[];holdFrames()})
    await scrollReader(page,30);await page.waitForFunction(()=>window.heldFrames()>0)
    await touchAt(cdp,'touchStart',[p])
    assert.ok(await page.evaluate(()=>window.releaseFrames())>0,'The queued frame runs during the press')
    assert.ok(await isOpen(page),`${ending}: still open after the queued frame`);assert.deepEqual(await dialog(page).boundingBox(),box,`${ending}: not moved under the finger`)
    await touchAt(cdp,ending,[]);await page.waitForTimeout(500)
    const events=await page.evaluate(()=>window.events)
    if(ending==='touchEnd'){
      assert.ok(events.includes('click:Remove saved highlight'),`The tap lands on Remove (${events.join(' ')})`)
      await undo(page).waitFor();onlyChanged(before,await rows(page),['mark-s'],'queued frame then tap')
    }else{
      assert.ok(!events.includes('click:Remove saved highlight'),'A cancelled press does not click')
      assert.deepEqual(await rows(page),before,'A cancelled press writes nothing')
      assert.ok(!(await isOpen(page)),'After the press, the deferred check closes the moved actions')
    }
  }
})
test('press guard is bounded and let go on blur and lost capture',[[390,844,true]],async({page})=>{
  const before=await rows(page)
  const press=()=>page.evaluate(()=>document.querySelector('.study-highlight-actions').dispatchEvent(new PointerEvent('pointerdown',{pointerId:91,isPrimary:true,bubbles:true})))
  await openActions(page,'mark-l',true);await press();await scrollReader(page,30);await page.waitForTimeout(300)
  assert.ok(await isOpen(page),'Held still while pressed');await page.waitForTimeout(2600)
  assert.ok(!(await isOpen(page)),'The press ends at its limit and the deferred check runs')
  await scrollReader(page,-30);await page.waitForTimeout(100);await openActions(page,'mark-l',true);await press();await scrollReader(page,30);await page.waitForTimeout(150)
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.waitForTimeout(150);assert.ok(!(await isOpen(page)),'Blur lets go')
  await scrollReader(page,-30);await page.waitForTimeout(100);await openActions(page,'mark-l',true);await press();await scrollReader(page,30);await page.waitForTimeout(150)
  await page.evaluate(()=>document.querySelector('.study-highlight-actions').dispatchEvent(new PointerEvent('lostpointercapture',{pointerId:91,bubbles:true})));await page.waitForTimeout(150)
  assert.ok(!(await isOpen(page)),'Capture lost before release lets go')
  assert.deepEqual(await rows(page),before,'None of it writes')
})
test('mouse release outside and the desktop pill',[[1440,900,false]],async({page})=>{
  let before=await rows(page);await openActions(page,'mark-l');const p=await center(dialogRemove(page))
  await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x,p.y-140,{steps:5});await page.mouse.up();await page.waitForTimeout(450)
  assert.deepEqual(await rows(page),before,'Mouse release outside writes nothing')
  // 16. The window shortens with the actions open low on the screen: they move above the pill.
  if(await isOpen(page))await page.keyboard.press('Escape')
  await page.evaluate(()=>{const m=document.querySelector('[data-study-highlight="mark-s"]');reader().scrollBy(0,m.getBoundingClientRect().top-(innerHeight-130))});await page.waitForTimeout(250)
  await openActions(page,'mark-s');await page.setViewportSize({width:1440,height:780});await page.waitForTimeout(250)
  await geometry(page,dialog(page),'1440 after the window shortens');before=await rows(page)
  await dialogRemove(page).click();await undo(page).waitFor();onlyChanged(before,await rows(page),['mark-s'],'desktop Remove after shrink')
})
// 13. Clipping by a scroller between the passage and the screen (test-only overflow: readings have none today).
test('nested clipping',[[390,844,true]],async({page})=>{
  await page.addStyleTag({content:'.study-source-table{overflow-x:auto}.study-source-table table{min-width:1400px}.study-source-table tr{display:table-row!important}.study-source-table td{display:table-cell!important;width:auto!important}'})
  await page.evaluate(()=>{const m=document.querySelector('[data-study-highlight="mark-c"]');reader().scrollBy(0,m.getBoundingClientRect().top-innerHeight*0.45);m.closest('.study-source-table').scrollLeft=0});await page.waitForTimeout(200)
  const before=await rows(page);await openActions(page,'mark-c',true)
  await page.evaluate(()=>{document.querySelector('.study-source-table').scrollLeft+=10});await page.waitForTimeout(150);assert.ok(await isOpen(page),'Still visible inside its scroller')
  await page.evaluate(()=>{document.querySelector('.study-source-table').scrollLeft+=1200});await page.waitForTimeout(150);assert.ok(!(await isOpen(page)),'Clipped out by its scroller')
  assert.deepEqual(await rows(page),before)
})
// 14. Placement never takes focus from Close.
test('focus stays on Close',[[1440,900,false]],async({page})=>{
  await page.locator('[data-study-highlight="mark-s"]').first().focus();await page.keyboard.press('Enter');await dialog(page).waitFor()
  await dialog(page).getByRole('button',{name:'Close highlight actions'}).focus()
  await scrollReader(page,1);await page.setViewportSize({width:1440,height:860});await page.waitForTimeout(250)
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Close highlight actions')
})
// 15. Four and five buttons, narrow, landscape and enlarged text, and an in-dialog message.
test('placement at small and enlarged sizes',[[320,568,true],[390,844,true],[844,390,true]],async({page,width,ids})=>{
  for(const enlarged of [false,true]){
    if(enlarged)await page.addStyleTag({content:'.study-selection-toolbar button,.study-popover-note{font-size:26px!important}.study-selection-toolbar .study-swatch{flex-basis:56px!important;width:56px!important;height:56px!important}'})
    await page.evaluate(()=>selectNeedle('Synthetic lead paragraph 7'));await toolbar(page).waitFor();await page.waitForTimeout(150)
    assert.equal(await toolbar(page).locator('button').count(),4);await geometry(page,toolbar(page),`${width} four-button${enlarged?' enlarged':''}`)
    await page.evaluate(()=>selectNeedle('target'));await toolbarRemove(page).waitFor();await page.waitForTimeout(150)
    await geometry(page,toolbar(page),`${width} five-button${enlarged?' enlarged':''}`)
    await page.evaluate(()=>getSelection().removeAllRanges());await page.waitForTimeout(150)
  }
  await openActions(page,'mark-s',true)
  await page.evaluate(async scope=>{const {studyDB}=await import('/src/theology/store.ts');await studyDB.annotations.delete([scope,'mark-s']);[...document.querySelectorAll('.study-highlight-actions button')].find(b=>b.textContent==='Remove saved highlight').click()},ids.scope)
  await dialog(page).getByRole('status').waitFor();await page.waitForTimeout(150)
  const g=await geometry(page,dialog(page),`${width} enlarged message`)
  report.push({width,enlargedMessageScrolls:g.scrolls})
  await page.screenshot({path:`${out}/${width}-enlarged-message.png`})
})
// Pinch zoom: the popovers are sized and placed within the visual viewport, not the layout viewport.
// Headless Chromium here won't zoom (setPageScaleFactor and synthesized pinches leave the scale at 1),
// so the visual viewport of a 2x zoom is substituted: half the size, offset into the page.
test('placement under pinch zoom',[[390,844,true]],async({page})=>{
  const zoom=()=>page.evaluate(()=>{const real=window.visualViewport;Object.defineProperty(window,'visualViewport',{configurable:true,value:{width:195,height:422,offsetLeft:90,offsetTop:200,scale:2,addEventListener:real.addEventListener.bind(real),removeEventListener:real.removeEventListener.bind(real)}})})
  await page.evaluate(()=>{const r=rangeOf('target').getBoundingClientRect();reader().scrollBy(0,r.top-380)});await page.waitForTimeout(200);await zoom()
  await page.evaluate(()=>selectNeedle('target'));await toolbarRemove(page).waitFor();await page.waitForTimeout(150)
  const t=await geometry(page,toolbar(page),'390 zoomed toolbar');assert.ok(t.box.w<=171.5,'The five-button row wraps to the zoomed width')
  await page.evaluate(()=>getSelection().removeAllRanges());await page.waitForTimeout(150)
  await page.evaluate(()=>document.querySelector('[data-study-highlight="mark-s"]').click());await dialog(page).waitFor();await page.waitForTimeout(150)
  await geometry(page,dialog(page),'390 zoomed actions')
})
// A popover taller than its room: one finger scrolls it (without moving the reading) and every control stays usable.
test('a scrolling popover keeps every control reachable',[[568,320,true]],async({page,cdp})=>{
  await page.addStyleTag({content:'.study-selection-toolbar button{font-size:26px!important}.study-selection-toolbar .study-swatch{flex-basis:120px!important;width:120px!important;height:120px!important}'})
  await page.evaluate(()=>selectNeedle('target'));await toolbarRemove(page).waitFor();await page.waitForTimeout(200)
  const g=await geometry(page,toolbar(page),'568x320 overflowing toolbar');assert.ok(g.scrolls,'The toolbar is taller than its room')
  const box=await toolbar(page).boundingBox(),readerTop=await page.evaluate(()=>reader().scrollTop),x=box.x+box.width/2,y0=box.y+box.height-12
  await touchAt(cdp,'touchStart',[{x,y:y0}]);for(let i=1;i<=10;i++){await touchAt(cdp,'touchMove',[{x,y:y0-i*18}]);await page.waitForTimeout(16)}await touchAt(cdp,'touchEnd',[]);await page.waitForTimeout(300)
  assert.ok(await toolbar(page).evaluate(el=>el.scrollTop)>0,'One finger scrolls the toolbar')
  assert.equal(await page.evaluate(()=>reader().scrollTop),readerTop,'The reading does not move')
  const before=await rows(page),r=await toolbarRemove(page).boundingBox(),hit=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('button')?.getAttribute('aria-label'),{x:r.x+r.width/2,y:r.y+r.height/2})
  assert.equal(hit,'Remove saved highlight','Remove is under the finger after scrolling')
  await toolbarRemove(page).tap();await undo(page).waitFor();onlyChanged(before,await rows(page),['mark-t','mark-t2','mark-t3'],'Remove from a scrolled toolbar')
})
// Pending removals: navigation, a vault change, a second click, and a failure after dismissal.
test('pending removal then the next reading',[[1440,900,false]],async({page,ids})=>{
  const before=await rows(page);await openActions(page,'mark-s')
  await page.evaluate(()=>holdStore(1500));await dialogRemove(page).click()
  await page.locator('a[rel=next]').first().click();await page.waitForURL(`**/${encodeURIComponent(ids.s2)}**`).catch(()=>page.waitForURL(`**/${ids.s2}**`))
  await page.locator('[data-study-highlight="mark-r2"]').first().waitFor()
  await page.evaluate(()=>selectNeedle('Second separate'));await toolbar(page).waitFor()
  const focus=await page.evaluate(()=>document.activeElement?.outerHTML.slice(0,80))
  await page.waitForTimeout(1900)
  onlyChanged(before,await rows(page),['mark-s'],'the write still commits')
  assert.equal(await undo(page).count(),0,'No Undo in a reading the removal did not start in')
  assert.equal(await page.evaluate(()=>getSelection().toString()),'Second separate','The new reading keeps its selection')
  assert.equal(await page.evaluate(()=>document.activeElement?.outerHTML.slice(0,80)),focus,'and its focus')
})
test('pending removal then a vault change',[[1440,900,false]],async({page,ids})=>{
  const before=await rows(page);await openActions(page,'mark-s')
  await page.evaluate(()=>holdStore(1200));await dialogRemove(page).click()
  await page.evaluate(async()=>{(await import('/src/sync/vault.ts')).setVault({id:'other-gesture-vault',key:'other-key',url:'https://gesture-other.invalid',anonKey:'synthetic-anon'})})
  await page.waitForTimeout(1700)
  assert.deepEqual((await rows(page)).filter(r=>r.id==='mark-s'),before.filter(r=>r.id==='mark-s'),'A removal begun in one vault is not written after the vault changes')
  assert.equal(await undo(page).count(),0)
  await page.evaluate(async()=>{(await import('/src/sync/vault.ts')).setVault(null)})
})
test('duplicate activation writes once',[[1440,900,false]],async({page,ids})=>{
  const before=await rows(page);await openActions(page,'mark-s')
  await page.evaluate(async()=>{const {studyDB}=await import('/src/theology/store.ts');window.writes=0;studyDB.annotations.hook('updating',()=>{window.writes++})})
  await page.evaluate(()=>holdStore(600))
  await page.evaluate(()=>{const b=[...document.querySelectorAll('.study-highlight-actions button')].find(b=>b.textContent==='Remove saved highlight');b.click();b.click()})
  await undo(page).waitFor({timeout:4000});assert.equal(await page.evaluate(()=>window.writes),1,'One write')
  assert.equal(await dialog(page).count(),0);onlyChanged(before,await rows(page),['mark-s'],'double click')
})
test('failure after the actions are dismissed',[[390,844,true]],async({page})=>{
  const before=await rows(page);await openActions(page,'mark-s',true)
  await page.evaluate(async()=>{const {studyDB}=await import('/src/theology/store.ts');studyDB.annotations.hook('updating',()=>{throw Error('Synthetic store failure')})})
  await page.evaluate(()=>holdStore(900));await dialogRemove(page).tap();await page.keyboard.press('Escape')
  assert.equal(await dialog(page).count(),0,'Dismissed while pending')
  await page.getByRole('alert').filter({hasText:'Synthetic store failure'}).waitFor({timeout:4000})
  assert.equal(await undo(page).count(),0,'No Undo after a failure');assert.deepEqual(await rows(page),before,'Nothing written')
})

// 18. Intercepted two-device sync through the actual syncStudy: remove from the toolbar on A, pull on B.
async function syncCase(){
  const tables={study_editions:new Map(),study_annotations:new Map(),study_places:new Map()},vault={scope:'synthetic-gesture-vault',key:'synthetic-gesture-key'}
  vault.route=async(route,url)=>{
    const req=route.request(),headers={'access-control-allow-origin':BASE,'access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'}
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers})
    const rows=tables[url.pathname.split('/').pop()];if(!rows)return route.fulfill({json:[],headers})
    if(req.method()==='POST'){const data=req.postDataJSON();for(const row of Array.isArray(data)?data:[data]){const old=rows.get(row.id);rows.set(row.id,!old||row.updated>old.updated||(row.updated===old.updated&&(row.deleted??0)>(old.deleted??0))?structuredClone(row):old)}return route.fulfill({status:201,body:'',headers})}
    return route.fulfill({json:[...rows.values()],headers})
  }
  // The catalog override lives in the page's module, so it is set again after every navigation.
  const sync=page=>page.evaluate(async source=>{const bytes=new TextEncoder().encode(source),{sourceHash}=await import('/src/theology/source.ts');Object.assign((await import('/src/theology/model.ts')).DAILY_DOCTRINE,{sha256:await sourceHash(bytes),bytes:bytes.length});const {syncStudy,studySyncStatus}=await import('/src/theology/sync.ts');await syncStudy();return studySyncStatus()},source)
  const a=await device({width:390,height:844,touch:true,vault}),b=await device({width:390,height:844,touch:true,vault})
  try{
    const ids=await seed(a.page,vault);assert.equal(await sync(a.page),'synced')
    await b.page.goto(BASE+'/tests/redesign-check.html')
    await b.page.evaluate(async({vault,host,source})=>{const {setVault}=await import('/src/sync/vault.ts');setVault({id:vault.scope,key:vault.key,url:'https://'+host,anonKey:'synthetic-anon'});const {sourceHash}=await import('/src/theology/source.ts'),bytes=new TextEncoder().encode(source);Object.assign((await import('/src/theology/model.ts')).DAILY_DOCTRINE,{sha256:await sourceHash(bytes),bytes:bytes.length})},{vault:{scope:vault.scope,key:vault.key},host,source})
    assert.equal(await sync(b.page),'synced')
    await open(a.page,ids.s1);await a.page.evaluate(()=>selectNeedle('target'));await toolbarRemove(a.page).tap();await undo(a.page).waitFor()
    assert.equal(await sync(a.page),'synced');assert.equal(await sync(b.page),'synced')
    await open(b.page,ids.s1)
    assert.equal(await b.page.locator('[data-study-highlight^="mark-t"]').count(),0,'B no longer draws the removed passage')
    for(const id of ['mark-p','mark-s','mark-l'])assert.ok(await b.page.locator(`[data-study-highlight="${id}"]`).count()>0,`B keeps ${id}`)
    report.push({sync:'actual syncStudy, intercepted mirror',twoDevices:true})
  }finally{await a.context.close();await b.context.close()}
}

try{
  for(const c of cases.filter(c=>!process.env.CASE||c.name.includes(process.env.CASE)))for(const [width,height,touch] of c.widths){
    const {context,page,cdp}=await device({width,height,touch})
    try{const ids=await seed(page);await open(page,ids.s1);await c.fn({page,cdp,ids,width,touch});report.push({case:c.name,width,pass:true});console.log('PASS',c.name,width)}
    catch(e){report.push({case:c.name,width,pass:false,error:String(e.message).split('\n')[0]});console.log('FAIL',c.name,width,'—',String(e.message).split('\n')[0]);process.exitCode=1}
    finally{await context.close()}
  }
  if(!process.env.CASE||'two-device sync'.includes(process.env.CASE))try{await syncCase();console.log('PASS two-device sync')}catch(e){console.log('FAIL two-device sync —',String(e.message).slice(0,400));process.exitCode=1}
  if(errors.length){console.log('FAIL page errors:',errors);process.exitCode=1}else console.log('PASS no page errors')
}finally{await browser.close()}
await writeFile(out+'/checks.json',JSON.stringify(report,null,2))
