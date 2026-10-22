import { createElement, useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { saveHighlight, removeHighlight, sectionAnnotations } from '../theology/store'
import { syncStudy } from '../theology/sync'
import type { HighlightColor, StudyAnnotation, StudyEdition } from '../theology/model'
import type { StudyBlock, StudyReading, StudyRun } from '../theology/reading'
import { useLive } from '../lib/useLive'
import { useStudySelection } from '../theology/selection'

export function StudyText({reading,edition,section,position,onLink}:{reading:StudyReading;edition?:StudyEdition;section:string;position?:string;onLink?:(href:string)=>void}){
  const root=useRef<HTMLDivElement>(null),actions=useRef<HTMLDivElement>(null),undoButton=useRef<HTMLButtonElement>(null),[problem,setProblem]=useState(''),[busy,setBusy]=useState(false)
  const [active,setActive]=useState<{id:string;left:number;top:number}|null>(null),[removed,setRemoved]=useState<StudyAnnotation|null>(null)
  const selected=useStudySelection(root,!!edition,`${edition?.scope}:${edition?.id}:${section}`),selection=selected.selection
  const cachedAnnotations=useLive<StudyAnnotation[]>(()=>edition?sectionAnnotations(edition.id,section):Promise.resolve([]),[edition?.id,edition?.scope,section],[]),annotations=cachedAnnotations.filter(a=>a.scope===edition?.scope)
  const marks=annotations.filter(a=>reading.text.slice(a.start,a.end)===a.quote)
  const misplaced=annotations.length-marks.length
  useEffect(()=>{if(removed)undoButton.current?.focus({preventScroll:true})},[removed])
  useEffect(()=>{
    if(!active)return
    actions.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true})
    const dismiss=(event:Event)=>{if(!actions.current?.contains(event.target as Node))setActive(null)}
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setActive(null);root.current?.querySelector<HTMLElement>(`[data-study-highlight="${active.id}"]`)?.focus({preventScroll:true})}}
    document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',escape,true)
    window.addEventListener('resize',dismiss);document.addEventListener('scroll',dismiss,true)
    return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',escape,true);window.removeEventListener('resize',dismiss);document.removeEventListener('scroll',dismiss,true)}
  },[active])
  async function remove(id:string){
    const annotation=marks.find(a=>a.id===id);if(!annotation||busy)return
    setBusy(true);setProblem('')
    try{await removeHighlight(id);setRemoved(annotation);setActive(null);root.current?.focus({preventScroll:true});void syncStudy()}
    catch(e){setProblem(e instanceof Error?e.message:'The highlight could not be removed.')}finally{setBusy(false)}
  }
  async function undo(){
    if(!edition||!removed||busy)return
    setBusy(true);setProblem('')
    // Preserve the deletion tombstone. Undo makes a new annotation through the
    // existing scope-checked store, so stale edits cannot resurrect the old id.
    try{await saveHighlight(edition,section,reading.text,removed.start,removed.end,removed.color);setRemoved(null);root.current?.focus({preventScroll:true});void syncStudy()}
    catch(e){setProblem(e instanceof Error?e.message:'The highlight could not be restored.')}finally{setBusy(false)}
  }
  function showActions(id:string,element:HTMLElement){
    selected.clear();const rect=element.getBoundingClientRect()
    setActive({id,left:Math.max(12,Math.min(innerWidth-232,rect.left)),top:Math.max(12,Math.min(innerHeight-68,rect.top>72?rect.top-60:rect.bottom+10))})
  }
  useEffect(()=>{setProblem('')},[section])
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
    let node:ReactNode=edges.slice(0,-1).map((from,i)=>{const to=edges[i+1],mark=intersects.filter(a=>a.start<=from&&a.end>=to).sort((a,b)=>b.updated-a.updated||b.id.localeCompare(a.id))[0],text=run.text.slice(from-run.from,to-run.from)
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
  return <>
    {edition&&selection?<div ref={selected.toolbar} className="study-selection-toolbar" role="toolbar" aria-label="Highlight" aria-keyshortcuts="Alt+H" aria-busy={busy} style={{left:selection.left,top:selection.top}}>{(['brass','forest','oxblood','navy'] as const).map(color=><button key={color} className={`study-swatch ${color}`} aria-label={`Highlight ${color}`} title={`Highlight ${color}`} disabled={busy} onPointerDown={selected.preserve} onClick={()=>void highlight(color)}><span/></button>)}</div>:null}
    {active&&!selection?<div ref={actions} className="study-selection-toolbar study-highlight-actions" role="dialog" aria-label="Highlight actions" style={{left:active.left,top:active.top}}><button disabled={busy} onClick={()=>void remove(active.id)}>Remove highlight</button><button aria-label="Close highlight actions" onClick={()=>{setActive(null);root.current?.querySelector<HTMLElement>(`[data-study-highlight="${active.id}"]`)?.focus({preventScroll:true})}}><Icon name="close"/></button></div>:null}
    {problem?<p role="alert" className="study-problem">{problem}</p>:null}
    {misplaced?<p role="status" className="study-problem">{misplaced} saved highlights could not be placed on this text. They remain stored.</p>:null}
    <div className="study-source-text" ref={root} tabIndex={-1}>{blocksView()}</div>
    {removed?<div className="study-highlight-undo"><span role="status">Highlight removed.</span><button ref={undoButton} disabled={busy} onClick={()=>void undo()}>Undo</button></div>:null}
    {edition&&marks.length?<details className="study-highlight-list"><summary>Highlights · {marks.length}</summary>{marks.map(a=><div key={a.id}><button onClick={()=>{root.current?.querySelector<HTMLElement>(`[data-study-highlight="${a.id}"]`)?.scrollIntoView({block:'center'})}}>{a.quote.slice(0,100)}{a.quote.length>100?'…':''}</button><button aria-label="Remove highlight" title="Remove highlight" disabled={busy} onClick={()=>void remove(a.id)}><Icon name="close"/></button></div>)}</details>:null}
  </>
}
