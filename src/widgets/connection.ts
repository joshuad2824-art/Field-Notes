import { useSyncExternalStore } from 'react'
import { getVault } from '../sync/vault'
import type { WidgetSnapshot } from './projection'

const KEY = 'field-notes.widget'
export interface WidgetConnection { vault: string; token: string; hash: string; updated?: number }
let current: WidgetConnection | null = read()
const listeners = new Set<() => void>()
let publication = Promise.resolve()
let revoking = false
function read(): WidgetConnection | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    return value && /^[a-f0-9]{64}$/.test(value.token) && /^[a-f0-9]{64}$/.test(value.hash) && typeof value.vault === 'string' ? value : null
  } catch { return null }
}
export function getWidgetConnection() {
  return current?.vault === getVault()?.id ? current : null
}
function save(value: WidgetConnection | null) {
  // A connection must survive reload before it may be created on the server.
  if (value) localStorage.setItem(KEY, JSON.stringify(value))
  else localStorage.removeItem(KEY)
  current = value
  listeners.forEach(fn => fn())
}
export function useWidgetConnection() {
  return useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn) } }, getWidgetConnection)
}
export async function widgetRpc(name: 'widget_publish' | 'widget_revoke', body: object) {
  const vault = getVault()
  if (!vault || !/^https:\/\//.test(vault.url)) throw new Error('Pair this device before connecting the calendar widget.')
  const response = await fetch(`${vault.url.replace(/\/+$/, '')}/rest/v1/rpc/${name}`, {
    method: 'POST', cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(15000),
    headers: { apikey: vault.anonKey, Authorization: `Bearer ${vault.anonKey}`, 'x-vault-key': vault.key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error('Calendar widget connection failed. Check the connection and try again.')
  if (getVault()?.id !== vault.id) throw new Error('The paired archive changed. Reopen widget settings.')
  return response
}
// Only the explicit Settings action invokes this. Rendering, previewing and
// background refreshes cannot create, rotate or widen a credential.
export async function connectWidget(snapshot: WidgetSnapshot) {
  const vault = getVault()
  if (!vault) throw new Error('Pair this device first.')
  const previous = getWidgetConnection()
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const token = previous?.token ?? Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  const next = { vault: vault.id, token, hash }
  save(next)
  // Keep this token on uncertain outcomes so it can be revoked or retried.
  await widgetRpc('widget_publish', { p_hash: hash, p_snapshot: snapshot, p_create: true })
  save({ ...next, updated: Date.now() })
}
export async function publishWidget(snapshot: WidgetSnapshot) {
  const connection = getWidgetConnection()
  if (!connection) return
  const task = publication.catch(() => {}).then(async () => {
    if (revoking || getWidgetConnection()?.hash !== connection.hash) return
    await widgetRpc('widget_publish', { p_hash: connection.hash, p_snapshot: snapshot, p_create: false })
    if (getWidgetConnection()?.hash === connection.hash) save({ ...connection, updated: Date.now() })
  })
  publication = task
  await task
}
export async function revokeWidget() {
  revoking = true
  try {
    await publication.catch(() => {})
    await widgetRpc('widget_revoke', {})
    save(null)
  } finally { revoking = false }
}
export function widgetSetupCode() {
  const vault = getVault(), connection = getWidgetConnection()
  if (!vault || !connection) throw new Error('Connect the calendar first.')
  // The public project key is deliberately included; the vault key never is.
  return JSON.stringify({ version: 1, url: vault.url, publicKey: vault.anonKey, token: connection.token })
}
