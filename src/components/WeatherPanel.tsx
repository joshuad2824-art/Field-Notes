import { useState } from 'react'
import { geocode, type Found } from '../weather/open-meteo'
import { forgetRefusal, locate, setPlace, usePlace, wasRefused } from '../weather/place'
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
  const [locating, setLocating] = useState(false)
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

  const useDevice = async () => {
    setProblem(null)
    setLocating(true)
    forgetRefusal()
    try {
      const here = await locate()
      if (!here) {
        setProblem('Could not get this device’s location. You can try again or choose a town. Location permission is controlled by your browser and device.')
        return
      }
      /* Keep the previous place until a new location succeeds. */
      setPlace(here)
      setFound(null)
      setQuery('')
      await refresh(true)
    } catch {
      setProblem('Could not get this device’s location. You can choose a town instead.')
    } finally {
      setLocating(false)
    }
  }

  return (
    <>
      <h2>Weather</h2>
      <p>
        One line under the month, and on the date at the top of the list where the notebooks
        column is a drawer. Weather uses your saved place when the app opens.
        Device location is requested only when you press Use this device below.
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
        <button className="btn caps" disabled={off || locating || busy} onClick={() => void useDevice()}>
          {locating ? 'Locating' : place?.chosen ? 'Use this device instead' : wasRefused() ? 'Ask again' : 'Use this device'}
        </button>
      </div>

      <div className="weather-form">
        <p>
          Choose a town or use this device once to save its location. It stays the weather
          place until you change it here, including when you travel.
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
          <button className="btn caps" disabled={busy || locating || query.trim().length < 2} onClick={() => void search()}>
            {busy ? 'Looking' : 'Find it'}
          </button>
        </div>

        {found?.length ? (
          <div className="weather-found">
            {found.map((option) => (
              <button
                key={`${option.lat},${option.lon}`}
                className="book-row"
                disabled={locating}
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
