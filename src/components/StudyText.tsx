import { createElement, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { saveHighlight, removeHighlight, sectionAnnotations } from '../theology/store'
import { syncStudy } from '../theology/sync'
import type { HighlightColor, StudyAnnotation, StudyEdition } from '../theology/model'
import type { StudyBlock, StudyReading, StudyRun } from '../theology/reading'
import { useLive } from '../lib/useLive'
import { useStudySelection } from '../theology/selection'
import { anchorVisible, placePopover, type AnchorRect } from '../theology/placement'
import { drawnFirst, drawnTarget } from '../theology/drawn'
import { createPress } from '../theology/press'

const MISSING='This saved highlight is no longer on this device.'
// A highlight's actions belong to the fragment that was tapped, not to the first
// fragment carrying its id, and to the reading they were opened in.
type Active={id:string;from:number;ctx:string;missing?:boolean}
// The toolbar's Remove is decided once per selection session and only ever kept
// or withdrawn after that, never moved to a different highlight.
type Frozen={session:number;ctx:string;start:number;end:number;id:string|null;invalid:boolean;missing?:boolean}
type Notice={kind:'removed';annotation:StudyAnnotation;ctx:string;focus:boolean}|{kind:'failed';text:string;ctx:string}

export function StudyText({reading,edition,section,position,onLink}:{reading:StudyReading;edition?:StudyEdition;section:string;position?:string;onLink?:(href:string)=>void}){
  const root=useRef<HTMLDivElement>(null),actions=useRef<HTMLDivElement>(null),undoButton=useRef<HTMLButtonElement>(null),[problem,setProblem]=useState(''),[busy,setBusy]=useState(false)
  const [active,setActive]=useState<Active|null>(null),[frozen,setFrozen]=useState<Frozen|null>(null),[notice,setNotice]=useState<Notice|null>(null)
  const selected=useStudySelection(root,!!edition,`${edition?.scope}:${edition?.id}:${section}`),selection=selected.selection
  const ctx=`${edition?.scope}:${edition?.id}:${section}`,ctxRef=useRef(ctx),mounted=useRef(true),inFlight=useRef(false),activeRef=useRef(active),sessionRef=useRef(selection?.session),toolbarRect=useRef<AnchorRect|null>(null)
  const cachedAnnotations=useLive<StudyAnnotation[]>(()=>edition?sectionAnnotations(edition.id,section):Promise.resolve([]),[edition?.id,edition?.scope,section],[]),annotations=cachedAnnotations.filter(a=>a.scope===edition?.scope)
  const marks=annotations.filter(a=>reading.text.slice(a.start,a.end)===a.quote)
  const misplaced=annotations.length-marks.length
  const marksKey=useMemo(()=>marks.map(a=>`${a.id}:${a.updated}`).join(),[marks])
  useLayoutEffect(()=>{ctxRef.current=ctx;activeRef.current=active;sessionRef.current=selection?.session})
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
  useEffect(()=>{setActive(null);setFrozen(null);setNotice(n=>n&&n.ctx===ctx?n:null);setProblem('')},[ctx])
  useEffect(()=>{if(notice?.kind==='removed'&&notice.focus)undoButton.current?.focus({preventScroll:true})},[notice])
  const fragment=(a:Active)=>root.current?.querySelector<HTMLElement>(`[data-study-start="${a.from}"]>mark[data-study-highlight="${CSS.escape(a.id)}"]`)??null

  // The toolbar is placed from the selection's own rectangle and re-placed when
  // its contents change size, except while a finger is on it.
  const toolbarPress=useRef<ReturnType<typeof createPress>|null>(null)
  if(!toolbarPress.current)toolbarPress.current=createPress(()=>{const el=selected.toolbar.current;if(el&&toolbarRect.current)placePopover(el,toolbarRect.current)})
  useEffect(()=>()=>toolbarPress.current?.dispose(),[])
  useLayoutEffect(()=>{
    const el=selected.toolbar.current;if(!selection||!el)return
    toolbarRect.current=selection.rect
    if(!toolbarPress.current?.active())placePopover(el,selection.rect)
  },[selection])
  useEffect(()=>{
    const el=selected.toolbar.current;if(!selection||!el)return
    const watch=new ResizeObserver(()=>{if(toolbarRect.current&&!toolbarPress.current?.active())placePopover(el,toolbarRect.current)});watch.observe(el)
    return()=>watch.disconnect()
  },[selection?.session,!!selection,selected.toolbar])

  // Decide the toolbar's target once per session; afterwards only keep it or
  // withdraw it. Moving the selection's ends is a new choice and decides again.
  useEffect(()=>{
    if(!selection||!edition)return
    setFrozen(f=>{
      if(f&&f.session===selection.session&&f.ctx===ctx){
        if(f.invalid)return f
        if(f.start===selection.start&&f.end===selection.end)return f.id&&drawnTarget(marks,f.start,f.end)!==f.id?{...f,id:null,invalid:true}:f
        return {...f,start:selection.start,end:selection.end,id:drawnTarget(marks,selection.start,selection.end)}
      }
      return {session:selection.session,ctx,start:selection.start,end:selection.end,id:drawnTarget(marks,selection.start,selection.end),invalid:false}
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[selection?.session,selection?.start,selection?.end,ctx,marksKey])

  // An open highlight's actions: placed by the tapped fragment, focused once,
  // closed when the passage is scrolled 24px or more from where it was, scrolled
  // out of sight, or no longer drawn. Layout that moves it without a scroll sets
  // a new starting point. A press on the actions holds all of this until it ends.
  const activeKey=active?`${active.id}:${active.from}:${active.ctx}`:''
  const dialogPress=useRef<ReturnType<typeof createPress>|null>(null),dialogRect=useRef<AnchorRect|null>(null)
  const placeDialog=()=>{const a=activeRef.current,el=actions.current;if(!a||!el)return;const frag=fragment(a);if(frag)dialogRect.current=frag.getBoundingClientRect();if(dialogRect.current)placePopover(el,dialogRect.current)}
  useLayoutEffect(()=>{
    if(!activeKey)return
    placeDialog()
    actions.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[activeKey])
  useEffect(()=>{
    if(!activeKey)return
    let frame=0,baseline=fragment(activeRef.current!)?.getBoundingClientRect().top??0,pendingCheck=false,pendingRebase=false
    const close=()=>setActive(a=>a&&`${a.id}:${a.from}:${a.ctx}`===activeKey?null:a)
    const rebase=()=>{const a=activeRef.current,frag=a&&fragment(a);if(frag)baseline=frag.getBoundingClientRect().top}
    // A frame queued before a press began still defers to that press when it runs.
    const check=()=>{
      frame=0
      if(press.active()){pendingCheck=true;return}
      const a=activeRef.current;if(!a)return
      if(a.missing){placeDialog();return}
      const frag=fragment(a)
      if(!frag||!anchorVisible(frag)||Math.abs(frag.getBoundingClientRect().top-baseline)>=24){close();return}
      placeDialog()
    }
    const press=createPress(()=>{if(pendingRebase){pendingRebase=false;rebase()}if(pendingCheck){pendingCheck=false;check()}else placeDialog()})
    dialogPress.current=press
    const schedule=()=>{if(press.active()){pendingCheck=true;return}if(!frame)frame=requestAnimationFrame(check)}
    const onScroll=(e:Event)=>{
      const a=activeRef.current,frag=a&&fragment(a),t=e.target
      if(t instanceof Document||(t instanceof Element&&!!frag&&t.contains(frag)))schedule()
      else if(!press.active()&&!frame)frame=requestAnimationFrame(()=>{frame=0;if(!press.active())placeDialog()})
    }
    const onLayout=()=>{if(press.active()){pendingRebase=true;return}rebase();placeDialog()}
    const onViewport=()=>{if(!press.active())placeDialog()}
    const outside=(e:PointerEvent)=>{if(press.active()||!(e.target instanceof Node))return;if(!actions.current?.contains(e.target))close()}
    const escape=(e:KeyboardEvent)=>{if(e.key!=='Escape')return;e.preventDefault();e.stopPropagation();const a=activeRef.current;close();if(a)fragment(a)?.focus({preventScroll:true})}
    const watch=new ResizeObserver(onLayout),popover=new ResizeObserver(()=>{if(!press.active())placeDialog()})
    if(root.current){watch.observe(root.current);if(root.current.parentElement)watch.observe(root.current.parentElement)}
    if(actions.current)popover.observe(actions.current)
    const vv=window.visualViewport
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape,true);document.addEventListener('scroll',onScroll,true)
    window.addEventListener('resize',onLayout);vv?.addEventListener('resize',onLayout);vv?.addEventListener('scroll',onViewport)
    return()=>{
      cancelAnimationFrame(frame);press.dispose();if(dialogPress.current===press)dialogPress.current=null;watch.disconnect();popover.disconnect()
      document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape,true);document.removeEventListener('scroll',onScroll,true)
      window.removeEventListener('resize',onLayout);vv?.removeEventListener('resize',onLayout);vv?.removeEventListener('scroll',onViewport)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[activeKey])
  // A rerender that no longer draws the tapped fragment closes its actions,
  // unless they are saying the highlight has gone or a removal is under way.
  useLayoutEffect(()=>{const a=activeRef.current;if(a&&!a.missing&&!inFlight.current&&!fragment(a))setActive(null)})

  // Remove is an ordinary click on a button, so a keyboard or assistive click
  // works and nothing else does. The write it starts is not undone by closing
  // anything; what follows is only shown in the reading it began in.
  async function remove(id:string,origin:'dialog'|'toolbar'|'list',session?:number){
    if(inFlight.current)return
    const at=ctx,missing=()=>{
      if(origin==='dialog')setActive(a=>a&&a.id===id&&a.ctx===at?{...a,missing:true}:a)
      else if(origin==='toolbar')setFrozen(f=>f&&f.session===session?{...f,id:null,invalid:true,missing:true}:f)
      else setNotice({kind:'failed',text:MISSING,ctx:at})
    }
    const annotation=marks.find(a=>a.id===id);if(!annotation){missing();return}
    inFlight.current=true;setBusy(true);setProblem('')
    try{
      const deleted=await removeHighlight(id)
      if(!mounted.current||ctxRef.current!==at)return
      if(!deleted.length){missing();return}
      const focus=document.activeElement,own=!focus||focus===document.body||!!actions.current?.contains(focus)||!!selected.toolbar.current?.contains(focus)||!!root.current?.parentElement?.querySelector('.study-highlight-list')?.contains(focus)
      setNotice({kind:'removed',annotation:deleted.find(a=>a.id===id)??annotation,ctx:at,focus:own})
      if(origin==='dialog')setActive(a=>a&&a.id===id&&a.ctx===at?null:a)
      if(origin==='toolbar'&&sessionRef.current===session)selected.clear(true)
      void syncStudy()
    }catch(e){
      if(mounted.current&&ctxRef.current===at)setNotice({kind:'failed',text:e instanceof Error?e.message:'The highlight could not be removed.',ctx:at})
    }finally{inFlight.current=false;if(mounted.current)setBusy(false)}
  }
  function removeFromToolbar(){
    const f=frozen;if(!f||!selection||f.session!==selection.session||f.ctx!==ctx||f.invalid||!f.id)return
    if(drawnTarget(marks,f.start,f.end)!==f.id){setFrozen({...f,id:null,invalid:true,missing:true});return}
    void remove(f.id,'toolbar',f.session)
  }
  async function undo(){
    if(!edition||notice?.kind!=='removed'||notice.ctx!==ctx||busy)return
    const a=notice.annotation
    setBusy(true);setProblem('')
    // Preserve the deletion tombstone. Undo makes a new annotation through the
    // existing scope-checked store, so stale edits cannot resurrect the old id.
    try{if(reading.text.slice(a.start,a.end)!==a.quote)throw Error('The highlight could not be restored.');await saveHighlight(edition,section,reading.text,a.start,a.end,a.color);if(ctxRef.current===ctx){setNotice(null);root.current?.focus({preventScroll:true})};void syncStudy()}
    catch(e){setProblem(e instanceof Error?e.message:'The highlight could not be restored.')}finally{if(mounted.current)setBusy(false)}
  }
  function showActions(id:string,element:HTMLElement){
    const from=Number(element.parentElement?.dataset.studyStart);if(!Number.isFinite(from))return
    selected.clear();setActive({id,from,ctx})
  }
  useEffect(()=>{
    if(!root.current||!position)return
    const value=parseInt(position.slice(1),36),byte=position.startsWith('b')
    const blocks=[...root.current.querySelectorAll<HTMLElement>('[data-study-block]')]
    const target=byte?blocks.find(e=>Number(e.dataset.sourceByte)>=value)??blocks[blocks.length-1]:blocks.find(e=>Number(e.dataset.studyEnd)>=value)
    target?.scrollIntoView({block:'center',behavior:'instant'})
    target?.classList.add('study-arrival');const timer=setTimeout(()=>target?.classList.remove('study-arrival'),1800)
    return()=>clearTimeout(timer)
  },[section,position,reading])
  async function highlight(color:HighlightColor){
    if(!edition||!selection)return
    setBusy(true);setProblem('')
    try{await saveHighlight(edition,section,reading.text,selection.start,selection.end,color);selected.clear(true);void syncStudy()}
    catch(e){setProblem(e instanceof Error?e.message:'The highlight could not be saved.')}finally{setBusy(false)}
  }
  function runView(run:StudyRun):ReactNode{
    const intersects=marks.filter(a=>a.start<run.to&&a.end>run.from),edges=[...new Set([run.from,run.to,...intersects.flatMap(a=>[Math.max(run.from,a.start),Math.min(run.to,a.end)])])].sort((a,b)=>a-b)
    let node:ReactNode=edges.slice(0,-1).map((from,i)=>{const to=edges[i+1],mark=intersects.filter(a=>a.start<=from&&a.end>=to).sort(drawnFirst)[0],text=run.text.slice(from-run.from,to-run.from)
      return <span key={from} data-study-start={from} data-study-end={to}>{mark?<mark className={`md-hl md-hl-${mark.color}`} data-study-highlight={mark.id} role={run.href?undefined:'button'} tabIndex={run.href?undefined:0} aria-label={run.href?undefined:`Highlight: ${text}`} aria-haspopup={run.href?undefined:'dialog'} onClick={event=>{if(!run.href&&window.getSelection()?.isCollapsed){event.stopPropagation();showActions(mark.id,event.currentTarget)}}} onKeyDown={event=>{if(!run.href&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.stopPropagation();showActions(mark.id,event.currentTarget)}}}>{text}</mark>:text}</span>
    })
    for(const style of [...run.styles].reverse())node=createElement(style==='strong'?'strong':style==='em'?'em':style==='code'?'code':'sup',{key:style},node)
    if(run.href)node=<a href={run.href} onClick={e=>{if(onLink&&run.href?.startsWith('#')){e.preventDefault();onLink(run.href)}}} target={run.href.startsWith('http')?'_blank':undefined} rel="noopener noreferrer">{node}</a>
    return <span key={run.from}>{node}</span>
  }
  const blockProps=(b:StudyBlock,i:number)=>({key:i,'data-study-block':i,'data-study-end':b.to,'data-source-byte':b.sourceByte,className:b.kind==='quote'?'study-quotation':b.kind==='list'?'study-list-line':b.kind==='heading'&&/^DAY\s+\d+$/i.test(b.runs.map(r=>r.text).join(''))?'study-day-number':b.kind==='heading'&&b.level===5?'study-reading-title':undefined})
  function blocksView(){
    const views:ReactNode[]=[]
    for(let i=0;i<reading.blocks.length;i++){
      const b=reading.blocks[i],props=blockProps(b,i),nodes=b.runs.map(runView)
      if(b.kind==='table-row'){
        const first=i,rows:ReactNode[]=[],heads:ReactNode[]=[]
        while(i<reading.blocks.length&&reading.blocks[i].kind==='table-row'){
          const row=reading.blocks[i],view=<tr {...blockProps(row,i)}>{row.cells?.map((cell,c)=>createElement(row.head?'th':'td',{key:c,...(row.head?{scope:'col'}:{'data-label':row.columns?.[c]})},cell.map(runView)))}</tr>
          ;(row.head?heads:rows).push(view);i++
        }
        i--;views.push(<div className="study-source-table" key={'table-'+first}><table>{heads.length?<thead>{heads}</thead>:null}<tbody>{rows}</tbody></table></div>);continue
      }
      if(b.kind==='rule'){views.push(<hr key={i}/>);continue}
      if(b.kind==='heading'){views.push(createElement(`h${Math.max(2,Math.min(6,b.level??2))}`,props,nodes));continue}
      if(b.kind==='code'){views.push(<pre {...props}>{nodes}</pre>);continue}
      if(b.kind==='list'){views.push(<div {...props}><span className="study-list-marker" aria-hidden="true">{b.marker}</span><p>{nodes}</p></div>);continue}
      views.push(createElement(b.kind==='quote'?'blockquote':'p',props,nodes))
    }
    return views
  }
  const toolbarTarget=frozen&&selection&&frozen.session===selection.session&&frozen.ctx===ctx?frozen:null
  const shownNotice=notice&&notice.ctx===ctx?notice:null
  return <>
    {edition&&selection?<div ref={selected.toolbar} className="study-selection-toolbar" role="toolbar" aria-label="Highlight" aria-keyshortcuts="Alt+H" aria-busy={busy} onPointerDown={e=>toolbarPress.current?.start(e)}>{(['brass','forest','oxblood','navy'] as const).map(color=><button key={color} className={`study-swatch ${color}`} aria-label={`Highlight ${color}`} title={`Highlight ${color}`} disabled={busy} onPointerDown={selected.preserve} onClick={()=>void highlight(color)}><span/></button>)}{toolbarTarget?.id&&!toolbarTarget.invalid?<button className="study-swatch study-remove" aria-label="Remove saved highlight" title="Remove saved highlight" data-target-id={toolbarTarget.id} disabled={busy} onPointerDown={selected.preserve} onClick={removeFromToolbar}><Icon name="trash"/></button>:null}{toolbarTarget?.missing?<p className="study-popover-note" role="status">{MISSING}</p>:null}</div>:null}
    {active&&active.ctx===ctx&&!selection?<div ref={actions} className="study-selection-toolbar study-highlight-actions" role="dialog" aria-label="Highlight actions" onPointerDown={e=>dialogPress.current?.start(e)}>{active.missing?<p className="study-popover-note" role="status">{MISSING}</p>:<button disabled={busy} onClick={()=>void remove(active.id,'dialog')}>Remove saved highlight</button>}<button aria-label="Close highlight actions" onClick={()=>{const a=active;setActive(null);fragment(a)?.focus({preventScroll:true})}}><Icon name="close"/></button></div>:null}
    {problem?<p role="alert" className="study-problem">{problem}</p>:null}
    {misplaced?<p role="status" className="study-problem">{misplaced} saved highlights could not be placed on this text. They remain stored.</p>:null}
    <div className="study-source-text" ref={root} tabIndex={-1}>{blocksView()}</div>
    {shownNotice?.kind==='removed'?<div className="study-highlight-undo"><span role="status">Highlight removed.</span><button ref={undoButton} disabled={busy} onClick={()=>void undo()}>Undo</button></div>:shownNotice?.kind==='failed'?<div className="study-highlight-undo"><span role="alert">{shownNotice.text}</span><button aria-label="Dismiss" onClick={()=>setNotice(null)}><Icon name="close"/></button></div>:null}
    {edition&&marks.length?<details className="study-highlight-list"><summary>Highlights · {marks.length}</summary>{marks.map(a=><div key={a.id}><button onClick={()=>{root.current?.querySelector<HTMLElement>(`[data-study-highlight="${CSS.escape(a.id)}"]`)?.scrollIntoView({block:'center'})}}>{a.quote.slice(0,100)}{a.quote.length>100?'…':''}</button><button aria-label="Remove saved highlight" title="Remove saved highlight" disabled={busy} onClick={()=>void remove(a.id,'list')}><Icon name="close"/></button></div>)}</details>:null}
  </>
}
