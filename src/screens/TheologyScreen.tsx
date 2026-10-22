import { useState } from 'react'
import { RouteLink } from '../components/DeskHeader'
import { Icon } from '../components/Icon'
import { SienaItemCard } from '../components/SienaItemCard'
import { StudyText } from '../components/StudyText'
import { livePages } from '../lib/db'
import { useLive } from '../lib/useLive'
import { useSienaItems } from '../lib/useSienaItems'
import { notebookDeskItems } from '../lib/notebook-desk'
import { titleOf } from '../lib/model'
import { isoDay } from '../lib/format'
import { to } from '../lib/router'
import { activeEdition } from '../theology/store'
import { studyReading } from '../theology/reading'
import { useStudySync } from '../theology/sync'
import { REFERENCES } from '../theology/references'
import { useVault } from '../sync/vault'

export function TheologyScreen(){
  const scope=useVault()?.id??'local-device',pages=useLive(livePages,[],[]),items=useSienaItems(),cachedEdition=useLive(activeEdition,[scope],null),edition=cachedEdition?.scope===scope?cachedEdition:null,[filter,setFilter]=useState<'due'|'upcoming'|'all'>('due')
  useStudySync()
  const devotional=pages.filter(p=>p.entryDate&&/^# Morning and Evening\s*[—–-]/.test(p.body)).sort((a,b)=>(b.entryDate??'').localeCompare(a.entryDate??''))[0]
  // Joshua confirmed the existing unique Prayer Log; its ID remains runtime data.
  const prayers=pages.filter(p=>p.notebook==='field-notes'&&titleOf(p.body)==='Prayer Log'),prayer=prayers.length===1?prayers[0]:null
  const sections=notebookDeskItems(items,'church'),shown=filter==='due'?sections.due:filter==='upcoming'?sections.upcoming:sections.active
  const reminderPage=pages.find(p=>p.notebook==='church'&&p.purpose==='reminders')
  const devotionContent=<><h2>Morning<br/><em>& Evening</em></h2><p>Charles H. Spurgeon</p>{devotional?<div className="theology-devotional-date">{devotional.entryDate===isoDay()?'Today':devotional.entryDate}</div>:null}</>
  return <div className="app theology-app"><main className="theology-screen scroll">
    <header className="theology-heading"><h1 id="desk-heading" className="room-heading">Theology</h1><RouteLink href={to.overview()} aria-label="Return to Today" title="Today"><Icon name="overview"/></RouteLink></header>
    <div className="theology-grid">
      <RouteLink className="theology-doctrine theology-card" href={to.study()} aria-label="Daily Doctrine"><h2>Daily<br/><em>Doctrine</em></h2>{edition?<footer>{edition.sections.filter(s=>s.reading).length} readings</footer>:null}</RouteLink>
      {devotional?<RouteLink className="theology-devotional theology-card" href={to.devotional(devotional.id)} aria-label="Morning & Evening">{devotionContent}</RouteLink>:<section className="theology-devotional theology-card">{devotionContent}</section>}
      <section className="theology-reminders theology-card"><div className="study-section-heading">{reminderPage?<RouteLink className="theology-card-link" href={to.page(reminderPage.id)} aria-label="Church reminders"><h2>Church reminders</h2></RouteLink>:<h2>Church reminders</h2>}</div><div className="work-filters">{(['due','upcoming','all'] as const).map(f=><button key={f} aria-pressed={filter===f} onClick={()=>setFilter(f)}>{f==='due'?'Due':f==='upcoming'?'Ahead':'All open'} <span>{(f==='due'?sections.due:f==='upcoming'?sections.upcoming:sections.active).length}</span></button>)}</div>{shown.length?shown.map(item=><SienaItemCard key={item.id} item={item}/>):<p className="theology-muted">{filter==='due'?'Nothing due today.':'No open reminders.'}</p>}<RouteLink className="study-text-link" href={to.archive('church')}>Archive</RouteLink></section>
      {prayer?<RouteLink className="theology-prayer theology-card" href={to.page(prayer.id)} aria-label="Prayer Log"><h2>Prayer<br/><em>Log</em></h2></RouteLink>:<section className="theology-prayer theology-card"><h2>Prayer<br/><em>Log</em></h2></section>}
      {(['bfm','mbc'] as const).map(key=><RouteLink key={key} className={`theology-reference theology-reference-${key} theology-card`} href={to.reference(key)} aria-label={REFERENCES[key].title}><h2>{REFERENCES[key].title}</h2></RouteLink>)}
    </div>
  </main></div>
}
export function DevotionalStudyScreen({id}:{id:string}){
  const page=useLive(()=>livePages().then(p=>p.find(p=>p.id===id)??null),[id],null),pages=useLive(livePages,[],[])
  const others=pages.filter(p=>p.entryDate&&/^# Morning and Evening\s*[—–-]/.test(p.body)).sort((a,b)=>(b.entryDate??'').localeCompare(a.entryDate??''))
  return <div className="app theology-app"><main className="study-screen scroll"><header className="study-topbar"><RouteLink href={to.theology()} aria-label="Back to Theology" title="Theology"><Icon name="back"/></RouteLink><div><span className="study-eyebrow">Charles H. Spurgeon</span><h1 id="desk-heading">Morning & Evening</h1></div></header>{page?<article className="study-paper devotional-paper"><span className="study-location">{page.entryDate}</span><StudyText reading={studyReading(page.body)} section={page.id}/></article>:<p className="study-problem">This devotional is not on this device yet.</p>}<nav className="devotional-history" aria-label="Dated devotionals">{others.slice(0,14).map(p=><RouteLink key={p.id} href={to.devotional(p.id)} aria-current={p.id===id?'page':undefined}>{p.entryDate}</RouteLink>)}</nav></main></div>
}
