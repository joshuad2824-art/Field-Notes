import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/base.css'
import './styles/frame.css'
import './styles/leaf.css'
import { App } from './App'
import { purgeExpiredTombstones, requestPersistence, seedIfEmpty } from './lib/db'
import { trackViewport } from './lib/viewport'

trackViewport()

/* Open, and be typing. Nothing below blocks the first paint. */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

void seedIfEmpty()
void purgeExpiredTombstones()
void requestPersistence()

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js')
  })
}
