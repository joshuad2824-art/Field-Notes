import { projectDesk, field } from '../lib/project-desk'
import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { Icon } from '../components/Icon'
import { DeskHeader } from '../components/DeskHeader'
import { ProjectDesk } from '../components/ProjectDesk'
import { livePages } from '../lib/db'
import { useLive } from '../lib/useLive'

export function DeskScreen({ notebook }: { kind: 'plans' | 'workshop'; notebook: string }) {
  const [projects, setProjects] = useState(false)
  const pages = useLive(livePages, [], [])
  const plans = projectDesk(pages).plans.map((group) => group[0])
  return (
    <div className="app fn-app fn-workshop-page">
      <main className="fn-shell scroll">
        <DeskHeader title="Workshop" notebook={notebook} pages={pages} />
        <p className="workshop-counts">
          {plans.length} plans ·{' '}
          {plans.filter((p) => field(p.body, 'Status').toLowerCase() === 'active').length}{' '}
          active ·{' '}
          {plans.filter((p) => field(p.body, 'Status').toLowerCase() === 'paused').length}{' '}
          paused
        </p>
        <ProjectDesk pages={pages} notebook={notebook} mode="workshop" />
        <button
          className="workshop-projects-link collection-chip"
          onClick={() => setProjects(true)}
        >
          On my desk
        </button>
        {projects ? (
          <Sheet onClose={() => setProjects(false)}>
            <div className="project-sheet">
              <button
                className="icon-control"
                aria-label="Close projects"
                onClick={() => setProjects(false)}
              >
                <Icon name="close" />
              </button>
              <ProjectDesk pages={pages} notebook={notebook} mode="projects" />
            </div>
          </Sheet>
        ) : null}
      </main>
    </div>
  )
}
