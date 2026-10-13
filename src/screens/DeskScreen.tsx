import { useEffect, useRef, useState } from 'react'
import { useDismiss } from '../lib/dismiss'
import { RouteLink } from '../components/DeskHeader'
import { projectDesk, field } from '../lib/project-desk'
import { planProgress } from '../lib/plan-progress'
import { livePages, createPage } from '../lib/db'
import { titleOf, type Page } from '../lib/model'
import { allNotebooks, isWorkshopNotebook } from '../lib/notebooks'
import { navigate, to } from '../lib/router'
import { useLive } from '../lib/useLive'
import { DeskThumbnail } from '../components/DeskThumbnail'
import { DeskDetails } from '../components/DeskDetails'
import { Reading } from '../components/Reading'
import { ProjectDesk } from '../components/ProjectDesk'
import { Sheet } from '../components/Sheet'
import type { DeskKind } from '../lib/desk-metadata'

export function DeskScreen({ notebook }: { kind: 'plans' | 'workshop'; notebook: string }) {
  const pages = useLive(livePages, [], [])
  const desk = projectDesk(pages),
    plans = desk.plans.map((group) => group[0])
  const [filter, setFilter] = useState('All')
  const [editing, setEditing] = useState<{ kind: DeskKind; selected?: Page } | null>(null)
  const [projects, setProjects] = useState(false)
  const [creatingRoutine, setCreatingRoutine] = useState(false)
  const [menu, setMenu] = useState(false)
  const head = useRef<HTMLDivElement>(null)
  useDismiss(menu, () => setMenu(false))
  useEffect(() => {
    if (!menu) return
    const outside = (e: PointerEvent) => {
      if (!head.current?.contains(e.target as Node)) setMenu(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [menu])
  const act = (kind: string) => {
    setMenu(false)
    if (kind === 'projects') setProjects(true)
    else setEditing({ kind: kind as DeskKind })
  }
  const status = (page: Page) => field(page.body, 'Status').toLowerCase() || 'plan'
  const routine = pages.find(
    (p) => isWorkshopNotebook(p.notebook) && /^shop routine$/i.test(titleOf(p.body)),
  )
  const workshopBook = allNotebooks().find((b) => isWorkshopNotebook(b.id))?.id ?? notebook
  useEffect(() => {
    const action = (event: Event) => {
      const kind = (event as CustomEvent<string>).detail
      if (kind === 'projects') setProjects(true)
      else if (kind === 'plan' || kind === 'equipment') setEditing({ kind })
    }
    window.addEventListener('field-notes:workshop-action', action)
    return () => window.removeEventListener('field-notes:workshop-action', action)
  }, [])
  const openRoutine = async () => {
    if (creatingRoutine) return
    if (routine) {
      navigate(to.page(routine.id))
      return
    }
    setCreatingRoutine(true)
    try {
      const page = await createPage(workshopBook, '# Shop routine\n\n')
      navigate(to.page(page.id))
    } finally {
      setCreatingRoutine(false)
    }
  }
  return (
    <div className="app workshop-reference-app">
      <main className="workshop-reference scroll">
        <header className="workshop-reference-header">
          <div className="workshop-heading" ref={head}>
            <h1 id="desk-heading">
              <button
                aria-label="Workshop menu"
                title="Workshop menu"
                aria-haspopup="menu"
                aria-expanded={menu}
                onClick={() => setMenu(!menu)}
              >
                The Workshop
              </button>
            </h1>
            {menu ? (
              <nav className="workshop-menu" aria-label="Workshop">
                <button onClick={() => act('plan')}>New plan</button>
                <button onClick={() => act('equipment')}>Add equipment</button>
                <button onClick={() => act('projects')}>On my desk</button>
                <RouteLink href={to.notebookPages(workshopBook)}>Workshop pages</RouteLink>
              </nav>
            ) : null}
          </div>
          <div className="workshop-reference-filters" role="group" aria-label="Filter plans">
            {['All', 'Active', 'Paused', 'Done'].map((value) => (
              <button
                key={value}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </header>
        <div className="workshop-reference-plans">
          {plans
            .filter((p) => filter === 'All' || status(p) === filter.toLowerCase())
            .map((page) => {
              const progress = planProgress(page.body)
              const next = field(page.body, 'Next step'),
                context = field(page.body, 'Where we left off')
              return (
                <article
                  key={page.id}
                  className="workshop-reference-plan"
                  data-status={status(page)}
                >
                  <button
                    className="workshop-reference-open"
                    onClick={() => navigate(to.plan(page.id))}
                  >
                    <DeskThumbnail page={page} kind="plan" />
                    <div className="workshop-reference-title">
                      <strong>{field(page.body, 'Project') || titleOf(page.body)}</strong>
                      <span>{status(page)}</span>
                    </div>
                    {next || context ? (
                      <p>
                        {status(page) === 'active' && next ? `Next: ${next}` : context || next}
                      </p>
                    ) : null}
                    {progress.total ? (
                      <div className="workshop-reference-progress">
                        <progress max={progress.total} value={progress.done} />
                        <small>
                          {progress.done} of {progress.total} steps
                        </small>
                      </div>
                    ) : null}
                  </button>
                </article>
              )
            })}
        </div>
        <div className="workshop-reference-bottom">
          <section className="workshop-reference-tools">
            <header>
              <h2>
                <button
                  onClick={() => setEditing({ kind: 'equipment' })}
                  aria-label="Add equipment"
                >
                  Tools on the wall
                </button>
              </h2>
            </header>
            <div>
              {desk.owned.map((page) => (
                <button key={page.id} onClick={() => navigate(to.page(page.id))}>
                  {titleOf(page.body)}
                </button>
              ))}
            </div>
          </section>
          <section className={`workshop-reference-routine${routine ? '' : ' is-empty'}`}>
            <h2>
              <button
                disabled={creatingRoutine}
                onClick={() => void openRoutine()}
                aria-label="Edit shop routine"
              >
                Shop routine
              </button>
            </h2>
            {routine ? (
              <Reading text={routine.body.replace(/^#\s+Shop routine\s*\n?/i, '')} />
            ) : null}
          </section>
        </div>
        {editing ? (
          <DeskDetails
            kind={editing.kind}
            selected={editing.selected}
            pages={pages}
            notebook={notebook}
            onClose={() => setEditing(null)}
          />
        ) : null}
        {projects ? (
          <Sheet onClose={() => setProjects(false)}>
            <ProjectDesk pages={pages} notebook={notebook} mode="projects" />
          </Sheet>
        ) : null}
      </main>
    </div>
  )
}
