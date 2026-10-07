import { davisAgenda, DAVIS_AGENDA_URL, DAVIS_CALLBACK_PATH, type AgendaReader } from './agenda'
import { fetchAgenda } from './http'
import { projectAgenda, shiftDate, type DavisIdentity } from './wire'

export const DAVIS_ISSUER = 'https://bsyupmesvqwxboncwgeg.supabase.co/auth/v1'
export const DAVIS_CALLBACK_URL = `https://timber-inkfieldnotes.netlify.app${DAVIS_CALLBACK_PATH}`
export const DAVIS_DISCOVERY_URL = 'https://bsyupmesvqwxboncwgeg.supabase.co/.well-known/oauth-authorization-server/auth/v1'
export const DAVIS_PENDING_KEY = 'field-notes.davis.pending-pkce'
const TRANSACTION_MS = 10 * 60_000
interface Config { clientId: string; callbackUrl: string }
interface Discovery { issuer: string; authorization_endpoint: string; token_endpoint: string; resource_indicators_supported?: boolean }
interface Pending { issuer: string; clientId: string; callbackUrl: string; createdAt: number; state: string; verifier: string }
interface Tokens { access: string; refresh?: string; expires: number; accountId: string }
class AccessEnded extends Error {}
interface Dependencies { fetcher: typeof fetch; storage: Storage; now: () => number; crypto: Crypto }
const invalid = () => { throw new Error('Davis connection could not be verified. Reconnect to try again.') }
const obj = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : invalid()
const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const random = (crypto: Crypto) => base64url(crypto.getRandomValues(new Uint8Array(32)))
export async function pkceChallenge(verifier: string, crypto: Crypto = globalThis.crypto): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
}
function endpoint(value: unknown): string {
  if (typeof value !== 'string') return invalid()
  const url = new URL(value)
  if (url.origin !== new URL(DAVIS_ISSUER).origin || !url.pathname.startsWith('/auth/v1/') || url.username || url.password || url.search || url.hash) return invalid()
  return url.href
}
export function validateDiscovery(value: unknown): Discovery {
  const d = obj(value)
  if (d.issuer !== DAVIS_ISSUER || !Array.isArray(d.code_challenge_methods_supported) || !d.code_challenge_methods_supported.includes('S256') || !Array.isArray(d.response_types_supported) || !d.response_types_supported.includes('code') || !Array.isArray(d.token_endpoint_auth_methods_supported) || !d.token_endpoint_auth_methods_supported.includes('none') || !Array.isArray(d.scopes_supported) || !d.scopes_supported.includes('email')) return invalid()
  return { issuer: DAVIS_ISSUER, authorization_endpoint: endpoint(d.authorization_endpoint), token_endpoint: endpoint(d.token_endpoint), resource_indicators_supported: d.resource_indicators_supported === true }
}
export function validateTokens(value: unknown, clientId: string, now: number): Tokens {
  const t = obj(value)
  if (typeof t.access_token !== 'string' || t.access_token.length > 20000 || typeof t.token_type !== 'string' || t.token_type.toLowerCase() !== 'bearer' || typeof t.expires_in !== 'number' || !Number.isFinite(t.expires_in) || t.expires_in <= 0 || (t.refresh_token !== undefined && (typeof t.refresh_token !== 'string' || !t.refresh_token || t.refresh_token.length > 20000)) || (t.scope !== undefined && (typeof t.scope !== 'string' || !t.scope.split(' ').includes('email')))) return invalid()
  let claims: Record<string, unknown>
  try {
    const parts = t.access_token.split('.')
    if (parts.length !== 3) return invalid()
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '=')), (c) => c.charCodeAt(0))
    claims = obj(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))
  } catch { return invalid() }
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (claims.iss !== DAVIS_ISSUER || audience.length !== 1 || audience[0] !== DAVIS_AGENDA_URL || claims.davis_access !== 'field_notes_read' || claims.client_id !== clientId || typeof claims.sub !== 'string' || !claims.sub || typeof claims.exp !== 'number' || !Number.isFinite(claims.exp * 1000) || claims.exp * 1000 <= now || (claims.nbf !== undefined && (typeof claims.nbf !== 'number' || !Number.isFinite(claims.nbf) || claims.nbf * 1000 > now)) || (claims.scope !== undefined && (typeof claims.scope !== 'string' || !claims.scope.split(' ').includes('email')))) return invalid()
  // Claim checks fail closed before use. The agenda server remains responsible
  // for signature verification and current user/household authorization.
  return { access: t.access_token, ...(typeof t.refresh_token === 'string' ? { refresh: t.refresh_token } : {}), expires: Math.min(now + t.expires_in * 1000, claims.exp * 1000), accountId: claims.sub }
}
export function createDavisSession(config: Config, dependencies: Partial<Dependencies> = {}) {
  const deps: Dependencies = { fetcher: fetch, storage: sessionStorage, now: Date.now, crypto: globalThis.crypto, ...dependencies }
  let tokens: Tokens | undefined
  let metadata: Discovery | undefined
  let refresh: Promise<void> | undefined
  let epoch = 0
  let operation: AbortController | undefined
  let refreshOperation: AbortController | undefined
  const configured = () => Boolean(config.clientId.trim()) && config.callbackUrl === DAVIS_CALLBACK_URL
  const clear = () => { epoch++; operation?.abort(); refreshOperation?.abort(); operation = undefined; refreshOperation = undefined; tokens = undefined; refresh = undefined; deps.storage.removeItem(DAVIS_PENDING_KEY) }
  const timed = async <T,>(controller: AbortController, run: () => Promise<T>): Promise<T> => {
    const timer = window.setTimeout(() => controller.abort(), 20_000)
    try { return await run() } finally { window.clearTimeout(timer) }
  }
  const discover = async (signal: AbortSignal): Promise<Discovery> => {
    if (metadata) return metadata
    const response = await deps.fetcher(DAVIS_DISCOVERY_URL, { credentials: 'omit', cache: 'no-store', redirect: 'error', signal })
    if (!response.ok) return invalid()
    const found = validateDiscovery(await response.json()); metadata = found; return found
  }
  const exchange = async (parameters: URLSearchParams, signal: AbortSignal, expectedEpoch: number): Promise<void> => {
    const discovery = await discover(signal)
    const response = await deps.fetcher(discovery.token_endpoint, { method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error', signal, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: parameters })
    if (!response.ok) { if (response.status === 400 || response.status === 401 || response.status === 403) { clear(); throw new AccessEnded('Davis access has ended. Reconnect to continue.') }; return invalid() }
    let received: Tokens
    try { received = validateTokens(await response.json(), config.clientId, deps.now()) } catch { clear(); throw new AccessEnded('Davis access could not be verified. Reconnect to continue.') }
    if (expectedEpoch !== epoch || signal.aborted) return invalid()
    if (tokens && tokens.accountId !== received.accountId) { clear(); throw new AccessEnded('Davis account changed. Reconnect to continue.') }
    tokens = received
  }
  const validAccess = async (signal: AbortSignal): Promise<string> => {
    if (!tokens) throw new AccessEnded('Reconnect to Davis to continue.')
    if (tokens.expires - deps.now() > 30_000) return tokens.access
    if (!tokens.refresh) { clear(); throw new AccessEnded('Reconnect to Davis to continue.') }
    if (!refresh) {
      const previousRefresh = tokens.refresh, previousEpoch = epoch
      const request = new AbortController(); refreshOperation = request
      // A superseded agenda read must not cancel a shared rotating-token
      // exchange. Disconnect and its own deadline still abort that exchange.
      refresh = timed(request, () => exchange(new URLSearchParams({ grant_type: 'refresh_token', refresh_token: previousRefresh, client_id: config.clientId }), request.signal, previousEpoch)).then(() => { if (tokens && !tokens.refresh) tokens.refresh = previousRefresh }).finally(() => { if (previousEpoch === epoch) { refresh = undefined; refreshOperation = undefined } })
    }
    await refresh
    if (!tokens || signal.aborted) return invalid()
    return tokens.access
  }
  return {
    configured,
    clear,
    hasTokens: () => Boolean(tokens),
    async begin(): Promise<string> {
      clear()
      if (!configured()) throw new Error('Davis connection has not been configured.')
      const request = new AbortController(); operation = request; const expectedEpoch = epoch
      return timed(request, async () => {
      const discovery = await discover(request.signal)
      const pending: Pending = { issuer: DAVIS_ISSUER, clientId: config.clientId, callbackUrl: config.callbackUrl, createdAt: deps.now(), state: random(deps.crypto), verifier: random(deps.crypto) }
      const challenge = await pkceChallenge(pending.verifier, deps.crypto)
      if (expectedEpoch !== epoch || request.signal.aborted) return invalid()
      deps.storage.setItem(DAVIS_PENDING_KEY, JSON.stringify(pending))
      const url = new URL(discovery.authorization_endpoint)
      url.search = new URLSearchParams({ response_type: 'code', client_id: config.clientId, redirect_uri: config.callbackUrl, scope: 'email', state: pending.state, code_challenge: challenge, code_challenge_method: 'S256', ...(discovery.resource_indicators_supported ? { resource: DAVIS_AGENDA_URL } : {}) }).toString()
      return url.href
      })
    },
    async callback(url: URL): Promise<{ accountId: string; read: AgendaReader }> {
      const stored = deps.storage.getItem(DAVIS_PENDING_KEY)
      deps.storage.removeItem(DAVIS_PENDING_KEY) // consumed synchronously, including failure
      let p: Pending
      try { p = obj(JSON.parse(stored || 'null')) as unknown as Pending } catch { return invalid() }
      const params = url.searchParams
      if (!configured() || url.origin + url.pathname !== config.callbackUrl || url.hash || params.getAll('state').length !== 1 || params.get('state') !== p.state || typeof p.state !== 'string' || !/^[\w-]{43}$/.test(p.state) || typeof p.verifier !== 'string' || !/^[\w-]{43}$/.test(p.verifier) || p.issuer !== DAVIS_ISSUER || p.clientId !== config.clientId || p.callbackUrl !== config.callbackUrl || !Number.isFinite(p.createdAt) || deps.now() - p.createdAt < 0 || deps.now() - p.createdAt > TRANSACTION_MS || params.getAll('code').length > 1 || params.getAll('error').length > 1 || params.getAll('error_description').length > 1 || params.getAll('iss').length > 1 || (params.has('iss') && params.get('iss') !== DAVIS_ISSUER) || (params.has('code') === params.has('error'))) return invalid()
      if (params.has('error')) throw new Error('Davis connection was not approved. You can reconnect when ready.')
      const code = params.get('code')
      if (!code || code.length > 4096) return invalid()
      operation?.abort(); const request = new AbortController(); operation = request; const expectedEpoch = ++epoch
      await timed(request, () => exchange(new URLSearchParams({ grant_type: 'authorization_code', code, client_id: config.clientId, redirect_uri: config.callbackUrl, code_verifier: p.verifier }), request.signal, expectedEpoch))
      if (!tokens || expectedEpoch !== epoch) return invalid()
      const identity: DavisIdentity = { accountId: tokens.accountId }
      let today: string | undefined
      const read: AgendaReader = async (signal) => {
        const utcDay = new Date(deps.now()).toISOString().slice(0, 10)
        const range = today ? { from: today, to: shiftDate(today, 6) } : { from: shiftDate(utcDay, -1), to: shiftDate(utcDay, 7) }
        let token: string
        try { token = await validAccess(signal) } catch (error) { if (error instanceof AccessEnded) return { status: 401 }; throw error }
        let result = await fetchAgenda(token, range, identity, signal, deps.fetcher)
        if (result.status === 401 || result.status === 403) { clear(); return { status: result.status } }
        if (!result.wire) return { status: result.status }
        identity.householdId ??= result.wire.householdId
        today = result.wire.today
        if (range.from !== today || range.to !== shiftDate(today, 6)) {
          result = await fetchAgenda(token, { from: today, to: shiftDate(today, 6) }, identity, signal, deps.fetcher)
          if (result.status === 401 || result.status === 403) clear()
        }
        if (signal.aborted || expectedEpoch !== epoch) return invalid()
        return { status: result.status, ...(result.wire ? { snapshot: projectAgenda(result.wire) } : {}) }
      }
      return { accountId: tokens.accountId, read }
    },
  }
}
export const davisSession = createDavisSession({ clientId: import.meta.env.VITE_DAVIS_FIELD_NOTES_CLIENT_ID || '', callbackUrl: DAVIS_CALLBACK_URL })
let callbackRun: Promise<void> | undefined
export function completeDavisCallback(): Promise<void> {
  if (callbackRun) return callbackRun
  const url = new URL(location.href)
  history.replaceState(null, '', DAVIS_CALLBACK_PATH) // no code/error/token in retained URL
  callbackRun = (async () => {
    davisAgenda.disconnect()
    const connection = await davisSession.callback(url)
    davisAgenda.connect(connection.accountId, connection.read, davisSession.clear)
    await davisAgenda.refresh()
    if (davisAgenda.getSnapshot().status !== 'ready') { davisAgenda.disconnect(); throw new Error('Davis could not confirm agenda access. Reconnect to try again.') }
  })().catch((error) => { davisSession.clear(); throw error })
  return callbackRun
}
