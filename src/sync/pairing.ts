/* Device pairing, and the reason there is never a login.

   The first device generates 256 bits of randomness — the vault key. It has no
   expiry, because it isn't a session; there is nothing to refresh, nothing to
   re-verify and nothing that can quietly stop working eight months from now
   while you're mid-sentence. Every other device is handed that key once, in a
   pairing code, and then never asked anything again.

   The vault's id is the SHA-256 of the key, so the mirror never has to be told
   which vault a request belongs to and there is no row to create before the
   first write. The server computes the same hash from the header the request
   presented and shows the caller the rows that match.

   Nothing in this file touches storage or a network, so `npm run check` runs
   it directly. */

export interface Vault {
  /* The Supabase project — pasted once on the first device, then carried to
     every other device inside the pairing code. */
  url: string
  anonKey: string
  /* The key itself, and the hash the rows are stamped with. */
  key: string
  id: string
}

/* base64url, because the code gets pasted into a text field and a `+` or a `/`
   in a URL-ish looking string invites something to mangle it. */
function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function newVaultKey(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return toBase64Url(bytes)
}

export async function vaultIdFor(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/* A pairing code is the whole of what a device needs and nothing it doesn't:
   where the mirror is, the public key that gets it through the door, and the
   vault key that opens it. It is prefixed so a mis-paste is caught before it
   is parsed rather than after. */
const PREFIX = 'fn1.'

export function encodeCode(vault: Pick<Vault, 'url' | 'anonKey' | 'key'>): string {
  const payload = JSON.stringify({ u: vault.url, a: vault.anonKey, k: vault.key })
  return PREFIX + toBase64Url(new TextEncoder().encode(payload))
}

export async function decodeCode(code: string): Promise<Vault> {
  const trimmed = code.trim().replace(/\s+/g, '')
  if (!trimmed.startsWith(PREFIX)) throw new Error('That is not a pairing code.')
  let parsed: { u?: unknown; a?: unknown; k?: unknown }
  try {
    parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(trimmed.slice(PREFIX.length))))
  } catch {
    throw new Error('That code is damaged. Copy it again.')
  }
  const { u, a, k } = parsed
  if (
    typeof u !== 'string' ||
    typeof a !== 'string' ||
    typeof k !== 'string' ||
    !u ||
    !a ||
    !k
  ) {
    throw new Error('That code is missing something. Copy it again.')
  }
  const url = normaliseUrl(u)
  return { url, anonKey: a, key: k, id: await vaultIdFor(k) }
}

/* A pasted project URL arrives with a trailing slash about half the time, and
   occasionally with the REST path already on it. */
export function normaliseUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/, '')
}

export function looksLikeProjectUrl(raw: string): boolean {
  const url = normaliseUrl(raw)
  return /^https:\/\/[\w.-]+\.[a-z]{2,}$/i.test(url)
}
