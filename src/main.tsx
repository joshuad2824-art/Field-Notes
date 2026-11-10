/* First: a fresh launch may go back to where the app was put down, and that
   has to happen before the router reads the address. */
import './lib/resume-boot'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/base.css'
import './styles/frame.css'
import './styles/overview.css'
import './styles/leaf.css'
import './styles/desk.css'
import { App } from './App'
import { purgeExpiredTombstones, requestPersistence, seedIfEmpty } from './lib/db'
import { loadNotebooks } from './lib/notebooks'
import { fileLeftoverQuickNote } from './lib/quick-note'
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
  await fileLeftoverQuickNote().catch(() => false)
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

import './styles/approved-desk.css'

import './styles/app-design.css'

import './styles/notebook-desk.css'

import './styles/kit.css'

import './styles/redesign-tokens.css'
import './styles/redesign.css'
import './styles/home-board.css'
import './styles/siena.css'
import './styles/home-approved.css'
import './styles/theology.css'
import './styles/room-heading.css'

import './styles/theology-reference.css'

/* November 2026 daily-use pass. Last, so it is read after everything it
   adjusts. */
import './styles/daily.css'
