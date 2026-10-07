import { DeskHeader } from '../components/DeskHeader'
import { ProjectDesk } from '../components/ProjectDesk'
import { livePages } from '../lib/db'
import { useLive } from '../lib/useLive'

export function DeskScreen({ kind, notebook }: { kind: 'plans' | 'workshop'; notebook: string }) {
  const pages = useLive(livePages, [], [])
  return <div className="app fn-app"><main className="fn-shell scroll"><DeskHeader title={kind === 'plans' ? 'Things taking shape.' : 'Ready to hand.'} notebook={notebook} pages={pages} /><ProjectDesk pages={pages} notebook={notebook} mode={kind} /></main></div>
}
