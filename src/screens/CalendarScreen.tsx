import { useState } from 'react'
import { MonthGrid } from '../components/MonthGrid'
import { PageRow } from '../components/PageRow'
import { daysWritten, pagesInMonth } from '../lib/db'
import { dayOf, monthNow, monthParts, stepMonth } from '../lib/calendar'
import { countLabel, readableDay } from '../lib/format'
import { JOURNAL_NOTEBOOK, type Page, titleOf } from '../lib/model'
import { back, navigate, to } from '../lib/router'
import { useLive } from '../lib/useLive'

/* The month, whole. No chrome bar — the date is the masthead here as much as
   it is in the rail, so the month name is the heading and the marks step it.

   Below the grid, that month's pages in the order they were written. The
   calendar is a lens over the same pages, never a place they live. */
export function CalendarScreen({ month }: { month?: string }) {
  const [shown, setShown] = useState(month ?? monthNow())
  const pages = useLive<Page[]>(() => pagesInMonth(shown), [shown], [])
  const written = useLive<Set<string>>(daysWritten, [], new Set())
  const { month: name, year } = monthParts(shown)

  const step = (by: number) => {
    const next = stepMonth(shown, by)
    setShown(next)
    navigate(to.calendar(next), { replace: true })
  }

  /* The month's journal entries, read off the pages already loaded rather
     than asked for a second time. They are also down in their own day groups
     below, because they are pages and the calendar is a lens over pages — this
     strip is the direct answer to wanting somewhere to find them as a set. */
  const entries = pages.filter((page) => page.notebook === JOURNAL_NOTEBOOK)

  /* Grouped by day, so a day with three pages reads as a day and not as three
     unrelated rows. */
  const days: { iso: string; pages: Page[] }[] = []
  for (const page of pages) {
    const iso = dayOf(page)
    const last = days[days.length - 1]
    if (last && last.iso === iso) last.pages.push(page)
    else days.push({ iso, pages: [page] })
  }

  return (
    <div className="app">
      <div className="statusband" />

      <div className="calendar-screen scroll">
        <div className="calendar-body">
          <div className="calendar-masthead">
            <button className="btn glyph" onClick={() => back()} aria-label="Back">
              ‹
            </button>
            <span className="grow" />
            <button
              className="link-caps"
              onClick={() => step(-1)}
              aria-label="The month before"
            >
              ‹
            </button>
            <button
              className="link-caps"
              onClick={() => {
                setShown(monthNow())
                navigate(to.calendar(monthNow()), { replace: true })
              }}
            >
              Today
            </button>
            <button className="link-caps" onClick={() => step(1)} aria-label="The month after">
              ›
            </button>
          </div>

          <div className="calendar-datum">
            <span className="calendar-name">{name}</span>
            <span className="calendar-year">{year}</span>
          </div>

          <div className="calendar-grid">
            <MonthGrid
              month={shown}
              written={written}
              onPick={(iso) => navigate(to.day(iso))}
            />
          </div>

          <div className="calendar-count section-label">
            {countLabel(pages.length, 'page')} this month
          </div>

          {entries.length ? (
            <div className="calendar-journal">
              <div className="section-label">Journal</div>
              <div className="calendar-journal-rows">
                {entries.map((entry) => (
                  <button
                    key={entry.id}
                    className="calendar-journal-row"
                    onClick={() => navigate(to.page(entry.id))}
                  >
                    {titleOf(entry.body)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {days.map((day) => (
            <div key={day.iso} className="calendar-day">
              <button className="calendar-day-label" onClick={() => navigate(to.day(day.iso))}>
                {readableDay(day.iso)}
              </button>
              <div className="rows">
                {day.pages.map((page) => (
                  <PageRow key={page.id} page={page} showNotebook />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
