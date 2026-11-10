/* Where the app was when it was last put down, and the way back to it.

   iOS unloads a home-screen app it has not looked at for a while, and the
   next tap on the icon starts it again at its start_url — Today — however
   recently it was put down mid-sentence. From the inside, that is
   indistinguishable from having closed it on purpose. So the rule is a
   window rather than a guess: a fresh launch at Today, in the installed app,
   within RESUME_WINDOW of being put down somewhere else, goes back there.
   Later than that it opens on Today, which is where a new day should start.

   `resume-boot.ts` calls resumeOnLaunch before the router reads the address
   — main.tsx imports it first — so the router's own history bookkeeping
   starts at the resumed path as though the app had been opened there. This
   file imports nothing, for the same reason, and does nothing on import, so
   the rule can be checked on node. */

export const RESUME_WINDOW = 2 * 60 * 60 * 1000
const KEY = 'field-notes.place'

/* Places that create or hand off rather than show: going back to one would
   do it again. */
const PASSING = /^\/(?:new|today|oauth|kit)(?:\/|$)/

interface Place {
  path: string
  at: number
}

function installed(): boolean {
  try {
    return (
      matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    )
  } catch {
    return false
  }
}

export function rememberPlace(now = Date.now()): void {
  const path = location.pathname + location.search
  try {
    localStorage.setItem(KEY, JSON.stringify({ path, at: now } satisfies Place))
  } catch {
    /* Private mode or a full disk: there is simply nowhere to go back to. */
  }
}

/* The path to resume, or null. Pure apart from what it reads, so the rule
   can be checked on its own. */
export function placeToResume(
  saved: string | null,
  current: string,
  now: number,
  standalone: boolean,
): string | null {
  if (!standalone || current !== '/') return null
  let place: Place
  try {
    place = JSON.parse(saved ?? '')
  } catch {
    return null
  }
  if (!place || typeof place.path !== 'string' || typeof place.at !== 'number') return null
  if (!place.path.startsWith('/') || place.path.startsWith('//')) return null
  if (place.path === '/' || PASSING.test(place.path)) return null
  if (now - place.at > RESUME_WINDOW || place.at > now + 60_000) return null
  return place.path
}

export function resumeOnLaunch(): void {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(KEY)
  } catch {
    return
  }
  const path = placeToResume(saved, location.pathname + location.search, Date.now(), installed())
  if (path) history.replaceState(history.state, '', path)

  /* Put down: the screen going to the background, or the page being torn
     down. Both are written, because iOS sends whichever it sends. */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') rememberPlace()
  })
  window.addEventListener('pagehide', () => rememberPlace())
}

