import { useSyncExternalStore } from 'react'
import { cleanToken, firstUnsafe, headerSafe, looksTruncated } from '../lib/keys'

/* Where the model key lives, and the consent that has to be given before it is
   ever used.

   In localStorage, on this device, pasted by hand in Settings. Not in Dexie and
   never in the pairing code: a key that synced would be a key the mirror held,
   and the whole design of this app is that there is no account to be locked out
   of and nothing on a server that matters. A Netlify function would have been
   the alternative and would have been the project's first server-side secret,
   which is a larger thing to own than a text field.

   Off unless a key has been pasted. Everything the journal does without one
   still works, which is the whole reason the digest and the prose pass are two
   steps rather than one. */

const KEY = 'field-notes.model-key'
const CONSENT = 'field-notes.model-consent'

const listeners = new Set<() => void>()

function read(name: string): string {
  try {
    return localStorage.getItem(name) ?? ''
  } catch {
    return ''
  }
}

/* Cleaned on the way out as well as on the way in, so a device already holding
   a key that arrived with a newline in the middle of it heals itself rather
   than needing to be set up again. Same discipline as the vault key, and the
   same reason: `fetch` refuses to build a header containing one and throws
   before it opens a socket, which is indistinguishable from a host that isn't
   there. */
let key = cleanToken(read(KEY))
let consented = read(CONSENT) === '1'

function emit() {
  for (const fn of listeners) fn()
}

export function getModelKey(): string {
  return key
}

export function hasModelKey(): boolean {
  return key.length > 0
}

export function setModelKey(raw: string): void {
  key = cleanToken(raw)
  try {
    if (key) localStorage.setItem(KEY, key)
    else localStorage.removeItem(KEY)
  } catch {
    /* a blocked store is not a reason to stop working */
  }
  emit()
}

/* The first time page text would leave this device to anyone other than the
   user's own Supabase. Said plainly, once, and the answer is remembered. */
export function hasConsented(): boolean {
  return consented
}

export function consent(value: boolean): void {
  consented = value
  try {
    if (value) localStorage.setItem(CONSENT, '1')
    else localStorage.removeItem(CONSENT)
  } catch {
    /* a blocked store is not a reason to stop working */
  }
  emit()
}

/* What is wrong with a pasted key, in a sentence, before anything is sent. The
   three cases are the ones the sync panel already learned the hard way: a
   partial key copied from a display that shortened it, a key carrying a
   character a header cannot hold, and a key that is simply absent. */
export function keyProblem(raw = key): string | null {
  const value = cleanToken(raw)
  if (!value) return 'No key yet, so there is nothing to send with.'
  if (looksTruncated(value)) {
    return 'That key has an ellipsis in it, so it was copied from a display that shortened it. Copy the whole thing.'
  }
  if (!headerSafe(value)) {
    return `That key contains ${firstUnsafe(value)}, which cannot go in a request.`
  }
  return null
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function snapshot(): string {
  /* One string rather than an object, so the snapshot compares by value and
     `useSyncExternalStore` settles. */
  return `${consented ? '1' : '0'}:${key}`
}

export function useModelKey(): { key: string; consented: boolean } {
  useSyncExternalStore(subscribe, snapshot, snapshot)
  return { key, consented }
}
