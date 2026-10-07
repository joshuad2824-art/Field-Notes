import { MonthGrid } from './MonthGrid'
import { daysWritten } from '../lib/db'
import { daysWithEvents } from '../lib/events'
import { isoDay } from '../lib/format'
import { monthParts, stepMonth } from '../lib/calendar'
import { selectCalendarDate, showCalendarMonth, useCalendarView } from '../lib/calendar-view'
import { useLive } from '../lib/useLive'
import { navigate, to } from '../lib/router'
import { RouteLink } from './DeskHeader'

export function CalendarPanel({ large = false }: { large?: boolean }) {
  const view = useCalendarView()
  const written = useLive(daysWritten, [], new Set<string>())
  const events = useLive(() => daysWithEvents(view.month), [view.month], new Set<string>())
  const date = new Date(`${view.selected}T12:00:00`)
  const { month, year } = monthParts(view.month)
  const step = (by: number) => { const next = stepMonth(view.month, by); showCalendarMonth(next); if (location.pathname.startsWith('/calendar')) navigate(to.calendar(next), { replace: true }) }
  return <section className={`fn-reference-calendar${large ? ' fn-calendar-large calendar-month-panel' : ''}`} aria-label={large ? 'Month calendar' : 'Sidebar calendar'}>
    <div className="fn-reference-top"><span className="fn-calendar-weekday">{new Intl.DateTimeFormat([], { weekday: 'long' }).format(date)}</span><div className="fn-calendar-month-controls"><button aria-label="The month before" title="The month before" onClick={() => step(-1)}>‹</button><button aria-label="The month after" title="The month after" onClick={() => step(1)}>›</button></div></div>
    {large ? <div className="fn-reference-date"><span className="fn-calendar-big-day">{date.getDate()}</span><div><h2>{month}</h2><span>{year}</span></div></div> : <RouteLink className="fn-reference-date rail-datum" href={to.calendar(view.month)} aria-label="Open full calendar"><span className="fn-calendar-big-day rail-numeral">{date.getDate()}</span><div><h2>{month}</h2><span>{year}</span></div></RouteLink>}
    <div className={large ? 'calendar-grid' : 'rail-month'}><MonthGrid month={view.month} written={written} events={events} selected={view.selected} onPick={iso => { selectCalendarDate(iso); navigate(to.day(iso)) }} /></div>
    <div className="fn-reference-key"><span><i aria-hidden="true" />Days with writing</span><button aria-label="Return to today" title="Return to today" onClick={() => { selectCalendarDate(isoDay()); if (location.pathname.startsWith('/calendar')) navigate(to.calendar(isoDay().slice(0, 7)), { replace: true }) }}>↺</button></div>
  </section>
}
