import { useWeather, getUnit, setUnit } from '../weather/store'
import { usePlace } from '../weather/place'
import { degrees } from '../weather/codes'
import { WeatherGlyph } from './WeatherGlyph'
import { isoDay } from '../lib/format'

export function DeskWeather() {
  const reading = useWeather()
  const place = usePlace()
  const today = isoDay()
  return <section className="fn-weather overview-forecast" aria-labelledby="forecast-heading">
    <div className="fn-weather-label"><div><h2 id="forecast-heading">Out the window</h2>{place?.label ? <span>{place.label}</span> : null}</div>
      <div className="fn-unit-switch" role="group" aria-label="Temperature unit">{(['F', 'C'] as const).map(unit => <button key={unit} aria-label={`Show degrees ${unit === 'F' ? 'Fahrenheit' : 'Celsius'}`} aria-pressed={getUnit() === unit} onClick={() => setUnit(unit)}>°{unit}</button>)}</div>
    </div>
    {reading?.daily.length ? <div className="fn-forecast-days forecast-days">{reading.daily.slice(0, 7).map((day, index) => <div key={day.date} className={`fn-forecast-day forecast-day${day.date === today ? ' fn-forecast-today today' : ''}${index > 4 ? ' fn-forecast-extra' : ''}`}>
      <span className="fn-forecast-dayname">{day.date === today ? 'Today' : new Intl.DateTimeFormat([], { weekday: 'short' }).format(new Date(`${day.date}T12:00:00`))} <small>{Number(day.date.slice(8))}</small></span>
      <WeatherGlyph code={day.code} isDay /><strong className="forecast-range">{degrees(day.high)} <span>{degrees(day.low)}</span></strong>
      {typeof day.rainChance === 'number' && Number.isFinite(day.rainChance) && day.rainChance >= 0 && day.rainChance <= 100 ? <small className="fn-rain-chance">{day.rainChance}% rain</small> : null}
    </div>)}</div> : <p className="fn-weather-empty">The forecast will appear when a place and a weather reading are available.</p>}
  </section>
}
