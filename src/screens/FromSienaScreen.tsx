import { SienaItemCard } from '../components/SienaItemCard'
import { allSienaItems, markAllSienaItemsSeen } from '../lib/siena-items'
import { navigate, to } from '../lib/router'
import { useLive } from '../lib/useLive'

export function FromSienaScreen() {
  const items = useLive(allSienaItems, [], [])
  const unseen = items.filter((item) => !item.seenAt).length
  return (
    <div className="app">
      <div className="statusband" />
      <main className="siena-collection scroll">
        <div className="overview-wrap">
          <div className="overview-top">
            <button className="overview-back" onClick={() => navigate(to.overview())}>‹ Overview</button>
            {unseen ? <button className="overview-back" onClick={() => void markAllSienaItemsSeen()}>Mark all seen</button> : null}
          </div>
          <header className="overview-intro">
            <span className="section-label">Saved in Field Notes</span>
            <h1>From Siena {unseen ? <span className="siena-badge">{unseen}</span> : null}</h1>
            <p>Messages, reminders, and useful results remain here after you mark them seen.</p>
          </header>
          {items.length ? (
            <div className="siena-collection-list">
              {items.map((item) => <SienaItemCard key={item.id} item={item} paper={item.type === 'note'} />)}
            </div>
          ) : <p className="overview-empty">Nothing from Siena has been saved here yet.</p>}
        </div>
      </main>
    </div>
  )
}
