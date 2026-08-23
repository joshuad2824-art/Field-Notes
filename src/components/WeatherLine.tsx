import { degrees } from '../weather/codes'
import { useWeather } from '../weather/store'
import { WeatherGlyph } from './WeatherGlyph'

/* One line, in the register metadata already speaks here: Courier, tracked,
   uppercase by CSS. `14° ☁ 18/9`, where the middle mark is drawn rather than
   typed — see `WeatherGlyph`.

   It renders nothing at all until there is something to say — no placeholder,
   no spinner, no "—". The rail simply doesn't have a weather line yet, and
   then one day it does. A slot reserved for information that hasn't arrived is
   the kind of thing that makes an interface feel like it is waiting on
   something, and nothing in this app is allowed to look like it is waiting. */

interface Props {
  /* The masthead version, beside a 76px numeral. It is tighter than the rail's
     and that is now the whole of the difference: the word used to be the part
     that ran long — HEAVY SHOWERS in a 264px column — and giving up the day's
     range was the price of keeping it. A drawing is one fixed width, so there
     is nothing left to surrender and both places say the same three things. */
  compact?: boolean
}

export function WeatherLine({ compact }: Props) {
  const reading = useWeather()
  if (!reading) return null

  const range = `${Math.round(reading.high)}/${Math.round(reading.low)}`

  return (
    <div className={`weather${compact ? ' compact' : ''}`}>
      <span className="weather-now">{degrees(reading.temp)}</span>
      <WeatherGlyph code={reading.code} isDay={reading.isDay} />
      <span className="weather-range">{range}</span>
    </div>
  )
}
