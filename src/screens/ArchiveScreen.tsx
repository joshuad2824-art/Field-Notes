import { useSienaItems } from '../lib/useSienaItems'
import { useState } from 'react'
import { SienaItemCard } from '../components/SienaItemCard'
import { RouteLink } from '../components/DeskHeader'
import { isSienaArchived } from '../lib/siena-archive'
import { useNotebooks } from '../lib/notebooks'
import { to } from '../lib/router'

export function ArchiveScreen() {
  const items = useSienaItems()
  const books = useNotebooks()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('all')
  const [notebook, setNotebook] = useState(() => new URLSearchParams(location.search).get('notebook') ?? '')
  const archived = items.filter(item => isSienaArchived(item))
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const matches = archived.filter(item => (kind === 'all' || item.type === kind) &&
    (!notebook || item.notebook === notebook) && words.every(word =>
      `${item.title ?? ''} ${item.body} ${books.find(book => book.id === item.notebook)?.name ?? ''}`.toLocaleLowerCase().includes(word)))
  return <div className="app"><main className="siena-collection board-collection siena-archive scroll">
    <header className="collection-header"><h1 id="desk-heading">Archive</h1><RouteLink className="collection-chip" href={to.fromSiena()}>From Siena</RouteLink></header>
    <p className="archive-intro">Completed reminders and older Siena messages. Notebook pages stay in their notebooks.</p>
    <div className="archive-filters">
      <label>Search archive<input type="search" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <label>Kind<select value={kind} onChange={e => setKind(e.target.value)}><option value="all">All kinds</option><option value="reminder">Completed reminders</option><option value="note">Notes from Siena</option><option value="task_update">Task updates</option><option value="saved">Saved</option></select></label>
      <label>Notebook<select value={notebook} onChange={e => setNotebook(e.target.value)}><option value="">All notebooks</option>{notebook && !books.some(b => b.id === notebook) ? <option value={notebook}>Previous notebook</option> : null}{books.map(book => <option key={book.id} value={book.id}>{book.name}</option>)}</select></label>
    </div>
    <p role="status">{matches.length} {matches.length === 1 ? 'item' : 'items'}</p>
    <div className="archive-items">{matches.map(item => <SienaItemCard key={item.id} item={item} paper archived column />)}</div>
    {!matches.length ? <p>{archived.length ? 'No matching items.' : 'Nothing archived yet.'}</p> : null}
  </main></div>
}
