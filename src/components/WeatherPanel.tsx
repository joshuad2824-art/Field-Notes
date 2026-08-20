import { useState } from 'react'
import { geocode, type Found } from '../weather/open-meteo'
import { forgetRefusal, setPlace, usePlace, wasRefused } from '../weather/place'
import { getUnit, isOff, refresh, setOff, setUnit, useWeather } from '../weather/store'
import { conditionWord, degrees } from '../weather/codes'

/* Settings → Weather. Small, because the feature is small: it is one line of
   chrome under the month, and everything here exists so that line can be got
   rid of, moved, or told what a degree means. */

export function WeatherPanel() {
  const place = usePlace()
  const reading = useWeather()
  const [off, setOffState] = useState(isOff())
  const [unit, setUnitState] = useState(getUnit())
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Found[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const search = async () => {
    setProblem(null)
    setBusy(true)
    try {
      const results = await geocode(query)
      setFound(results)
      if (!results.length) setProblem('Nothing found by that name.')
    } catch {
      setProblem('Could not reach the place search. It needs a network for this one thing.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h2>Weather</h2>
      <p>
        One line under the month, and on the date at the top of the list where the notebooks
        column is a drawer. It is the only thing in the app that asks this device for anything —
        once, for where it is. Refusing costs the line and nothing else.
      </p>

      {reading ? (
        <p className="meta" style={{ marginTop: 16 }}>
          {degrees(reading.temp)} · {conditionWord(reading.code)} ·{' '}
          {Math.round(reading.high)}/{Math.round(reading.low)}
          {place?.label ? ` · ${place.label}` : ''}
        </p>
      ) : (
        <p className="meta" style={{ marginTop: 16 }}>
          {off ? 'off' : place ? 'no reading yet' : 'no place yet'}
        </p>
      )}

      <div className="actions">
        <button
          className={`btn caps${off ? '' : ' on'}`}
          onClick={() => {
            const next = !off
            setOffState(next)
            setOff(next)
          }}
        >
          {off ? 'Off' : 'On'}
        </button>
        <button
          className="btn caps"
          onClick={() => {
            const next = unit === 'C' ? 'F' : 'C'
            setUnitState(next)
            setUnit(next)
          }}
        >
          Degrees · {unit}
        </button>
        <button className="btn caps" disabled={off} onClick={() => void refresh(true)}>
          Check now
        </button>
        {wasRefused() ? (
          <button
            className="btn caps"
            onClick={() => {
              forgetRefusal()
              void refresh(true)
            }}
          >
            Ask again
          </button>
        ) : null}
      </div>

      <div className="weather-form">
        <p>
          If this device can't place itself, or you'd rather it didn't try, name somewhere
          instead. A chosen place wins over the device, so this is also how you pin the weather
          to home while you're away from it.
        </p>
        <label className="panel-label" htmlFor="weather-place">
          Somewhere
        </label>
        <input
          id="weather-place"
          className="well"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void search()}
          placeholder="A town or a city"
          autoComplete="off"
        />
        <div className="actions">
          <button className="btn caps" disabled={busy || query.trim().length < 2} onClick={() => void search()}>
            {busy ? 'Looking' : 'Find it'}
          </button>
          {place?.chosen ? (
            <button
              className="btn caps"
              onClick={() => {
                setPlace(null)
                setFound(null)
                setQuery('')
                void refresh(true)
              }}
            >
              Use this device instead
            </button>
          ) : null}
        </div>

        {found?.length ? (
          <div className="weather-found">
            {found.map((option) => (
              <button
                key={`${option.lat},${option.lon}`}
                className="book-row"
                onClick={() => {
                  setPlace(option)
                  setFound(null)
                  setQuery('')
                  void refresh(true)
                }}
              >
                <span className="book-name">{option.label}</span>
              </button>
            ))}
          </div>
        ) : null}

        {problem ? <p className="panel-problem">{problem}</p> : null}
      </div>
    </>
  )
}
