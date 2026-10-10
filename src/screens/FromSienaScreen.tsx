import { Icon } from '../components/Icon'
import { SienaItemCard } from '../components/SienaItemCard'
import { allSienaItems, markAllSienaItemsSeen } from '../lib/siena-items'
import { navigate, to } from '../lib/router'
import { useLive } from '../lib/useLive'

export function FromSienaScreen() {
  const items = useLive(allSienaItems, [], [])
  const unseen = items.filter((item) => !item.seenAt).length
  const active = items.filter((item) => !item.completedAt)
  const completed = items.filter((item) => item.type === 'reminder' && item.completedAt)
  return (
    <div className="app">
      <div className="statusband" />
      <main className="siena-collection scroll">
        <div className="overview-wrap">
          <div className="overview-top">
            <button className="overview-back" onClick={() => navigate(to.overview())} aria-label="‹ Overview" title="‹ Overview"><Icon name="back" /></button>
            {unseen ? <button className="overview-back" onClick={() => void markAllSienaItemsSeen()} aria-label="Mark all seen" title="Mark all seen"><Icon name="seen" /></button> : null}
          </div>
          <header className="overview-intro">
            <span className="section-label">Saved in Field Notes</span>
            <h1>From Siena {unseen ? <span className="siena-badge">{unseen}</span> : null}</h1>
            
          </header>
          {active.length ? (
            <div className="siena-collection-list">
              {active.map((item) => <SienaItemCard key={item.id} item={item} paper={item.type === 'note'} />)}
            </div>
          ) : <p className="overview-empty">No active items from Siena.</p>}
          {completed.length ? <details id="completed" open={window.location.hash === '#completed' ? true : undefined} className="siena-collection-list siena-history"><summary><h2>Completed reminders</h2><span> · {completed.length}</span></summary>
            
            {completed.map((item) => <SienaItemCard key={item.id} item={item} />)}
          </details> : null}
        </div>
      </main>
    </div>
  )
}
