import { useEffect, useState } from 'react'
import { DeskHeader, RouteLink } from '../components/DeskHeader'
import { SienaItemCard } from '../components/SienaItemCard'
import { Icon } from '../components/Icon'
import { allSienaItems } from '../lib/siena-items'
import { livePages } from '../lib/db'
import { useLive } from '../lib/useLive'
import { useNotebooks } from '../lib/notebooks'
import { notebookDeskItems, ST_JOHN_NOTEBOOK, hasAccessDetails } from '../lib/notebook-desk'
import { snippetOf, titleOf, type Page } from '../lib/model'
import { shortStamp } from '../lib/format'
import { to } from '../lib/router'
import { setSettings } from '../lib/settings'

const resources = [
  ['Training roster', 'Registrations & sessions', 'https://app.smartsheet.com/dashboards/xg9CCQRrfPC8gxjv5Jf3cv2JGr2FCGp5RrFhvrq1'],
  ['OKTUL', 'Onboarding worksheet', 'https://app.smartsheet.com/sheets/gHG8Wwfj599G8c4Qfhwh76p4Q4vcXqh2rFMHCQ71?view=grid'],
  ['ServiceNow', 'Tickets & follow-through', 'https://ascensionesm.service-now.com/now/sow/home'],
  ['Knowledge library', 'IT reference articles', 'https://ascensionesm.service-now.com/now/nav/ui/classic/params/target/kb%3Fid%3Dkb_home'],
]

export function NotebookDeskScreen({ notebook }: { notebook: string }) {
  const books = useNotebooks()
  const book = books.find(book => book.id === notebook)
  const pages = useLive<Page[]>(() => livePages(notebook), [notebook], [])
  const items = useLive(allSienaItems, [], [])
  const [now, setNow] = useState(() => new Date())
  const [filter, setFilter] = useState<'due' | 'upcoming' | 'all'>('due')
  const [query, setQuery] = useState('')
  const [visibleActions, setVisibleActions] = useState(6)
  useEffect(() => setVisibleActions(6), [filter])
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(timer) }, [])
  useEffect(() => { if (book) setSettings({ notebook }) }, [notebook, book?.id])
  const sections = notebookDeskItems(items, notebook, now)
  const remindersPage = pages.find(page => page.purpose === 'reminders')
  const notes = pages.filter(page => page.purpose !== 'reminders').sort((a, b) => b.pinned - a.pinned || b.updated - a.updated)
  const shownNotes = notes.filter(page => page.body.toLowerCase().includes(query.trim().toLowerCase()))
  const work = notebook === ST_JOHN_NOTEBOOK
  const selected = filter === 'all' ? sections.active : filter === 'due' ? sections.due : sections.upcoming
  const featured = sections.briefs[0]
  return <div className="app fn-app notebook-desk-app"><main className="notebook-desk scroll"><div className="notebook-desk-wrap">
    <DeskHeader title={book?.name ?? 'Notebook desk'} notebook={notebook} pages={pages} />
    {!book ? <p className="work-empty">This notebook isn’t available on this device yet. <RouteLink href={to.overview()}>Return to Today</RouteLink></p> : <>
      <section className="work-cover" aria-label="Notebook overview">
        <div className="work-cover-copy"><span className="work-eyebrow">{work ? 'Ascension St. John · Clinical Informatics' : 'Your notebook, at a glance'}</span><h2>A little order.<br /><em>Room to think.</em></h2><p>{work ? 'Your actions, your notes, and the threads worth keeping close.' : 'Pick up a thread, find a note, and make room for what’s next.'}</p>
          <div className="work-cover-links"><RouteLink href={to.notebook(notebook)}><Icon name="notebook" />Notebook pages</RouteLink><RouteLink href={to.newPage(notebook)}><Icon name="new-page" />Write a note</RouteLink></div>
        </div>
        <div className="work-counts" aria-label="Open reminder counts">
          <button onClick={() => setFilter('due')} aria-pressed={filter === 'due'}><strong>{sections.due.length.toString().padStart(2, '0')}</strong><span>Due & overdue</span></button>
          <button onClick={() => setFilter('upcoming')} aria-pressed={filter === 'upcoming'}><strong>{sections.upcoming.length.toString().padStart(2, '0')}</strong><span>Looking ahead</span></button>
          <div><strong>{notes.length.toString().padStart(2, '0')}</strong><span>Notebook pages</span></div>
        </div>
      </section>
      <div className="work-grid">
        <div className="work-main">
          <section className="work-actions work-paper" aria-labelledby="work-actions-heading">
            <span className="work-paper-tab" aria-hidden="true">01 / Follow through</span>
            <div className="work-section-heading"><div><span className="work-eyebrow">One thing at a time</span><h2 id="work-actions-heading">On your list</h2></div>{remindersPage ? <RouteLink className="icon-control" href={to.page(remindersPage.id)} aria-label="Open notebook reminders" title="Open notebook reminders"><Icon name="forward" /></RouteLink> : null}</div>
            <div className="work-filters" role="group" aria-label="Filter reminders">{(['due', 'upcoming', 'all'] as const).map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'due' ? 'Due & overdue' : value === 'upcoming' ? 'Ahead' : 'All open'} <span>{value === 'due' ? sections.due.length : value === 'upcoming' ? sections.upcoming.length : sections.active.length}</span></button>)}</div>
            <div className="work-action-list" aria-live="polite">{selected.length ? selected.slice(0, visibleActions).map(item => <SienaItemCard key={item.id} item={item} />) : <p className="work-empty">{filter === 'due' ? 'Nothing due here today. You can look ahead or return to your notes.' : 'No open reminders in this view.'}</p>}</div>
            {selected.length > visibleActions ? <button className="work-show-more" onClick={() => setVisibleActions(selected.length)}>Show all {selected.length} reminders <Icon name="forward" /></button> : null}
            {sections.completed.length ? <details className="work-completed"><summary>Completed · {sections.completed.length}</summary>{sections.completed.map(item => <SienaItemCard key={item.id} item={item} />)}</details> : null}
          </section>
          <section className="work-notes" aria-labelledby="work-notes-heading"><div className="work-section-heading"><div><span className="work-eyebrow">Keep within reach</span><h2 id="work-notes-heading">From your notebook</h2></div><RouteLink className="icon-control" href={to.notebook(notebook)} aria-label="All notebook pages" title="All notebook pages"><Icon name="notebook" /></RouteLink></div>
            <input className="work-search" type="search" aria-label="Find a notebook page" placeholder="Find a page…" value={query} onChange={event => setQuery(event.target.value)} />
            <div className="work-note-grid">{shownNotes.slice(0, query ? shownNotes.length : 6).map((page, index) => <RouteLink className={`work-note work-note-${index % 3}`} key={page.id} href={to.page(page.id)}><span className="work-note-meta">{page.pinned ? 'Pinned · ' : ''}{shortStamp(page.updated)}</span><h3>{hasAccessDetails(titleOf(page.body)) ? 'Notebook reference' : titleOf(page.body)}</h3><p>{hasAccessDetails(page.body) ? 'Open this page for its details.' : snippetOf(page.body)}</p><span className="work-note-open"><Icon name="forward" /></span></RouteLink>)}</div>
            {!shownNotes.length ? <p className="work-empty">{query ? 'No pages match that search.' : 'Your notebook pages will gather here as you write.'}</p> : null}
          </section>
        </div>
        <aside className="work-side">
          <section className="work-brief work-paper" aria-labelledby="work-brief-heading"><span className="work-tape" aria-hidden="true" /><div className="work-section-heading"><div><span className="work-eyebrow">02 / The latest word</span><h2 id="work-brief-heading">From Siena</h2></div><Icon name="from-siena" /></div>
            {featured ? <><p className="work-brief-date">Saved {shortStamp(featured.created)} · {featured.seenAt ? 'Seen' : 'Unread'}</p><SienaItemCard item={featured} paper journal /></> : <p className="work-empty">Work briefs will appear here when saved to this notebook. Older messages can be filed from From Siena.</p>}
            {sections.briefs.length > 1 ? <details className="work-earlier"><summary>Earlier notes & updates · {sections.briefs.length - 1}</summary>{sections.briefs.slice(1).map(item => <SienaItemCard key={item.id} item={item} />)}</details> : null}
            <RouteLink className="work-text-link" href={to.fromSiena()}>All messages from Siena <Icon name="forward" /></RouteLink>
          </section>
          {work ? <section className="work-resources" aria-labelledby="work-resources-heading"><span className="work-eyebrow">03 / Familiar places</span><h2 id="work-resources-heading">Your work shelf</h2><div>{resources.map(([label,description,url]) => <a key={label} href={url} target="_blank" rel="noopener noreferrer"><span><strong>{label}</strong><small>{description}</small></span><Icon name="source" /></a>)}</div><p className="work-source-note">Opens the source. Use your Ascension account.</p></section> : null}
          <div className="work-calendar-note"><Icon name="calendar" /><div><strong>Your day, together</strong><p>{work ? 'The Ascension calendar connection is still to come. Your Field Notes events remain on Today.' : 'Your Field Notes events remain on Today.'}</p><RouteLink href={to.overview()}>Open Today <Icon name="forward" /></RouteLink></div></div>
        </aside>
      </div>
    </>}
  </div></main></div>
}
