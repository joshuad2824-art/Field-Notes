import { useSienaItems } from '../lib/useSienaItems'
import { RouteLink } from '../components/DeskHeader'
import { to } from '../lib/router'
import { activeSienaItems } from '../lib/siena-archive'
import { useState } from 'react'
import { SienaItemCard } from '../components/SienaItemCard'
import { markAllSienaItemsSeen } from '../lib/siena-items'
import { isoDay } from '../lib/format'
export function FromSienaScreen() {
  const items = useSienaItems(),
    [filter, setFilter] = useState('Due')
  const active = activeSienaItems(items)
  const notes = active
      .filter((i) => i.type === 'note')
      .sort((a, b) => Number(!!a.seenAt) - Number(!!b.seenAt) || b.created - a.created),
    reminders = active.filter((i) => i.type === 'reminder' && !i.completedAt),
    updates = active.filter((i) => i.type === 'task_update'),
    saved = active.filter((i) => i.type === 'saved')
  const visible = reminders.filter(
    (i) =>
      filter === 'All open' ||
      (filter === 'Due'
        ? !i.dueAt || isoDay(i.dueAt) <= isoDay()
        : !!i.dueAt && isoDay(i.dueAt) > isoDay()),
  )
  return (
    <div className="app">
      <main className="siena-collection board-collection scroll">
        <header className="collection-header">
          <div>
            <h1 id="desk-heading">From Siena</h1>
          </div>
          <RouteLink className="collection-chip" href={to.archive()}>Archive</RouteLink>
          <button className="collection-chip" onClick={() => void markAllSienaItemsSeen()}>
            Mark all seen
          </button>
        </header>
        <div className="siena-board">
          <section className="siena-featured">
            <h2>Note</h2>
            {notes.length ? notes.map(item => <SienaItemCard key={item.id} item={item} paper column />) : <div className="empty-state"><h3>All caught up.</h3><p>I'll leave anything new here as soon as it comes in.</p><img src="/redesign/puffin-right.webp" alt="" /></div>}
          </section>
          <section className="siena-reminders">
            <h2>Reminders</h2>
            <div className="collection-filters" role="group" aria-label="Filter reminders">
              {['Due', 'Ahead', 'All open'].map((f) => (
                <button key={f} aria-pressed={f === filter} onClick={() => setFilter(f)}>
                  {f}
                </button>
              ))}
            </div>
            {visible.length ? (
              visible.map((i) => <SienaItemCard key={i.id} item={i} />)
            ) : (
              <p>Nothing here right now.</p>
            )}
          </section>
          <section className="siena-updates">
            <h2>Task updates</h2>
            {updates.length ? (
              updates.map((i) => <SienaItemCard key={i.id} item={i} column />)
            ) : (
              <p>No updates yet.</p>
            )}
          </section>
          <section className="siena-saved">
            <h2>Saved</h2>
            {saved.length ? (
              saved.map((i) => <SienaItemCard key={i.id} item={i} column />)
            ) : (
              <p>Things worth keeping will gather here.</p>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
