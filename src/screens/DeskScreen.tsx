import { DeskHeader } from '../components/DeskHeader'
import { ProjectDesk } from '../components/ProjectDesk'
import { livePages } from '../lib/db'
import { useLive } from '../lib/useLive'

export function DeskScreen({ notebook }: { kind: 'plans' | 'workshop'; notebook: string }) {
  const pages = useLive(livePages, [], [])
  return <div className="app fn-app fn-workshop-page"><main className="fn-shell scroll"><DeskHeader title="Workshop" notebook={notebook} pages={pages} /><ProjectDesk pages={pages} notebook={notebook} mode="workshop" /></main></div>
}
