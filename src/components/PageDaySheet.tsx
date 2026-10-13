import { getPage, pagesOnDay } from '../lib/db'
import { dayOf } from '../lib/calendar'
import { isoDay } from '../lib/format'
import { useLive } from '../lib/useLive'
import { eventsOnDay } from '../lib/events'
import { allSienaItems } from '../lib/siena-items'
import { mergeCalendarEvents, useFamilyAgenda } from '../davis/calendar'
import { useAppleCalendar } from '../apple/calendar'
import { eventOnDay } from '../lib/event-range'
import { EventRow } from './EventRow'
import { SienaItemCard } from './SienaItemCard'
import { BoardWeather } from './BoardWeather'
import { RouteLink } from './DeskHeader'
import { to } from '../lib/router'
import { titleOf } from '../lib/model'
export function PageDaySheet({ id }: { id: string }) {
  const page = useLive(() => getPage(id), [id], undefined),
    iso = page ? dayOf(page) : isoDay(),
    local = useLive(() => eventsOnDay(iso), [iso], []),
    family = useFamilyAgenda(),
    apple = useAppleCalendar(iso, iso),
    items = useLive(allSienaItems, [], []),
    pages = useLive(() => pagesOnDay(iso), [iso], []),
    date = new Date(iso + 'T12:00:00')
  return (
    <aside className="page-day-sheet scroll">
      <h1>{date.toLocaleDateString([], { weekday: 'long' })}</h1>
      <p className="page-day-date">
        {date.toLocaleDateString([], { day: 'numeric', month: 'long' })}
      </p>
      <h2>Schedule</h2>
      <section>
        {mergeCalendarEvents(local, family, iso, iso, apple)
          .filter((e) => eventOnDay(e, iso))
          .map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
      </section>
      <h2>Weather</h2>
      <BoardWeather compact />
      <h2>Remember</h2>
      <section>
        {items
          .filter(
            (i) =>
              i.type === 'reminder' && !i.completedAt && i.dueAt && isoDay(i.dueAt) === iso,
          )
          .map((i) => (
            <SienaItemCard key={i.id} item={i} />
          ))}
      </section>
      <h2>Written today</h2>
      <div className="page-day-pages">
        {pages.map((p) => (
          <RouteLink key={p.id} href={to.page(p.id)} className={p.id === id ? 'active' : ''}>
            {titleOf(p.body)}
          </RouteLink>
        ))}
      </div>
    </aside>
  )
}
