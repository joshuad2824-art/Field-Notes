import { conditionWord, degrees } from '../weather/codes'
import { useWeather } from '../weather/store'

/* One line, in the register metadata already speaks here: Courier, tracked,
   uppercase by CSS. `14° OVERCAST · 18/9`.

   It renders nothing at all until there is something to say — no placeholder,
   no spinner, no "—". The rail simply doesn't have a weather line yet, and
   then one day it does. A slot reserved for information that hasn't arrived is
   the kind of thing that makes an interface feel like it is waiting on
   something, and nothing in this app is allowed to look like it is waiting. */

interface Props {
  /* The masthead version sits beside the date and gives up the day's range,
     because there is a numeral 76px tall next to it and no room to argue. */
  compact?: boolean
}

export function WeatherLine({ compact }: Props) {
  const reading = useWeather()
  if (!reading) return null

  const word = conditionWord(reading.code)
  const range = `${Math.round(reading.high)}/${Math.round(reading.low)}`

  return (
    <div className={`weather${compact ? ' compact' : ''}`}>
      <span className="weather-now">{degrees(reading.temp)}</span>
      <span className="weather-word">{word}</span>
      {compact ? null : <span className="weather-range">{range}</span>}
    </div>
  )
}
