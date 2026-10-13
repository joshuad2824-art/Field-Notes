import { JOURNAL_NOTEBOOK } from '../lib/model'
import { Shell } from '../components/Shell'
import { SIDEBAR_DOCKED, useMediaQuery } from '../lib/media'
import { useLive } from '../lib/useLive'
import { livePages } from '../lib/db'
import { navigate, to } from '../lib/router'
export function HomeScreen({ notebook }: { notebook: string }) {
  const journal = notebook === JOURNAL_NOTEBOOK
  const docked = useMediaQuery(SIDEBAR_DOCKED),
    pages = useLive(() => livePages(notebook), [notebook], [])
  return (
    <div className="app">
      <div className="statusband" />
      <Shell notebook={notebook}>
        {({ toggle }) =>
          docked ? (
            <main className="desk desk-bare notebook-empty">
              <div className="desk-marks">{toggle}</div>
              {/* An empty leaf in the notebook's colour. Nothing is written in
                  the journal by hand, so its leaf only waits. */}
              {journal ? (
                <div className="empty-leaf" aria-hidden="true" />
              ) : (
                <button
                  className="empty-leaf"
                  aria-label="Start a page here"
                  title="Start a page here"
                  onClick={() => navigate(to.newPage(notebook))}
                >
                  {!pages.length ? <img src="/redesign/moose-left.webp" alt="" /> : null}
                </button>
              )}
            </main>
          ) : null
        }
      </Shell>
    </div>
  )
}
