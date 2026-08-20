import { useSyncExternalStore } from 'react'
import { cleanToken, newVaultKey, vaultIdFor, type Vault } from './pairing'

/* Where the vault lives on this device. localStorage rather than Dexie, for
   the same reason settings are there: it reads synchronously, so the app knows
   whether it is paired before the first paint and never flashes one answer
   before settling on the other.

   Clearing it unpairs this device and touches no writing. The pages stay. */

const KEY = 'field-notes.vault'

let current: Vault | null = read()
const listeners = new Set<() => void>()

function read(): Vault | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<Vault>
    if (!v.url || !v.anonKey || !v.key || !v.id) return null
    /* Cleaned on the way out as well as the way in, so a device that was
       already paired with a key that had a newline in it heals itself on the
       next load rather than needing to be set up again. The vault id is a hash
       of the key, so cleaning the key cannot change which vault this is —
       whitespace was never part of what was hashed. */
    return {
      url: v.url,
      anonKey: cleanToken(v.anonKey),
      key: cleanToken(v.key),
      id: v.id,
    }
  } catch {
    return null
  }
}

export function getVault(): Vault | null {
  return current
}

export function setVault(vault: Vault | null): void {
  current = vault
  try {
    if (vault) localStorage.setItem(KEY, JSON.stringify(vault))
    else localStorage.removeItem(KEY)
  } catch {
    /* a blocked store is not a reason to stop working */
  }
  for (const fn of listeners) fn()
}

/* The first device: a key nobody has ever held, and the vault it names. */
export async function createVault(url: string, anonKey: string): Promise<Vault> {
  const key = newVaultKey()
  return { url, anonKey: cleanToken(anonKey), key, id: await vaultIdFor(key) }
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useVault(): Vault | null {
  return useSyncExternalStore(subscribe, getVault, getVault)
}
