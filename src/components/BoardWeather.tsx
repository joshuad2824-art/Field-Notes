import { useWeather } from '../weather/store'
import { usePlace } from '../weather/place'
import { conditionWord, degrees } from '../weather/codes'
import { WeatherGlyph } from './WeatherGlyph'
import { RouteLink } from './DeskHeader'
import { to } from '../lib/router'
export function BoardWeather({ compact = false }: { compact?: boolean }) {
  const reading = useWeather(),
    place = usePlace()
  if (!reading)
    return (
      <RouteLink
        className={
          compact ? 'weather-inset weather-unavailable' : 'board-weather weather-unavailable'
        }
        href={to.settings()}
      >
        <span className="section-label">Weather</span>
        <p>Choose a place in Settings for the forecast.</p>
      </RouteLink>
    )
  return compact ? (
    <div className="weather-inset">
      <div className="weather-inset-line">
        <span>
          {conditionWord(reading.code)}
          {place?.label ? ` in ${place.label}` : ''}
        </span>
        <strong>
          H {degrees(reading.high)} · L {degrees(reading.low)}
        </strong>
      </div>
      <div className="board-forecast">
        {reading.daily.slice(0, 5).map((d) => (
          <div key={d.date}>
            <WeatherGlyph code={d.code} isDay />
            <strong>{degrees(d.high)}</strong>
            <small>
              {new Date(d.date + 'T12:00:00').toLocaleDateString([], { weekday: 'short' })}
            </small>
          </div>
        ))}
      </div>
    </div>
  ) : (
    <RouteLink className="board-weather" href={to.settings()} aria-label="Weather settings">
      <WeatherGlyph code={reading.code} isDay={reading.isDay} />
      <strong>{degrees(reading.temp)}</strong>
      <small>
        {place?.label ?? 'Weather'} · {conditionWord(reading.code)}
      </small>
      <span className="weather-phone-range">
        H {degrees(reading.high)} · L {degrees(reading.low)}
      </span>
    </RouteLink>
  )
}
