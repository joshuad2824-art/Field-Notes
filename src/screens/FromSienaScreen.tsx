import { useState } from 'react'
import { SienaItemCard } from '../components/SienaItemCard'
import { allSienaItems, markAllSienaItemsSeen } from '../lib/siena-items'
import { isoDay } from '../lib/format'
import { useLive } from '../lib/useLive'
export function FromSienaScreen() {
  const items = useLive(allSienaItems, [], []),
    [filter, setFilter] = useState('Due')
  const notes = items
      .filter((i) => i.type === 'note')
      .sort((a, b) => Number(!!a.seenAt) - Number(!!b.seenAt) || b.created - a.created),
    reminders = items.filter((i) => i.type === 'reminder' && !i.completedAt),
    updates = items.filter((i) => i.type === 'task_update'),
    saved = items.filter((i) => i.type === 'saved'),
    completed = items.filter((i) => i.type === 'reminder' && i.completedAt)
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
          <button className="collection-chip" onClick={() => void markAllSienaItemsSeen()}>
            Mark all seen
          </button>
        </header>
        <div className="siena-board">
          <section className="siena-featured">
            <h2>Note</h2>
            {notes[0] ? (
              <SienaItemCard item={notes[0]} paper column />
            ) : (
              <div className="empty-state">
                <h3>All caught up.</h3>
                <p>I'll leave anything new here as soon as it comes in.</p>
                <img src="/redesign/puffin-right.webp" alt="" />
              </div>
            )}
            {notes.length > 1 ? (
              <details>
                <summary>Earlier notes · {notes.length - 1}</summary>
                {notes.slice(1).map((i) => (
                  <SienaItemCard key={i.id} item={i} paper column />
                ))}
              </details>
            ) : null}
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
            {completed.length ? (
              <details
                id="completed"
                open={location.hash === '#completed' ? true : undefined}
                className="siena-history"
              >
                <summary>Completed reminders · {completed.length}</summary>
                {completed.map((i) => (
                  <SienaItemCard key={i.id} item={i} />
                ))}
              </details>
            ) : null}
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
