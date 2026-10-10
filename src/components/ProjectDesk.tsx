import { isWorkshopNotebook } from '../lib/notebooks'
import { useState } from 'react'
import type { Page } from '../lib/model'
import { titleOf } from '../lib/model'
import { deskSummary, field, projectDesk } from '../lib/project-desk'
import { decorationFor } from '../lib/reading'
import { navigate, to } from '../lib/router'
import { Icon } from './Icon'
import { InlineReading } from './Reading'
import { DeskDetails } from './DeskDetails'
import { DeskThumbnail } from './DeskThumbnail'
import { RouteLink } from './DeskHeader'
import type { DeskKind } from '../lib/desk-metadata'

function dated(at: number) { return new Intl.DateTimeFormat([], { month: 'short', day: 'numeric' }).format(at) }
export function ProjectDesk({ pages, notebook, mode = 'dashboard' }: { pages: Page[]; notebook: string; mode?: 'dashboard' | 'plans' | 'workshop' }) {
  const [editing, setEditing] = useState<{ kind: DeskKind; selected?: Page } | null>(null)
  const [owner, setOwner] = useState('All')
  const desk = projectDesk(pages)
  const covered = new Set([...desk.plans.flat().map(page => page.id), ...desk.owned.map(page => page.id)])
  const workshopNotes = pages.filter(page => isWorkshopNotebook(page.notebook) && !page.deleted && !page.purpose && !covered.has(page.id))
  const owners = [...new Set(desk.active.map(page => field(page.body, 'Owner')).filter(Boolean))]
  const visible = desk.active.filter(page => owner === 'All' || field(page.body, 'Owner') === owner)
  const plans = mode === 'dashboard' ? desk.plans.slice(0, 2) : desk.plans
  return <>
    {mode === 'dashboard' ? <section className={`desk-projects fn-desk-projects${desk.active.length ? '' : ' is-empty'}`}><div className="fn-section-heading"><h2>On our desk {desk.active.length ? <span className="fn-count">{desk.active.length}</span> : null}</h2><div className="desk-project-actions">{owners.length > 1 ? <div className="fn-filter" role="group" aria-label="Filter projects">{['All', ...owners].map(value => <button key={value} aria-pressed={owner === value} onClick={() => setOwner(value)}>{value}</button>)}</div> : null}<button className="desk-add icon-control" aria-label="Add project" title="Add project" onClick={() => setEditing({ kind: 'project' })}><Icon name="add" /></button></div></div>
      {desk.active.length ? <div className="desk-project-grid fn-project-grid">{visible.map(page => <div className="fn-tag-wrap" key={page.id} data-decoration={decorationFor(page.id)}><article className="desk-project fn-project-card">
        {field(page.body, 'Owner') ? <div className="fn-card-eyebrow">{field(page.body, 'Owner')}</div> : null}
        <button className="icon-control desk-edit" title="Edit project details" aria-label={`Edit project details: ${titleOf(page.body)}`} onClick={() => setEditing({ kind: 'project', selected: page })}><Icon name="edit" /></button>
        <h3><button onClick={() => navigate(to.page(page.id))}>{titleOf(page.body)}</button></h3>
        {deskSummary(page.body) ? <p className="desk-note-summary">{deskSummary(page.body)}</p> : null}
      </article></div>)}</div> : <p className="desk-empty">No active projects.</p>}
      {desk.active.length && !visible.length ? <p className="desk-empty">No active projects for this owner.</p> : null}
    </section> : null}
    <div className={mode === 'workshop' ? 'workshop-layout' : 'desk-plan-preview'}>
    <section className="desk-plans fn-plans"><div className="fn-section-heading"><h2>{mode === 'dashboard' ? 'Workshop' : 'Project plans'}</h2><div className="desk-project-actions">{mode === 'dashboard' ? <RouteLink className="fn-subtle-action icon-control" href={to.workshop()} aria-label="Open Workshop" title="Open Workshop"><Icon name="forward" /></RouteLink> : null}<button className="desk-add icon-control" aria-label="Add plan" title="Add plan" onClick={() => setEditing({ kind: 'plan' })}><Icon name="add" /></button></div></div>
      {plans.length ? <div className="fn-plan-grid">{plans.map(([latest, ...older]) => <article className="desk-plan-link fn-plan-print" data-decoration={decorationFor(latest.id)} key={latest.id}>
        <span className="fn-washi" aria-hidden="true" /><button className="desk-plan-open" onClick={() => navigate(to.plan(latest.id))}>
          <DeskThumbnail page={latest} kind="plan" />
          <span className="fn-print-caption"><strong>{field(latest.body, 'Project') || titleOf(latest.body)}</strong><Icon name="forward" /></span>
          <span className="fn-print-meta">{field(latest.body, 'Version') ? `Version ${field(latest.body, 'Version')} · ` : ''}{dated(latest.updated)}</span>
        </button>
        {field(latest.body, 'Where we left off') ? <p className="plan-card-context"><InlineReading text={field(latest.body, 'Where we left off')} /></p> : null}
        {field(latest.body, 'Next step') ? <div className="plan-card-next"><span className="section-label">Next</span><p><InlineReading text={field(latest.body, 'Next step')} /></p></div> : null}
        <div className="plan-card-foot"><button className="desk-revision-edit icon-control" aria-label={`Edit plan details: ${titleOf(latest.body)}`} title="Edit plan details" onClick={() => setEditing({ kind: 'plan', selected: latest })}><Icon name="edit" /></button>
        {older.length ? <details><summary>{older.length} older revision{older.length === 1 ? '' : 's'}</summary>{older.map(page => <button key={page.id} onClick={() => navigate(to.plan(page.id))}>{field(page.body, 'Version') || titleOf(page.body)} · {dated(page.updated)}</button>)}</details> : null}</div>
      </article>)}</div> : <p className="desk-empty">No plans yet.</p>}
    </section>
    {mode === 'workshop' ? <aside className="desk-workshop fn-workshop-sheet"><div className="overview-section-head"><h2>Tools on hand</h2><button className="desk-add icon-control" aria-label="Add equipment" title="Add equipment" onClick={() => setEditing({ kind: 'equipment' })}><Icon name="add" /></button></div>{desk.owned.length ? desk.owned.map(page => { const known = (value: string) => /^(unknown|unspecified|not recorded|\?)$/i.test(value.trim()) ? '' : value.trim(); const details = [known(field(page.body, 'Brand')), known(field(page.body, 'Model'))].filter(Boolean).join(' · '); return <div className="workshop-row fn-stock-row" key={page.id}><button className="workshop-item" onClick={() => navigate(to.page(page.id))}><Icon name="workshop" /><span>{titleOf(page.body)}{details ? <small>{details}</small> : null}</span></button><button className="icon-control" aria-label={`Edit equipment details: ${titleOf(page.body)}`} title="Edit equipment details" onClick={() => setEditing({ kind: 'equipment', selected: page })}><Icon name="edit" /></button></div> }) : <p className="desk-empty">No tools recorded.</p>}{workshopNotes.length ? <details className="workshop-notes"><summary>Other notes · {workshopNotes.length}</summary>{workshopNotes.map(page => <RouteLink key={page.id} href={to.plan(page.id)}>{titleOf(page.body)}</RouteLink>)}</details> : null}</aside> : null}
    </div>
    {editing ? <DeskDetails key={`${editing.kind}:${editing.selected?.id || 'new'}`} kind={editing.kind} selected={editing.selected} pages={pages} notebook={notebook} onClose={() => setEditing(null)} /> : null}
  </>
}
