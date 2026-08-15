import { createPage, livePages } from '../lib/db'
import { type NotebookId, type Page, notebookOf } from '../lib/model'
import { back, navigate, to } from '../lib/router'
import { useLive } from '../lib/useLive'
import { PageRow } from '../components/PageRow'

export function NotebookScreen({ notebook }: { notebook: string }) {
  const book = notebookOf(notebook)
  const pages = useLive<Page[]>(() => livePages(book.id), [book.id], [])

  const newPage = async () => {
    const page = await createPage(book.id as NotebookId)
    navigate(to.page(page.id))
  }

  return (
    <div className="app">
      <header className="chrome">
        <button className="btn glyph" onClick={() => back()} aria-label="Back">
          ‹
        </button>
        <span className="chrome-title">{book.name}</span>
        <span className="grow" />
        <button className="btn caps" onClick={() => navigate(to.search())}>
          Search
        </button>
      </header>

      <div className="scroll">
        {pages.length === 0 ? (
          <div className="empty">Nothing here yet. Plenty of time.</div>
        ) : (
          <div className="rows">
            {pages.map((page) => (
              <PageRow key={page.id} page={page} />
            ))}
          </div>
        )}
      </div>

      <div className="bottombar">
        <button className="primary" onClick={newPage}>
          New page
        </button>
      </div>
    </div>
  )
}
