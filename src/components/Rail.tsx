import { Icon } from './Icon'
import { notebookCounts } from '../lib/db'
import { useAllNotebooks, notebookForPage } from '../lib/notebooks'
import { to } from '../lib/router'
import { useLive } from '../lib/useLive'
import { RouteLink } from './DeskHeader'
import { coverColor } from '../lib/theme'
interface Props {
  activeId: string
  onPick: (id: string) => void
  onManage: () => void
  onFold: () => void
}
export function Rail({ activeId, onPick, onManage, onFold }: Props) {
  const books = useAllNotebooks(),
    counts = useLive(notebookCounts, [], {}),
    book = notebookForPage(activeId)
  return (
    <aside className="board-sidebar rail">
      <button className="drawer-close" aria-label="Close notebooks" onClick={onFold}>
        <Icon name="close" />
      </button>
      <span className="section-label">Notebook</span>
      <h1>{book.name}</h1>
      <nav>
        {books.map((b) => (
          <button
            key={b.id}
            className={b.id === activeId ? 'active' : ''}
            onClick={() => onPick(b.id)}
          >
            <i style={{ background: coverColor(b.color) }} />
            <span>{b.name}</span>
            <small>{counts[b.id] ?? 0}</small>
          </button>
        ))}
        <button onClick={onManage}>
          <Icon name="circle" />
          Add a notebook
        </button>
      </nav>
      <footer>
        <RouteLink href={to.overview()} aria-label="Today">
          <Icon name="overview" />
        </RouteLink>
        <RouteLink href={to.fromSiena()} aria-label="From Siena">
          <Icon name="from-siena" />
        </RouteLink>
        <RouteLink href={to.trash()} aria-label="Trash">
          <Icon name="trash" />
        </RouteLink>
        <RouteLink href={to.settings()} aria-label="Settings">
          <Icon name="settings" />
        </RouteLink>
      </footer>
    </aside>
  )
}
