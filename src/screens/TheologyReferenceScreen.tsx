import { createElement, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { RouteLink } from '../components/DeskHeader'
import { Icon } from '../components/Icon'
import { useLive } from '../lib/useLive'
import { navigate, to } from '../lib/router'
import { syncPrivateReference, usePrivateReferenceSync } from '../theology/reference-sync'
import { useVault } from '../sync/vault'
import { REFERENCES, REFERENCE_PACKAGE_LIMIT, flattenReference, installPrivateReference, isReferenceKey, privateReference, searchReference, type ReferenceBlock, type ReferenceKey, type ReferencePackage } from '../theology/references'

type View={query:string;resultsTop:number;readingTop:number}
const views=new Map<string,View>();let viewScope:string|undefined
export function TheologyReferenceScreen({document:documentKey,anchor}:{document:string;anchor?:string}){
  const scope=useVault()?.id
  // Forget private query/scroll state when the pairing changes; never put it
  // in URLs, localStorage, a shared index, or the public application bundle.
  if(viewScope!==scope){views.clear();viewScope=scope}
  if(!isReferenceKey(documentKey))return <div className="app theology-app"><main className="study-screen"><RouteLink href={to.theology()}>Back to Theology</RouteLink><p role="alert">Reference not found.</p></main></div>
  return <PrivateReferenceReader key={`${scope}:${documentKey}`} scope={scope} referenceKey={documentKey} anchor={anchor}/>
}
function PrivateReferenceReader({scope,referenceKey,anchor}:{scope?:string;referenceKey:ReferenceKey;anchor?:string}){
  const syncStatus=usePrivateReferenceSync(referenceKey)
  const savedText=syncStatus==='synced'?'Saved':syncStatus==='syncing'?'Saving…':syncStatus==='offline'?'Offline · saved on this device':syncStatus==='unavailable'?'Saved on this device · sync unavailable':syncStatus==='error'?'Saved on this device · sync could not finish':'Saved on this device'
  const cached=useLive(()=>privateReference(referenceKey),[scope,referenceKey],null),doc=cached?.scope===scope?cached?.document:null
  const stateKey=`${scope}:${referenceKey}`,remembered=views.get(stateKey)??{query:'',resultsTop:0,readingTop:0}
  const [query,setQuery]=useState(remembered.query),[limit,setLimit]=useState(40),[problem,setProblem]=useState(''),[busy,setBusy]=useState(false)
  const restoring=useRef(true),lastAnchor=useRef(anchor)
  if(lastAnchor.current!==anchor){restoring.current=true;lastAnchor.current=anchor}
  const main=useRef<HTMLElement>(null),input=useRef<HTMLInputElement>(null),finding=anchor==='find',catalog=REFERENCES[referenceKey]
  const flat=useMemo(()=>doc?flattenReference(doc.blocks):[],[doc]),headings=flat.filter(b=>b.kind==='heading'),hits=useMemo(()=>doc&&finding?searchReference(doc.blocks,query):[],[doc,finding,query])
  const remember=(patch:Partial<View>)=>{views.set(stateKey,{...(views.get(stateKey)??remembered),...patch})}
  useEffect(()=>{
    if(!doc)return
    restoring.current=true
    let settled=0
    const targetTop=finding?views.get(stateKey)?.resultsTop??0:views.get(stateKey)?.readingTop??0
    const frame=requestAnimationFrame(()=>{
      const screen=main.current;if(!screen)return
      if(finding)screen.scrollTop=targetTop
      else if(anchor){const target=document.getElementById('reference-'+anchor);target?.scrollIntoView({block:'start',behavior:'instant'});target?.focus({preventScroll:true})}
      else screen.scrollTop=targetTop
      settled=requestAnimationFrame(()=>{restoring.current=false})
    })
    return()=>{cancelAnimationFrame(frame);cancelAnimationFrame(settled)}
  },[doc?.source.sha256,anchor,stateKey,finding])
  async function importFile(file:File){
    setBusy(true);setProblem('')
    try{if(file.size>REFERENCE_PACKAGE_LIMIT)throw Error('The private package is too large.');const data=JSON.parse(await file.text()) as ReferencePackage;if(data.key!==referenceKey)throw Error('This package belongs to the other reference.');await installPrivateReference(data);await syncPrivateReference(referenceKey,true)}
    catch(error){setProblem(error instanceof Error?error.message:'The private reference could not be imported.')}finally{setBusy(false)}
  }
  function blockView(block:ReferenceBlock):ReactNode{
    const props={key:block.id,id:'reference-'+block.id,'data-reference-block':block.id,tabIndex:-1}
    if(block.kind==='table')return <div {...props} tabIndex={0} className="reference-table scroll" role="region" aria-label="Source table"><table><tbody>{block.rows?.map((row,index)=><tr key={index}>{row.cells.map((cell,column)=>createElement(row.header?'th':'td',{key:column,colSpan:cell.span,...(row.header?{scope:'col'}:{})},cell.blocks.map(blockView)))}</tr>)}</tbody></table></div>
    if(block.kind==='image'){const image=block.asset?doc?.assets[block.asset]:null;return image?<figure {...props}><img src={`data:${image.mime};base64,${image.base64}`} alt="Source illustration"/></figure>:null}
    if(block.role==='source-contents')return <details {...props} className="reference-original-contents"><summary>Source contents</summary><p>{block.text}</p></details>
    if(block.kind==='heading')return createElement(`h${block.level??2}`,props,(block.marker?block.marker+' ':'')+block.text)
    return <p {...props} className={block.role??undefined}>{block.marker?<span className="reference-list-marker">{block.marker} </span>:null}{block.text}</p>
  }
  return <div className="app theology-app"><main className="study-screen scroll reference-screen" ref={main} onScroll={()=>{if(main.current&&!restoring.current)remember(finding?{resultsTop:main.current.scrollTop}:{readingTop:main.current.scrollTop})}}>
    <header className="study-topbar"><RouteLink href={to.theology()} aria-label="Back to Theology" title="Theology"><Icon name="back"/></RouteLink><div><h1 id="desk-heading">{catalog.title}</h1><p className="reference-edition">{catalog.edition}</p></div></header>
    {problem?<p className="study-problem" role="alert">{problem}</p>:null}
    {!scope?<section className="study-empty"><p>Pair this device to open private references.</p><RouteLink className="study-text-link" href={to.settings()}>Device settings</RouteLink></section>:!doc?<section className="study-empty">{syncStatus==='syncing'?<p role="status">Opening private reference…</p>:syncStatus==='unavailable'?<p role="status">Private reference sync is not available yet.</p>:syncStatus==='offline'?<p role="status">This device has no offline copy yet.</p>:syncStatus==='missing'?<p role="status">This reference has not been imported into this vault.</p>:null}<button className="study-primary" disabled={busy} onClick={()=>input.current?.click()}>{busy?'Checking…':'Import private reference'}</button><input ref={input} hidden type="file" accept=".json,application/json" aria-label="Import prepared private reference" onChange={event=>{const file=event.target.files?.[0];if(file)void importFile(file)}}/></section>:<>
      <p className="reference-local-state" role="status">{savedText}</p><div className="reference-tools"><label className="reference-search" htmlFor="reference-search"><Icon name="search"/><span className="reference-label">Search {catalog.title}</span><input id="reference-search" type="search" placeholder="Search this reference" value={query} onChange={event=>{const next=event.target.value;setQuery(next);setLimit(40);remember({query:next,resultsTop:0});if(!finding)navigate(to.reference(referenceKey,'find'))}}/></label>
        {finding?<RouteLink href={to.reference(referenceKey)}>Read reference</RouteLink>:query?<RouteLink href={to.reference(referenceKey,'find')}>Back to results</RouteLink>:null}
      </div>
      {finding?<section className="reference-results" aria-label="Search results"><p role="status">{query.trim()?`${hits.length} matching passages`:'Search this reference'}</p>{hits.slice(0,limit).map(hit=><RouteLink key={hit.block.id} href={to.reference(referenceKey,hit.block.id)} onClick={()=>remember({resultsTop:main.current?.scrollTop??0})}><h2>{hit.heading||catalog.title}</h2><p>{hit.excerptStart?'…':''}{hit.block.text.slice(hit.excerptStart,hit.from)}<mark>{hit.block.text.slice(hit.from,hit.to)}</mark>{hit.block.text.slice(hit.to,hit.excerptEnd)}{hit.excerptEnd<hit.block.text.length?'…':''}</p></RouteLink>)}{hits.length>limit?<button className="study-more" onClick={()=>setLimit(limit+40)}>Show more passages</button>:null}</section>:<>
        <details className="reference-contents"><summary>Contents</summary><nav aria-label="Reference sections">{headings.map(heading=><RouteLink key={heading.id} href={to.reference(referenceKey,heading.id)}>{heading.text}</RouteLink>)}</nav></details>
        <article className="study-paper reference-paper" aria-label={catalog.title}>{doc.blocks.map(blockView)}</article>
      </>}
    </>}
  </main></div>
}
