import { Shell } from '../components/Shell'
import { SIDEBAR_DOCKED, useMediaQuery } from '../lib/media'

/* The home is the notebook: rail, list, and a desk waiting for a page. There
   is no shelf screen any more and no chrome bar above it — the date in the
   rail is the masthead. */
export function HomeScreen({ notebook }: { notebook: string }) {
  const docked = useMediaQuery(SIDEBAR_DOCKED)

  return (
    <div className="app">
      <div className="statusband" />
      <Shell notebook={notebook}>
        {({ toggle }) =>
          docked ? (
            <main className="desk desk-bare" key="desk">
              {/* The same mark as on a leaf, so folding the list here is
                  never a one-way door. */}
              <div className="desk-marks">{toggle}</div>
              <p className="empty">Pick a page.</p>
            </main>
          ) : null
        }
      </Shell>
    </div>
  )
}
