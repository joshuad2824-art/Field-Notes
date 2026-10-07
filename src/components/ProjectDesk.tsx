import { useState } from 'react'
import type { Page } from '../lib/model'
import { titleOf } from '../lib/model'
import { field, projectDesk } from '../lib/project-desk'
import { navigate, to } from '../lib/router'
import { Icon } from './Icon'
import { DeskDetails } from './DeskDetails'
import { DeskThumbnail } from './DeskThumbnail'
import { RouteLink } from './DeskHeader'
import type { DeskKind } from '../lib/desk-metadata'

function dated(at: number) { return new Intl.DateTimeFormat([], { month: 'short', day: 'numeric', year: 'numeric' }).format(at) }
export function ProjectDesk({ pages, notebook, mode = 'dashboard' }: { pages: Page[]; notebook: string; mode?: 'dashboard' | 'plans' | 'workshop' }) {
  const [editing, setEditing] = useState<{ kind: DeskKind; selected?: Page } | null>(null)
  const [owner, setOwner] = useState('All')
  const desk = projectDesk(pages)
  const owners = [...new Set(desk.active.map(page => field(page.body, 'Owner')).filter(Boolean))]
  const visible = desk.active.filter(page => owner === 'All' || field(page.body, 'Owner') === owner)
  return <>
    {mode === 'dashboard' ? <section className="desk-projects fn-desk-projects"><div className="fn-section-heading"><h2>On our desk <span className="fn-count">{desk.active.length}</span></h2><div className="desk-project-actions"><div className="fn-filter" role="group" aria-label="Filter projects">{['All', ...owners].map(value => <button key={value} aria-pressed={owner === value} onClick={() => setOwner(value)}>{value}</button>)}</div><button className="desk-add" onClick={() => setEditing({ kind: 'project' })}><Icon name="new-page" /><span>Add project</span></button></div></div>
      {desk.active.length ? <div className="desk-project-grid fn-project-grid">{visible.map((page, index) => <div className="fn-tag-wrap" key={page.id}><article className="desk-project fn-project-card">
        <div className="fn-card-eyebrow"><span>{field(page.body, 'Owner')}</span><span>No. {String(index + 1).padStart(2, '0')}</span></div>
        <button className="icon-control desk-edit" title="Edit project details" aria-label={`Edit project details: ${titleOf(page.body)}`} onClick={() => setEditing({ kind: 'project', selected: page })}><Icon name="settings" /></button>
        <h3><button onClick={() => navigate(to.page(page.id))}>{titleOf(page.body)}</button></h3>
        {field(page.body, 'Where we left off') ? <p>{field(page.body, 'Where we left off')}</p> : null}
        {field(page.body, 'Next step') ? <div className="desk-next fn-card-bottom"><small>Next</small><span>{field(page.body, 'Next step')}</span><Icon name="forward" /></div> : null}
        <button className="desk-artifact" onClick={() => navigate(to.plan(desk.plans.find(([plan]) => (field(plan.body, 'Project') || titleOf(plan.body)).toLowerCase() === (field(page.body, 'Project') || titleOf(page.body)).toLowerCase())?.[0].id || page.id))}><Icon name="plan" />{field(page.body, 'Artifact') || 'Open project page'}</button>
      </article></div>)}</div> : <p className="desk-empty">Add a project or link its existing page.</p>}
      {desk.active.length && !visible.length ? <p className="desk-empty">No active projects for this owner.</p> : null}
    </section> : null}
    {mode === 'workshop' ? <section className="desk-workshop fn-workshop-sheet"><div className="overview-section-head"><h2>Tools on hand</h2><button className="desk-add" onClick={() => setEditing({ kind: 'equipment' })}><Icon name="new-page" />Add equipment</button></div>{desk.owned.length ? desk.owned.map(page => { const known = (value: string) => /^(unknown|unspecified|not recorded|\?)$/i.test(value.trim()) ? '' : value.trim(); const details = [known(field(page.body, 'Brand')), known(field(page.body, 'Model'))].filter(Boolean).join(' · '); return <div className="workshop-row fn-stock-row" key={page.id}><button className="workshop-item" onClick={() => navigate(to.page(page.id))}><Icon name="workshop" /><span>{titleOf(page.body)}{details ? <small>{details}</small> : null}</span><Icon name="forward" /></button><button className="icon-control" aria-label={`Edit equipment details: ${titleOf(page.body)}`} title={details ? 'Edit equipment details' : 'Add brand or model when useful'} onClick={() => setEditing({ kind: 'equipment', selected: page })}><Icon name="settings" /></button></div> }) : <p className="desk-empty">Add equipment you confirm is owned, or link an existing page. Brand and model are optional.</p>}</section> : null}
    <section className="desk-plans fn-plans"><div className="fn-section-heading"><h2>Project plans</h2><div className="desk-project-actions">{mode === 'dashboard' ? <RouteLink className="fn-subtle-action" href={to.plans()}>Workshop <Icon name="forward" /></RouteLink> : null}<button className="desk-add" onClick={() => setEditing({ kind: 'plan' })}><Icon name="new-page" />Add plan</button></div></div>
      {desk.plans.length ? <div className="fn-plan-grid">{desk.plans.map(([latest, ...older], index) => <article className={`desk-plan-link fn-plan-print fn-plan-${index % 2}`} key={latest.id}>
        <span className="fn-washi" aria-hidden="true" /><button className="desk-plan-open" onClick={() => navigate(to.plan(latest.id))}>
          <DeskThumbnail page={latest} kind="plan" />
          <span className="fn-print-caption"><strong>{field(latest.body, 'Project') || titleOf(latest.body)}</strong><Icon name="forward" /></span>
          <span className="fn-print-meta">{field(latest.body, 'Version') ? `Version ${field(latest.body, 'Version')} · ` : ''}Updated {dated(latest.updated)}</span>
        </button><button className="desk-revision-edit" onClick={() => setEditing({ kind: 'plan', selected: latest })}>Edit plan details</button>
        {older.length ? <details><summary>{older.length} older revision{older.length === 1 ? '' : 's'}</summary>{older.map(page => <button key={page.id} onClick={() => navigate(to.plan(page.id))}>{field(page.body, 'Version') || titleOf(page.body)} · {dated(page.updated)}</button>)}</details> : null}
      </article>)}</div> : <p className="desk-empty">Add or link a plan page. A shared project name keeps its revisions together.</p>}
    </section>
    {editing ? <DeskDetails key={`${editing.kind}:${editing.selected?.id || 'new'}`} kind={editing.kind} selected={editing.selected} pages={pages} notebook={notebook} onClose={() => setEditing(null)} /> : null}
  </>
}
