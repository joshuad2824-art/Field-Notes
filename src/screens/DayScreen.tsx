import { pagesOnDay } from '../lib/db'
import { readableDay } from '../lib/format'
import { isoMonth } from '../lib/calendar'
import type { Page } from '../lib/model'
import { back, navigate, to } from '../lib/router'
import { useLive } from '../lib/useLive'
import { PageRow } from '../components/PageRow'

/* One day's pages. A lens, never a container — nothing is filed here, it is
   only being looked at by the day it was written on. */
export function DayScreen({ iso }: { iso: string }) {
  const pages = useLive<Page[]>(() => pagesOnDay(iso), [iso], [])

  return (
    <div className="app">
      <header className="chrome">
        <button
          className="btn glyph"
          onClick={() => back(to.calendar(isoMonth(iso)))}
          aria-label="Back"
        >
          ‹
        </button>
        <span className="chrome-title">{readableDay(iso)}</span>
        <span className="grow" />
        <button className="link-caps" onClick={() => navigate(to.calendar(isoMonth(iso)))}>
          Month
        </button>
      </header>

      <div className="scroll">
        {pages.length === 0 ? (
          <div className="empty">Nothing was written that day.</div>
        ) : (
          <div className="rows">
            {pages.map((page) => (
              <PageRow key={page.id} page={page} showNotebook />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
