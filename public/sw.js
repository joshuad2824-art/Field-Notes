/* A small service worker, written by hand so a year of neglect doesn't require
   an archaeology dig. It caches the shell and the fonts; it never touches page
   data, which lives in IndexedDB and is nobody's business but the app's. */

const VERSION = 'v1'
const SHELL = `shell-${VERSION}`
const ASSETS = `assets-${VERSION}`
const FONTS = `fonts-${VERSION}`
const KEEP = new Set([SHELL, ASSETS, FONTS])

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(['/', '/manifest.webmanifest', '/icon.svg']))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone())
  return response
}

async function shellFor(request) {
  /* Network first so a new deploy lands, cache behind so a tunnel doesn't
     matter. */
  try {
    const response = await fetch(request)
    const cache = await caches.open(SHELL)
    cache.put('/', response.clone())
    return response
  } catch {
    const cache = await caches.open(SHELL)
    return (await cache.match('/')) ?? Response.error()
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  if (request.mode === 'navigate') {
    event.respondWith(shellFor(request))
    return
  }

  if (url.origin === location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, ASSETS))
    return
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, FONTS))
    return
  }

  if (url.origin === location.origin && /\.(svg|png|webmanifest)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, SHELL))
  }
})
