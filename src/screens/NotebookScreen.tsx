import { createPage, livePages } from '../lib/db'
import { SIDEBAR_DOCKED, useMediaQuery } from '../lib/media'
import { type NotebookId, type Page, notebookOf } from '../lib/model'
import { back, navigate, to } from '../lib/router'
import { useSettings } from '../lib/settings'
import { useLive } from '../lib/useLive'
import { PageRow } from '../components/PageRow'
import { Shell } from '../components/Shell'

export function NotebookScreen({ notebook }: { notebook: string }) {
  const book = notebookOf(notebook)
  const pages = useLive<Page[]>(() => livePages(book.id), [book.id], [])
  const docked = useMediaQuery(SIDEBAR_DOCKED)
  const settings = useSettings()

  const newPage = async () => {
    const page = await createPage(book.id as NotebookId)
    navigate(to.page(page.id))
  }

  /* Where the sidebar is docked, the list is already on screen in it — so the
     notebook route is the same room with nothing on the desk yet. */
  if (docked && settings.sidebar) {
    return (
      <div className="app">
        <div className="statusband" />
        <Shell notebook={book.id}>
          {(toggle) => (
            <>
              <header className="chrome">
                {toggle}
                <span className="chrome-title">{book.name}</span>
                <span className="grow" />
                <button className="btn caps" onClick={() => navigate(to.search())}>
                  Search
                </button>
              </header>
              <div className="desk desk-bare">
                <p className="empty">Pick a page.</p>
              </div>
            </>
          )}
        </Shell>
      </div>
    )
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
