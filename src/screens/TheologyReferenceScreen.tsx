import { createElement, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { RouteLink } from '../components/DeskHeader'
import { Icon } from '../components/Icon'
import { useLive } from '../lib/useLive'
import { navigate, to } from '../lib/router'
import { syncPrivateReference, usePrivateReferenceSync } from '../theology/reference-sync'
import { useVault } from '../sync/vault'
import { REFERENCES, REFERENCE_PACKAGE_LIMIT, installPrivateReference, isReferenceKey, privateReference, searchReference, type ReferenceBlock, type ReferenceKey, type ReferencePackage } from '../theology/references'
import { referenceNavigation } from '../theology/reference-navigation'

type View={query:string;limit:number;tops:Record<string,number>}
// Private queries and return positions stay in session memory and clear on pairing changes.
const views=new Map<string,View>();let viewScope:string|undefined
export function TheologyReferenceScreen({document:documentKey,anchor}:{document:string;anchor?:string}){
  const scope=useVault()?.id
  if(viewScope!==scope){views.clear();viewScope=scope}
  if(!isReferenceKey(documentKey))return <div className="app theology-app"><main className="study-screen"><RouteLink href={to.theology()}>Back to Theology</RouteLink><p role="alert">Reference not found.</p></main></div>
  return <PrivateReferenceReader key={`${scope}:${documentKey}`} scope={scope} referenceKey={documentKey} anchor={anchor}/>
}
function PrivateReferenceReader({scope,referenceKey,anchor}:{scope?:string;referenceKey:ReferenceKey;anchor?:string}){
  const syncStatus=usePrivateReferenceSync(referenceKey)
  const savedText=syncStatus==='synced'?'Saved':syncStatus==='syncing'?'Saving…':syncStatus==='offline'?'Offline · saved on this device':syncStatus==='unavailable'?'Saved on this device · sync unavailable':syncStatus==='error'?'Saved on this device · sync could not finish':'Saved on this device'
  const cached=useLive(()=>privateReference(referenceKey),[scope,referenceKey],null),doc=cached&&cached.scope===scope?cached.document:null
  const stateKey=`${scope}:${referenceKey}`,remembered=views.get(stateKey)??{query:'',limit:40,tops:{}}
  const [query,setQuery]=useState(remembered.query),[limit,setLimit]=useState(remembered.limit),[problem,setProblem]=useState(''),[busy,setBusy]=useState(false)
  const restoring=useRef(true),lastAnchor=useRef(anchor),main=useRef<HTMLElement>(null),input=useRef<HTMLInputElement>(null)
  if(lastAnchor.current!==anchor){restoring.current=true;lastAnchor.current=anchor}
  const finding=anchor==='find',catalog=REFERENCES[referenceKey],model=useMemo(()=>doc?referenceNavigation(referenceKey,doc.blocks):null,[doc,referenceKey])
  const group=model?.groups.find(g=>g.id===anchor),section=anchor?model?.owner.get(anchor):undefined,viewKey=anchor??'overview'
  const parent=model?.groups.find(g=>g.id===(group?.parent??section?.group)),grandparent=model?.groups.find(g=>g.id===parent?.parent)
  const children=model?.groups.filter(g=>g.parent===group?.id)??[],shown=model?.sections.filter(s=>s.group===(group?.id??undefined))??[]
  const hits=useMemo(()=>doc&&finding?searchReference(doc.blocks,query):[],[doc,finding,query])
  const remember=(patch:Partial<View>)=>views.set(stateKey,{...(views.get(stateKey)??remembered),...patch})
  const saveTop=()=>{if(main.current&&!restoring.current)remember({tops:{...(views.get(stateKey)?.tops??{}),[viewKey]:main.current.scrollTop}})}
  useEffect(()=>{
    if(!doc)return
    restoring.current=true
    let settled=0
    const frame=requestAnimationFrame(()=>{
      const screen=main.current;if(!screen)return
      const top=views.get(stateKey)?.tops[viewKey]
      const target=section?document.getElementById('reference-'+anchor):null
      if(top!==undefined)screen.scrollTop=top
      else if(target&&anchor!==section?.id)target.scrollIntoView({block:'start',behavior:'instant'})
      else screen.scrollTop=0
      if(target)target.focus({preventScroll:true})
      else if(!finding)screen.querySelector<HTMLElement>('#reference-view-heading')?.focus({preventScroll:true})
      settled=requestAnimationFrame(()=>{restoring.current=false})
    })
    return()=>{cancelAnimationFrame(frame);cancelAnimationFrame(settled)}
  },[doc?.source.sha256,anchor,stateKey])
  async function importFile(file:File){
    setBusy(true);setProblem('')
    try{if(file.size>REFERENCE_PACKAGE_LIMIT)throw Error('The private package is too large.');const data=JSON.parse(await file.text()) as ReferencePackage;if(data.key!==referenceKey)throw Error('This package belongs to the other reference.');await installPrivateReference(data);await syncPrivateReference(referenceKey,true)}
    catch(error){setProblem(error instanceof Error?error.message:'The private reference could not be imported.')}finally{setBusy(false)}
  }
  function blockView(block:ReferenceBlock):ReactNode{
    const props={key:block.id,id:'reference-'+block.id,'data-reference-block':block.id,'data-reference-start':block.id===section?.id||undefined,tabIndex:-1}
    if(block.kind==='table')return <div {...props} tabIndex={0} className="reference-table scroll" role="region" aria-label="Source table"><table><tbody>{block.rows?.map((row,index)=><tr key={index}>{row.cells.map((cell,column)=>createElement(row.header?'th':'td',{key:column,colSpan:cell.span,...(row.header?{scope:'col'}:{})},cell.blocks.map(blockView)))}</tr>)}</tbody></table></div>
    if(block.kind==='image'){const image=block.asset?doc?.assets[block.asset]:null;return image?<figure {...props}><img src={`data:${image.mime};base64,${image.base64}`} alt="Source illustration"/></figure>:null}
    if(block.role==='source-contents')return <details {...props} className="reference-original-contents"><summary>Source contents</summary><p>{block.text}</p></details>
    if(block.id===section?.titleBlock)return <h2 {...props} className="reference-reading-title">{(block.marker?block.marker+' ':'')+block.text}</h2>
    if(block.role==='source-header'||block.role==='source-footer')return <p {...props} className={block.role}>{(block.marker?block.marker+' ':'')+block.text}</p>
    if(block.kind==='heading')return createElement(`h${block.level??2}`,props,(block.marker?block.marker+' ':'')+block.text)
    return <p {...props} className={block.role??undefined}>{block.marker?<span className="reference-list-marker">{block.marker} </span>:null}{block.text}</p>
  }
  const index=section?model!.sections.indexOf(section):-1
  const card=(s:NonNullable<typeof section>)=><RouteLink key={s.id} href={to.reference(referenceKey,s.id)} className="reference-section-card" onClick={saveTop}>{s.code?<span className="reference-card-code">{s.code}</span>:referenceKey==='bfm'&&/^article-/.test(s.id)?<span className="reference-card-code">Article {s.id.slice(8).toUpperCase()}</span>:null}<h3>{referenceKey==='bfm'?s.title.replace(/^[IVXLCDM]+\.\s*/, ''):s.title}</h3></RouteLink>
  const groupCard=(g:NonNullable<typeof group>)=>{
    const entries=model!.sections.filter(s=>s.group===g.id||model!.groups.find(c=>c.id===s.group)?.parent===g.id)
    return <RouteLink key={g.id} href={to.reference(referenceKey,entries.length===1?entries[0].id:g.id)} className="reference-section-card reference-part-card" onClick={saveTop}><h3>{g.title}</h3><span className="reference-card-count">{entries.length} {entries.length===1?'section':'sections'}</span></RouteLink>
  }
  return <div className={`app theology-app reference-app reference-${referenceKey}`}><main className="study-screen scroll reference-screen" ref={main} onScroll={saveTop}>
    <header className={`study-topbar reference-topbar${section?' reference-topbar-compact':''}`}><RouteLink href={to.theology()} aria-label="Back to Theology" title="Theology"><Icon name="back"/></RouteLink><div><h1 id="desk-heading">{catalog.title}</h1>{!section?<p className="reference-edition">{catalog.edition}</p>:null}</div></header>
    {problem?<p className="study-problem" role="alert">{problem}</p>:null}
    {!scope?<section className="study-empty"><p>Pair this device to open private references.</p><RouteLink className="study-text-link" href={to.settings()}>Device settings</RouteLink></section>:!doc?<section className="study-empty">{syncStatus==='syncing'?<p role="status">Opening private reference…</p>:syncStatus==='unavailable'?<p role="status">Private reference sync is not available yet.</p>:syncStatus==='offline'?<p role="status">This device has no offline copy yet.</p>:syncStatus==='missing'?<p role="status">This reference has not been imported into this vault.</p>:null}<button className="study-primary" disabled={busy} onClick={()=>input.current?.click()}>{busy?'Checking…':'Import private reference'}</button><input ref={input} hidden type="file" accept=".json,application/json" aria-label="Import prepared private reference" onChange={event=>{const file=event.target.files?.[0];if(file)void importFile(file)}}/></section>:<>
      <div className="reference-tools"><label className="reference-search" htmlFor="reference-search"><Icon name="search"/><span className="reference-label">Search {catalog.title}</span><input id="reference-search" type="search" placeholder="Search this reference" value={query} onChange={event=>{const next=event.target.value;saveTop();setQuery(next);setLimit(40);remember({query:next,limit:40,tops:{...(views.get(stateKey)?.tops??{}),find:0}});if(!finding)navigate(to.reference(referenceKey,'find'));else if(main.current)main.current.scrollTop=0}}/></label>
        {finding?<RouteLink href={to.reference(referenceKey)}>Contents</RouteLink>:query?<RouteLink href={to.reference(referenceKey,'find')} onClick={saveTop}>Back to results</RouteLink>:null}
      </div>
      {(anchor&&!finding)?<nav className="reference-breadcrumb" aria-label="Reference location"><RouteLink href={to.reference(referenceKey)} onClick={saveTop}>Contents</RouteLink>{grandparent?<><span className="reference-breadcrumb-separator" aria-hidden="true">/</span><RouteLink href={to.reference(referenceKey,grandparent.id)} onClick={saveTop}>{grandparent.title}</RouteLink></>:null}{parent?<><span className="reference-breadcrumb-separator" aria-hidden="true">/</span><RouteLink href={to.reference(referenceKey,parent.id)} onClick={saveTop}>{parent.title}</RouteLink></>:null}<span className="reference-breadcrumb-separator" aria-hidden="true">/</span><span aria-current="page">{group?.title??section?.code??section?.title}</span></nav>:null}
      {finding?<section className="reference-results" aria-label="Search results"><p role="status">{query.trim()?`${hits.length} matching passages`:'Search this reference'}</p>{hits.slice(0,limit).map(hit=><RouteLink key={hit.block.id} href={to.reference(referenceKey,hit.block.id)} onClick={saveTop}><h2>{model?.owner.get(hit.block.id)?.code?<span className="reference-result-code">{model.owner.get(hit.block.id)!.code} · </span>:null}{model?.owner.get(hit.block.id)?.title??hit.heading??catalog.title}</h2><p>{hit.excerptStart?'…':''}{hit.block.text.slice(hit.excerptStart,hit.from)}<mark>{hit.block.text.slice(hit.from,hit.to)}</mark>{hit.block.text.slice(hit.to,hit.excerptEnd)}{hit.excerptEnd<hit.block.text.length?'…':''}</p></RouteLink>)}{hits.length>limit?<button className="study-more" onClick={()=>{setLimit(limit+40);remember({limit:limit+40})}}>Show more passages</button>:null}</section>:section?<>
        <article className="study-paper reference-paper" aria-label={section.title}>{section.code?<div className="reference-reading-code">{section.code}</div>:null}{!section.titleBlock&&section.blocks[0].kind!=='heading'?<h2 className="reference-reading-title">{section.title}</h2>:null}{section.blocks.map(blockView)}</article>
        <nav className="reference-pager" aria-label="Reading sections">{index>0?<RouteLink href={to.reference(referenceKey,model!.sections[index-1].id)} onClick={saveTop}><span>Previous</span>{model!.sections[index-1].title}</RouteLink>:<span/>}{index<model!.sections.length-1?<RouteLink href={to.reference(referenceKey,model!.sections[index+1].id)} onClick={saveTop}><span>Next</span>{model!.sections[index+1].title}</RouteLink>:null}</nav>
        <p className="reference-edition reference-reading-edition">{catalog.edition}</p>
      </>:<section className="reference-overview" aria-labelledby="reference-view-heading"><h2 id="reference-view-heading" tabIndex={-1}>{group?.title??(referenceKey==='bfm'?'Articles':'The manual')}</h2><nav className="reference-card-grid" aria-label="Reference sections">{model?.groups.length?(group?children.map(groupCard):model.groups.filter(g=>!g.parent).map(groupCard)):null}{shown.map(card)}</nav></section>}
      <p className="reference-local-state" role="status">{savedText}</p>
    </>}
  </main></div>
}
