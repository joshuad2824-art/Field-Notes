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
  return <div className="app fn-app fn-workshop-page"><main className="fn-shell scroll"><DeskHeader title="Workshop" notebook={notebook} pages={pages} /><ProjectDesk pages={pages} notebook={notebook} mode="workshop" /><button className="workshop-projects-link collection-chip" onClick={()=>setProjects(true)}>On my desk</button>{projects ? <Sheet onClose={()=>setProjects(false)}><div className="project-sheet"><button className="icon-control" aria-label="Close projects" onClick={()=>setProjects(false)}><Icon name="close"/></button><ProjectDesk pages={pages} notebook={notebook} mode="projects"/></div></Sheet> : null}</main></div>
}
