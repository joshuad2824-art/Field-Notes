import { createPage, livePages, notebookCounts } from '../lib/db'
import { DEFAULT_NOTEBOOK, NOTEBOOKS, type Page } from '../lib/model'
import { navigate, to } from '../lib/router'
import { useLive } from '../lib/useLive'
import { todayLine, countLabel } from '../lib/format'
import { PageRow } from '../components/PageRow'

export function Shelf() {
  const counts = useLive<Record<string, number>>(notebookCounts, [], {})
  const recent = useLive<Page[]>(() => livePages().then((rows) => rows.slice(0, 6)), [], [])

  const newPage = async () => {
    const page = await createPage(DEFAULT_NOTEBOOK)
    navigate(to.page(page.id))
  }

  return (
    <div className="app">
      <header className="chrome">
        <span className="chrome-date">{todayLine()}</span>
        <span className="grow" />
        <button className="btn caps" onClick={() => navigate(to.search())}>
          Search
        </button>
        <button className="btn caps" onClick={() => navigate(to.settings())}>
          Settings
        </button>
      </header>

      <div className="scroll">
        <div className="shelf">
          <div className="covers">
            {NOTEBOOKS.map((book) => (
              <button
                key={book.id}
                className="cover"
                data-cover={book.cover}
                onClick={() => navigate(to.notebook(book.id))}
              >
                <span className="plate">{book.name}</span>
                <span className="cover-count">
                  {counts[book.id] ? countLabel(counts[book.id], 'page') : '—'}
                </span>
              </button>
            ))}
          </div>

          {recent.length > 0 ? (
            <>
              <div className="section-label">Recent</div>
              <div className="rows">
                {recent.map((page) => (
                  <PageRow key={page.id} page={page} showNotebook />
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="bottombar">
        <button className="primary" onClick={newPage}>
          New page
        </button>
      </div>
    </div>
  )
}
