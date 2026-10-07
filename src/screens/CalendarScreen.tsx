import { eventDaysInMonth } from '../lib/event-range'
import { Icon } from '../components/Icon'
import { CalendarPanel } from '../components/CalendarPanel'
import { DeskHeader } from '../components/DeskHeader'
import { useCalendarView } from '../lib/calendar-view'
import { PageRow } from '../components/PageRow'
import { EventRow } from '../components/EventRow'
import { eventsInMonth } from '../lib/events'
import { pagesInMonth } from '../lib/db'
import { dayOf, monthNow, monthParts } from '../lib/calendar'
import { countLabel, isoDay, readableDay } from '../lib/format'
import { JOURNAL_NOTEBOOK, type FieldEvent, type Page, titleOf } from '../lib/model'
import { back, navigate, to } from '../lib/router'
import { useLive } from '../lib/useLive'

/* The month, whole. No chrome bar — the date is the masthead here as much as
   it is in the rail, so the month name is the heading and the marks step it.

   Below the grid, that month's pages in the order they were written. The
   calendar is a lens over the same pages, never a place they live. */
export function CalendarScreen({ month, notebook }: { month?: string; notebook: string }) {
  const { month: shown } = useCalendarView()
  void month
  const pages = useLive<Page[]>(() => pagesInMonth(shown), [shown], [])
  const events = useLive<FieldEvent[]>(() => eventsInMonth(shown), [shown], [])
  const { month: name } = monthParts(shown)

  /* The month's journal entries, read off the pages already loaded rather
     than asked for a second time. They are also down in their own day groups
     below, because they are pages and the calendar is a lens over pages — this
     strip is the direct answer to wanting somewhere to find them as a set. */
  const entries = pages.filter((page) => page.notebook === JOURNAL_NOTEBOOK)

  /* Grouped by day, so a day with three pages reads as a day and not as three
     unrelated rows. */
  const days: { iso: string; pages: Page[]; events: FieldEvent[] }[] = []
  for (const page of pages) {
    const iso = dayOf(page)
    const last = days[days.length - 1]
    if (last && last.iso === iso) last.pages.push(page)
    else days.push({ iso, pages: [page], events: [] })
  }
  for (const event of events) {
    for (const iso of eventDaysInMonth(event, shown)) {
      const day = days.find((row) => row.iso === iso)
      if (day) day.events.push(event)
      else days.push({ iso, pages: [], events: [event] })
    }
  }
  days.sort((a, b) => a.iso.localeCompare(b.iso))

  return (
    <div className="app fn-app">

      <div className="calendar-screen fn-shell scroll">
        <div className="calendar-body">
          <DeskHeader title="Your month." notebook={notebook} pages={pages} />
          <div className="fn-calendar-page">
          <div className="calendar-masthead fn-calendar-page-toolbar">
            <button className="icon-control" aria-label="Back" title="Back" onClick={() => back(to.overview())}><Icon name="back" /></button>
            <button className="icon-control" aria-label="Notebook" title="Notebook" onClick={() => navigate(to.notebook(notebook))}><Icon name="notebook" /></button>
            <span className="grow" />
            <button className="link-caps" onClick={() => navigate(to.newEvent(shown === monthNow() ? isoDay() : `${shown}-01`))}>Add event</button>
          </div>
          <CalendarPanel large />
          <div className="calendar-count section-label">{countLabel(pages.length, 'page')} · {countLabel(events.length, 'event')} this month</div>
          <section className="calendar-agenda" aria-label="This month’s pages and events">
          <h1 className="calendar-agenda-heading">In {name}</h1>
          {days.length === 0 ? <p className="calendar-empty">No pages or events this month.</p> : null}
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
                {day.events.map((event) => <EventRow key={event.id} event={event} />)}
                {day.pages.map((page) => (
                  <PageRow key={page.id} page={page} showNotebook />
                ))}
              </div>
            </div>
          ))}
          </section>
          </div>
        </div>
      </div>
    </div>
  )
}
