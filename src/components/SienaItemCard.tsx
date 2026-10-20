import { DueLabel } from './DueLabel'
import { SienaBody } from './SienaBody'
import { SienaDisposition } from './SienaDisposition'
import { Icon } from './Icon'
import { useState } from 'react'
import { useNotebooks } from '../lib/notebooks'
import type { SienaItem } from '../lib/model'
import { navigate } from '../lib/router'
import { completeReminder, markSienaItemSeen, fileSienaItem } from '../lib/siena-items'

const labels: Record<SienaItem['type'], string> = {
  note: 'A note from Siena',
  reminder: 'Reminder',
  task_update: 'Task update',
  saved: 'Saved from Siena',
}

/* `column`: the card sits under a heading that already names its kind, so
   the card keeps one eyebrow — its date — and drops the doubled label. */
export function SienaItemCard({ item, paper = false, journal = false, column = false, archived = false }: { item: SienaItem; paper?: boolean; journal?: boolean; column?: boolean; archived?: boolean }) {
  const books = useNotebooks()
  const [open, setOpen] = useState(false)
  const [filing, setFiling] = useState(false)
  const [filingError, setFilingError] = useState('')
  async function file(notebook: string) {
    setFiling(true); setFilingError('')
    try { await fileSienaItem(item.id, notebook || undefined, item.updated) }
    catch (error) { setFilingError(error instanceof Error ? error.message : 'Could not file this message.') }
    finally { setFiling(false) }
  }
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
    /* The words are the way in to the details; completion stays on the circle. */
    const details = Boolean(extra || sourceLink || !item.completedAt)
    return (
      <article className={`siena-item reminder-compact${paper ? ' paper' : ''}${open ? ' open' : ''}`}>
        <div className="reminder-line">
          {item.completedAt
            ? <span className="icon-control" role="img" aria-label="Completed" title="Completed"><Icon name="done" /></span>
            : <button className="icon-control reminder-mark" aria-label="Mark done" title="Mark done" onClick={() => void completeReminder(item.id)}><Icon name="circle" /></button>}
          <div className="reminder-copy">
            <h3>{details ? <button className="reminder-words" aria-expanded={open} onClick={() => setOpen(!open)}>{summary}</button> : summary}</h3>
            {item.dueAt ? <p className="siena-item-due"><DueLabel at={item.dueAt} completed={Boolean(item.completedAt)} /></p> : null}
            {item.completedAt ? <p className="siena-seen">Completed {new Intl.DateTimeFormat([], { dateStyle: 'medium' }).format(new Date(item.completedAt))}</p> : null}
          </div>
        </div>
        {details && open ? <div className="reminder-details">
          {extra ? <SienaBody text={item.body} /> : null}
          <div className="siena-item-foot">{sourceLink}<span className="grow" />{!item.completedAt ? seenControl : null}</div>
        </div> : null}
        {archived ? <SienaDisposition item={item} archived /> : null}
      </article>
    )
  }
  return (
    <article className={`siena-item${paper ? ' paper' : ''}`}>
      {!journal ? <div className="siena-item-top">
        {column ? null : <span className="section-label">{labels[item.type]}</span>}
        <time dateTime={new Date(item.created).toISOString()}>{date}</time>
      </div>
      : null}
      {item.title ? <h3>{item.title}</h3> : null}
      <SienaBody text={item.body} />
      {item.dueAt ? <p className="siena-item-due"><DueLabel at={item.dueAt} completed={Boolean(item.completedAt)} /></p> : null}
      <div className="siena-item-foot">
        {journal ? <time dateTime={new Date(item.created).toISOString()}>{date}</time> : null}
        <label className="siena-notebook-control"><Icon name="notebook" /><select aria-label={`Notebook for ${item.title ?? labels[item.type]}`} value={item.notebook ?? ''} disabled={filing} onChange={event => void file(event.target.value)}><option value="">Unfiled</option>{item.notebook && !books.some(book => book.id === item.notebook) ? <option value={item.notebook}>Previous notebook</option> : null}{books.map(book => <option key={book.id} value={book.id}>{book.name}</option>)}</select></label>
        {sourceLink}
        <span className="grow" />
        {item.completedAt ? <span className="siena-seen">Completed {new Intl.DateTimeFormat([], { dateStyle: 'medium' }).format(new Date(item.completedAt))}</span> : (
          <>
            {seenControl}
          </>
        )}
      </div>
      {filingError ? <p className="siena-filing-error" role="alert">{filingError}</p> : null}
      <SienaDisposition item={item} archived={archived} />
    </article>
  )
}
