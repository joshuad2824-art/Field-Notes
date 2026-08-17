import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/base.css'
import './styles/frame.css'
import './styles/leaf.css'
import { App } from './App'
import { purgeExpiredTombstones, requestPersistence, seedIfEmpty } from './lib/db'
import { loadNotebooks } from './lib/notebooks'
import { trackViewport } from './lib/viewport'
import { startSync } from './sync/engine'

trackViewport()

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
})()

void requestPersistence()

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js')
  })
}
