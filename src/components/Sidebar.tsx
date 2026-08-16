import { createPage, livePages } from '../lib/db'
import { type NotebookId, type Page, notebookOf } from '../lib/model'
import { navigate, to } from '../lib/router'
import { useLive } from '../lib/useLive'
import { PageRow } from './PageRow'

interface Props {
  notebook: string
  activeId?: string
  onPick?: () => void
}

/* The notebook, listed. On a desktop it's docked beside the leaf; on a tablet
   it slides over. Either way it's the same column — one level of notebooks
   means there is nothing here to expand or collapse. */
export function Sidebar({ notebook, activeId, onPick }: Props) {
  const book = notebookOf(notebook)
  const pages = useLive<Page[]>(() => livePages(book.id), [book.id], [])

  const open = (page: Page) => {
    navigate(to.page(page.id))
    onPick?.()
  }

  const newPage = async () => {
    const page = await createPage(book.id as NotebookId)
    navigate(to.page(page.id))
    onPick?.()
  }

  return (
    <aside className="sidebar" aria-label={book.name}>
      <header className="sidebar-head">
        <button
          className="btn glyph"
          onClick={() => navigate(to.shelf())}
          aria-label="The shelf"
        >
          ‹
        </button>
        <span className="sidebar-title">{book.name}</span>
        <span className="grow" />
        <button className="btn caps" onClick={() => navigate(to.search())}>
          Search
        </button>
      </header>

      <div className="scroll sidebar-list">
        {pages.length === 0 ? (
          <div className="empty">Nothing here yet. Plenty of time.</div>
        ) : (
          pages.map((page) => (
            <PageRow
              key={page.id}
              page={page}
              active={page.id === activeId}
              onOpen={open}
              compact
            />
          ))
        )}
      </div>

      <div className="sidebar-foot">
        <button className="primary" onClick={newPage}>
          New page
        </button>
      </div>
    </aside>
  )
}
