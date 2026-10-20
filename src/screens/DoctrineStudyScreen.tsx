import { useEffect, useMemo, useRef, useState } from 'react'
import { RouteLink } from '../components/DeskHeader'
import { Icon } from '../components/Icon'
import { StudyText } from '../components/StudyText'
import { useLive } from '../lib/useLive'
import { navigate, to } from '../lib/router'
import { activeEdition, exportStudyMarks, importDailyDoctrine, rememberPlace, studyDB } from '../theology/store'
import { readingFor, searchStudy } from '../theology/reading'
import { syncStudy, useStudySync } from '../theology/sync'
import { useVault } from '../sync/vault'
import type { StudyAnnotation, StudySection } from '../theology/model'

function download(bytes:BlobPart,name:string,type:string){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export function DoctrineStudyScreen({section:sectionId,position}:{section?:string;position?:string}){
  const scope=useVault()?.id??'local-device',cachedEdition=useLive(activeEdition,[scope],null),edition=cachedEdition?.scope===scope?cachedEdition:null
  const [tab,setTab]=useState<'topics'|'search'|'highlights'>(()=>sessionStorage.getItem('study-tab') as 'topics'|'search'|'highlights'||'topics'),[query,setQuery]=useState(()=>sessionStorage.getItem('study-query')??''),[limit,setLimit]=useState(40),[problem,setProblem]=useState(''),[importing,setImporting]=useState(false),[menu,setMenu]=useState(false),input=useRef<HTMLInputElement>(null),status=useStudySync()
  const [collection,setCollection]=useState<string|null>(null)
  const topics=useMemo(()=>[...new Set(edition?.sections.filter(s=>s.reading&&s.topic).map(s=>s.topic!)??[])],[edition])
  const topicSections=edition?.sections.filter(s=>!topics.length||collection==='all'||collection==='aid'&&s.role==='aid'||collection==='reference'&&s.role==='reference'||collection==='front'&&s.role==='front'&&!s.topic&&!s.week||collection?.startsWith('topic:')&&s.topic===collection.slice(6)&&s.reading)??[]
  const cachedAnnotations=useLive<StudyAnnotation[]>(()=>edition?studyDB.annotations.where('[scope+edition]').equals([scope,edition.id]).toArray().then(a=>a.filter(x=>!x.deleted)):Promise.resolve([]),[edition?.id,scope],[]),annotations=cachedAnnotations.filter(a=>a.scope===scope)
  const cachedPlace=useLive(()=>edition?studyDB.places.get([scope,edition.id]):Promise.resolve(undefined),[edition?.id,scope],undefined),place=cachedPlace?.scope===scope?cachedPlace:undefined
  const section=edition?.sections.find(s=>s.id===sectionId),reading=useMemo(()=>edition&&section?readingFor(edition,section.id):null,[edition?.id,edition?.scope,section?.id])
  useEffect(()=>{
    if(!edition||!section)return
    const screen=document.querySelector<HTMLElement>('.study-screen')
    let timer:ReturnType<typeof setTimeout>|undefined
    const save=()=>{
      const top=screen?.getBoundingClientRect().top??0
      const blocks=[...document.querySelectorAll<HTMLElement>('.study-source-text [data-study-block]')]
      const first=blocks.find(b=>b.getBoundingClientRect().bottom>top+50)
      const offset=Number(first?.querySelector<HTMLElement>('[data-study-start]')?.dataset.studyStart??0)
      void rememberPlace(edition.id,section.id,offset)
    }
    const moved=()=>{clearTimeout(timer);timer=setTimeout(save,500)}
    save();screen?.addEventListener('scroll',moved,{passive:true})
    return()=>{clearTimeout(timer);screen?.removeEventListener('scroll',moved)}
  },[edition?.id,section?.id])
  const hits=useMemo(()=>edition&&tab==='search'?searchStudy(edition,query):[],[edition,tab,query])
  const changeTab=(next:typeof tab)=>{setTab(next);sessionStorage.setItem('study-tab',next);if(sectionId)navigate(to.study())}
  const open=(s:StudySection,at?:string)=>{void rememberPlace(edition!.id,s.id,at?.startsWith('t')?parseInt(at.slice(1),36):0);navigate(to.study(s.id,at))}
  async function importFile(file:File){setImporting(true);setProblem('');try{await importDailyDoctrine(file);void syncStudy()}catch(e){setProblem(e instanceof Error?e.message:'The book could not be stored.')}finally{setImporting(false)}}
  const statusText=status==='synced'?'Saved':status==='syncing'?'Saving…':status==='device'?'Saved on this device':status==='offline'?'Offline · saved on this device':status==='unavailable'?'Saved on this device · sync unavailable':'Saved on this device · sync unavailable'
  const onLink=(href:string)=>{
    if(!edition)return
    let name=href.slice(1);try{name=decodeURIComponent(name)}catch{/* Preserve malformed source targets without throwing. */}
    const anchor=edition.anchors[name]
    if(!anchor){setProblem('This source link has no matching location in this edition. The original link is preserved.');return}
    const target=edition.sections.find(s=>s.id===anchor.section);if(target)open(target,'b'+anchor.offset.toString(36))
  }
  return <div className="app theology-app"><main className={`study-screen scroll${section?' is-reading':''}`}>
    <header className="study-topbar"><RouteLink href={to.theology()} title="Theology" aria-label="Back to Theology"><Icon name="back"/></RouteLink><div><h1 id="desk-heading">Daily Doctrine</h1></div>{edition?<button className="study-menu-button" aria-label="Study actions" title="Study actions" aria-expanded={menu} onClick={()=>setMenu(!menu)}><Icon name="more"/></button>:null}</header>
    {menu&&edition?<div className="study-actions" role="group" aria-label="Study actions"><button onClick={()=>{download(edition.source.slice().buffer,edition.filename,'text/markdown');setMenu(false)}}>Save original Markdown</button><button onClick={()=>void exportStudyMarks(edition.id).then(text=>{download(text,'daily-doctrine-highlights.json','application/json');setMenu(false)})}>Back up highlights & place</button></div>:null}
    {problem?<p className="study-problem" role="alert">{problem}</p>:null}
    {!edition?<section className="study-empty"><button className="study-primary" onClick={()=>input.current?.click()} disabled={importing}>{importing?'Checking…':'Import Markdown'}</button><input ref={input} type="file" accept=".md,.markdown,text/markdown,text/plain" aria-label="Import supplied Daily Doctrine Markdown" onChange={e=>{const file=e.target.files?.[0];if(file)void importFile(file)}} hidden/></section>:<>
      <div className="study-workspace">
        <aside className="study-navigation"><nav className="study-tabs" aria-label="Study navigation">{([['topics','list','Topics'],['search','search','Search the complete book'],['highlights','edit','Saved highlights']] as const).map(([key,icon,label])=><button key={key} title={label} aria-label={label} aria-pressed={tab===key} onClick={()=>changeTab(key)}><Icon name={icon}/></button>)}</nav>
          {tab==='search'?<div className="study-find"><label htmlFor="study-search">Search</label><input id="study-search" type="search" value={query} onChange={e=>{setQuery(e.target.value);sessionStorage.setItem('study-query',e.target.value);setLimit(40)}} />{query.trim()?<p role="status">{hits.length} matching passages</p>:null}</div>:null}
          {place&&!section?<RouteLink className="study-continue" href={to.study(place.section,'t'+place.offset.toString(36))}><strong>{edition.sections.find(s=>s.id===place.section)?.title??'Open reading'}</strong></RouteLink>:null}
          {status!=='device'&&status!=='synced'?<p className="study-save-state" role="status">{statusText}</p>:null}
        </aside>
        {section&&reading?<div className="study-reading-wrap"><div className="study-breadcrumb"><span>{section.week?`Week ${section.week} · `:''}{section.title}</span></div><article className="study-paper">{section.role==='aid'?<p className="study-source-boundary">Conversion aid</p>:null}<StudyText reading={reading} edition={edition} section={section.id} position={position} onLink={onLink}/></article><nav className="study-reading-pagination" aria-label="Source order">{(()=>{const i=edition.sections.findIndex(s=>s.id===section.id),previous=edition.sections[i-1],next=edition.sections[i+1];return <>{previous?<RouteLink href={to.study(previous.id)} aria-label={`Previous: ${previous.title}`}><span>{previous.title}</span></RouteLink>:<span/>}{next?<RouteLink href={to.study(next.id)}><span>{next.title}</span></RouteLink>:null}</>})()}</nav></div>:<div className="study-exploration">
          {tab==='topics'?<>{topics.length&&!collection?<><div className="study-collection-grid">{topics.map((topic,i)=><button key={topic} className="study-collection" onClick={()=>setCollection('topic:'+topic)}><span className="study-topic-number">{String(i+1).padStart(2,'0')}</span><h3>{topic}</h3><footer><span>{edition.sections.filter(s=>s.reading&&s.topic===topic).length} readings</span></footer></button>)}</div><nav className="study-source-collections" aria-label="Source collections">{([['front','Opening material'],['reference','Notes & indexes'],['aid','Conversion guide'],['all','All sections']] as const).map(([key,label])=><button key={key} onClick={()=>setCollection(key)}>{label}</button>)}</nav></>:<>{topics.length?<button className="study-collection-back" onClick={()=>setCollection(null)}><Icon name="back"/>All topics</button>:null}<div className="study-topic-grid">{topicSections.map(s=><RouteLink key={s.id} href={to.study(s.id)} className={`study-topic ${s.role}`}>{s.reading?<span className="study-topic-number">{String(s.reading).padStart(2,'0')}</span>:null}<div>{s.role==='aid'||s.week?<span className="study-eyebrow">{s.role==='aid'?'Conversion aid':`Week ${s.week}`}</span>:null}<h3>{s.title}</h3></div></RouteLink>)}</div></>}</>:null}
          {tab==='search'?<div className="study-results">{hits.slice(0,limit).map((h,i)=><RouteLink key={h.section+':'+i} href={to.study(h.section,'t'+h.from.toString(36))}>{h.role==='aid'?<span className="study-eyebrow">Conversion aid</span>:null}<h3>{h.title}</h3><p>{h.excerpt}</p></RouteLink>)}{query.trim()&&!hits.length?<p className="study-no-results">No matching passages.</p>:null}{hits.length>limit?<button className="study-more" onClick={()=>setLimit(limit+40)}>Show more passages</button>:null}</div>:null}
          {tab==='highlights'?<div className="study-results">{annotations.map(a=><RouteLink key={a.id} href={to.study(a.section,'t'+a.start.toString(36))}><span className="study-eyebrow">{edition.sections.find(s=>s.id===a.section)?.title}</span><p><mark className={`md-hl md-hl-${a.color}`}>{a.quote}</mark></p></RouteLink>)}{!annotations.length?<p className="study-no-results">No highlights.</p>:null}</div>:null}
        </div>}
      </div>
    </>}
  </main></div>
}
