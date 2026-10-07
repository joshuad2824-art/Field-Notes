import { Icon } from './Icon'
import type { SienaItem } from '../lib/model'
import { navigate } from '../lib/router'
import { completeReminder, markSienaItemSeen } from '../lib/siena-items'

const labels: Record<SienaItem['type'], string> = {
  note: 'A note from Siena',
  reminder: 'Reminder',
  task_update: 'Task update',
  saved: 'Saved from Siena',
}

export function SienaItemCard({ item, paper = false, journal = false }: { item: SienaItem; paper?: boolean; journal?: boolean }) {
  const source = item.sourceUrl
  const safeSource = source && (/^https:\/\//.test(source) || /^\/p\/[0-9a-f-]{36}$/.test(source)) ? source : null
  const date = new Intl.DateTimeFormat([], { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(item.created))
  const sourceLink = safeSource?.startsWith('/')
    ? <button className="icon-control" aria-label="Open source" title="Open source" onClick={() => navigate(safeSource)}><Icon name="source" /></button>
    : safeSource ? <a className="icon-control" aria-label="Open source" title="Open source" href={safeSource} target="_blank" rel="noopener noreferrer"><Icon name="source" /></a> : null
  const seenControl = item.seenAt
    ? <span className="icon-control siena-seen" role="img" aria-label="Seen" title="Seen"><Icon name="seen" /></span>
    : <button className="icon-control siena-mark-seen" aria-label="Mark seen" title="Mark seen" onClick={() => void markSienaItemSeen(item.id)}><Icon name="unseen" /></button>
  if (item.type === 'reminder') {
    const title = item.title?.trim()
    const summary = title || item.body
    const extra = title && item.body.trim() && title !== item.body.trim()
    return (
      <article className={`siena-item reminder-compact${paper ? ' paper' : ''}`}>
        <div className="reminder-line">
          {item.completedAt
            ? <span className="icon-control" role="img" aria-label="Completed" title="Completed"><Icon name="done" /></span>
            : <button className="icon-control reminder-mark" aria-label="Mark done" title="Mark done" onClick={() => void completeReminder(item.id)}><Icon name="circle" /></button>}
          <div className="reminder-copy">
            <h3>{summary}</h3>
            {item.dueAt ? <p className="siena-item-due">Due {new Intl.DateTimeFormat([], { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.dueAt))}</p> : null}
            {item.completedAt ? <p className="siena-seen">Completed {new Intl.DateTimeFormat([], { dateStyle: 'medium' }).format(new Date(item.completedAt))}</p> : null}
          </div>
        </div>
        {extra || sourceLink || !item.completedAt ? <details className="reminder-details">
          <summary>Details</summary>
          {extra ? <p className="siena-item-body">{item.body}</p> : null}
          <div className="siena-item-foot">{sourceLink}<span className="grow" />{!item.completedAt ? seenControl : null}</div>
        </details> : null}
      </article>
    )
  }
  return (
    <article className={`siena-item${paper ? ' paper' : ''}`}>
      {!journal ? <div className="siena-item-top">
        <span className="section-label">{labels[item.type]}</span>
        <time dateTime={new Date(item.created).toISOString()}>{date}</time>
      </div>
      : null}
      {item.title ? <h3>{item.title}</h3> : null}
      <p className="siena-item-body">{item.body}</p>
      {item.dueAt ? <p className="siena-item-due">Due {new Intl.DateTimeFormat([], { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.dueAt))}</p> : null}
      <div className="siena-item-foot">
        {journal ? <time dateTime={new Date(item.created).toISOString()}>{date}</time> : null}
        {sourceLink}
        <span className="grow" />
        {item.completedAt ? <span className="siena-seen">Completed {new Intl.DateTimeFormat([], { dateStyle: 'medium' }).format(new Date(item.completedAt))}</span> : (
          <>
            {seenControl}
          </>
        )}
      </div>
    </article>
  )
}
