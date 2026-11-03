import { BoardWeather } from '../components/BoardWeather'
import { RouteLink } from '../components/DeskHeader'
import { to } from '../lib/router'

export function WeatherScreen() {
  return <div className="app board-app"><main className="board-screen scroll">
    <header className="board-header"><h1 className="room-heading">Weather</h1></header>
    <section className="board-tile board-weather-card" style={{maxWidth:640, margin:'24px auto', minHeight:340}}>
      <div className="board-current-weather"><BoardWeather /></div><BoardWeather compact />
    </section>
    <RouteLink href={to.settings() + '#settings-weather'}>Weather settings</RouteLink>
  </main></div>
}
