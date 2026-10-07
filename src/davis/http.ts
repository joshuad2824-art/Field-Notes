import { DAVIS_AGENDA_URL } from './agenda'
import { decodeAgenda, validateRange, type AgendaRange, type DavisIdentity, type DavisAgendaSnapshot } from './wire'

export async function fetchAgenda(token: string, range: AgendaRange, identity: DavisIdentity, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<{ status: number; wire?: DavisAgendaSnapshot }> {
  validateRange(range)
  const url = new URL(DAVIS_AGENDA_URL)
  url.searchParams.set('from', range.from); url.searchParams.set('to', range.to)
  const response = await fetcher(url, { method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error', signal, headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) return { status: response.status }
  const length = response.headers.get('content-length')
  if (length && Number(length) > 2_000_000) throw new Error('Davis agenda exceeds its size limit')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Davis agenda is unavailable')
  const chunks: Uint8Array[] = []; let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > 2_000_000) { await reader.cancel(); throw new Error('Davis agenda exceeds its size limit') }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return { status: 200, wire: decodeAgenda(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), range, identity) }
}
