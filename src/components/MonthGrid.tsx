import { WEEKDAY_LETTERS, monthOf } from '../lib/calendar'
import { isoDay } from '../lib/format'

interface Props {
  month: string
  /* The days that have pages on them. */
  written: Set<string>
  selected?: string
  onPick: (iso: string) => void
}

/* One grid, drawn at two sizes — the rail has it small and the calendar screen
   has it large. The marks are written once here so the two can't drift:
   an unfilled ring on a day with pages, and the one filled brass dot on today.
   A day can carry both, and today with nothing written on it still lights. */
export function MonthGrid({ month, written, selected, onPick }: Props) {
  const today = isoDay()

  return (
    <div className="cal">
      <div className="cal-week">
        {WEEKDAY_LETTERS.map((letter, i) => (
          <span key={i} className="cal-letter">
            {letter}
          </span>
        ))}
      </div>
      <div className="cal-grid">
        {monthOf(month).map((day) => {
          const marks = [
            day.inMonth ? '' : 'outside',
            written.has(day.iso) ? 'written' : '',
            day.iso === today ? 'today' : '',
            day.iso === selected ? 'on' : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <button
              key={day.iso}
              className={`cal-day ${marks}`.trim()}
              onClick={() => onPick(day.iso)}
              aria-label={day.iso}
              aria-current={day.iso === today ? 'date' : undefined}
            >
              <span className="cal-day-n">{day.date}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
