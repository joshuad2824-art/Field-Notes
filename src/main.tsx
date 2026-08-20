import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/base.css'
import './styles/frame.css'
import './styles/leaf.css'
import { App } from './App'
import { purgeExpiredTombstones, requestPersistence, seedIfEmpty } from './lib/db'
import { loadNotebooks } from './lib/notebooks'
import { resetEdgeColor } from './lib/themecolor'
import { trackViewport } from './lib/viewport'
import { startSync } from './sync/engine'
import { startWeather } from './weather/store'

trackViewport()

/* The colour in index.html is there for whatever the system reads before any
   of this runs — on iOS, the strip it keeps below the app in portrait, which
   nothing in the document can reach. It is the manifest's colour and it is a
   launch value, not a running one. From here on the app says it itself, so a
   screen that never claims the edge lands on the frame rather than on
   whichever value the document happened to open with. */
resetEdgeColor()

/* Open, and be typing. Nothing below blocks the first paint. */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/* In order, and only because sync comes last: a first run that seeded a page
   and a first sync that pulled one are the same page arriving twice if they
   race. None of it blocks the paint above. */
void (async () => {
  await loadNotebooks()
  await seedIfEmpty()
  await purgeExpiredTombstones()
  startSync()
  startWeather()
})()

void requestPersistence()

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js')
  })
}
