import type { SienaItem } from '../lib/model'
import { navigate } from '../lib/router'
import { markSienaItemSeen } from '../lib/siena-items'

const labels: Record<SienaItem['type'], string> = {
  note: 'A note from Siena',
  reminder: 'Reminder',
  task_update: 'Task update',
  saved: 'Saved from Siena',
}

export function SienaItemCard({ item, paper = false }: { item: SienaItem; paper?: boolean }) {
  const source = item.sourceUrl
  const safeSource = source && (/^https:\/\//.test(source) || /^\/p\/[0-9a-f-]{36}$/.test(source)) ? source : null
  const date = new Intl.DateTimeFormat([], { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(item.created))
  return (
    <article className={`siena-item${paper ? ' paper' : ''}`}>
      <div className="siena-item-top">
        <span className="section-label">{labels[item.type]}</span>
        <time dateTime={new Date(item.created).toISOString()}>{date}</time>
      </div>
      {item.title ? <h3>{item.title}</h3> : null}
      <p className="siena-item-body">{item.body}</p>
      {item.dueAt ? <p className="siena-item-due">Due {new Intl.DateTimeFormat([], { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.dueAt))}</p> : null}
      <div className="siena-item-foot">
        {safeSource?.startsWith('/') ? <button onClick={() => navigate(safeSource)}>Open source ↗</button> : null}
        {safeSource?.startsWith('https://') ? <a href={safeSource} target="_blank" rel="noopener noreferrer">Open source ↗</a> : null}
        <span className="grow" />
        {item.seenAt ? <span className="siena-seen">Seen</span> : (
          <button className={`siena-mark-seen${item.type === 'reminder' ? ' reminder-mark' : ''}`} onClick={() => void markSienaItemSeen(item.id)}>
            {item.type === 'reminder' ? <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M10 2.6c4.3-.5 7.7 3.2 7.4 7.5-.2 4.2-3.5 7.5-7.7 7.3C5.4 17.2 2.3 13.8 2.7 9.6 3 5.8 6.1 2.9 10 2.6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
            Mark seen
          </button>
        )}
      </div>
    </article>
  )
}
