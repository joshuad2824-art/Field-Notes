/* Apple Calendar, one way in.

   Reads Joshua's published iCloud calendar and hands Field Notes the events for
   a window of days. It cannot write to Apple Calendar: it only ever fetches a
   feed, and nothing here sends anything back.

   The feed address is a secret (APPLE_CALENDAR_FEED_URL). Anyone holding it can
   read the calendar, so it lives in this project's function secrets and nowhere
   else: not in the app, not in the repository, not in a response.

   Who may ask: the same key that opens the vault. The request carries the
   x-vault-key header the sync mirror already uses, and this function asks the
   mirror, with the caller's own headers, whether that vault exists. A request
   with no key, or a wrong one, sees an empty database and is turned away. */

import { expandIcs, isoToDayNumber, validZone } from '../_shared/ics.ts'

const MAX_WINDOW_DAYS = 400
const MAX_FEED_BYTES = 8_000_000
const FRESH_MS = 60_000 // one fetch of the feed per minute at most
const STALE_OK_MS = 60 * 60_000 // a feed that is down is covered for an hour

const ORIGINS = [
  /^https:\/\/([a-z0-9-]+--)?timber-inkfieldnotes\.netlify\.app$/,
  /^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}$/,
]

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') ?? ''
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, apikey, x-vault-key, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
  if (ORIGINS.some((pattern) => pattern.test(origin))) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

function reply(request: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

/* The mirror's row policy compares the hash of the presented key with each
   row's vault. A real vault returns its rows; anything else returns none. */
async function knownVault(request: Request): Promise<boolean> {
  const key = request.headers.get('x-vault-key') ?? ''
  const apikey = request.headers.get('apikey') ?? ''
  const base = Deno.env.get('SUPABASE_URL')
  if (key.length < 16 || !apikey || !base) return false
  for (const table of ['notebooks', 'pages']) {
    try {
      const response = await fetch(`${base}/rest/v1/${table}?select=id&limit=1`, {
        headers: { apikey, Authorization: `Bearer ${apikey}`, 'x-vault-key': key },
        signal: AbortSignal.timeout(8000),
      })
      if (!response.ok) return false
      const rows = await response.json()
      if (Array.isArray(rows) && rows.length > 0) return true
    } catch {
      return false
    }
  }
  return false
}

function feedAddress(): URL | null {
  const raw = Deno.env.get('APPLE_CALENDAR_FEED_URL')?.trim()
  if (!raw) return null
  try {
    const url = new URL(raw.replace(/^webcal:/i, 'https:'))
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.icloud.com')) return null
    return url
  } catch {
    return null
  }
}

let cached: { at: number; text: string } | null = null

async function readFeed(url: URL): Promise<{ text: string; at: number; stale: boolean }> {
  if (cached && Date.now() - cached.at < FRESH_MS) return { ...cached, stale: false }
  try {
    const response = await fetch(url, {
      headers: { Accept: 'text/calendar, text/plain;q=0.8, */*;q=0.5' },
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
    })
    // Whatever it redirected to must still be iCloud.
    if (!response.ok || !new URL(response.url).hostname.endsWith('.icloud.com')) {
      throw new Error(`feed answered ${response.status}`)
    }
    const text = await response.text()
    if (text.length > MAX_FEED_BYTES) throw new Error('feed too large')
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('feed is not a calendar')
    cached = { at: Date.now(), text }
    return { ...cached, stale: false }
  } catch (error) {
    if (cached && Date.now() - cached.at < STALE_OK_MS) return { ...cached, stale: true }
    throw error
  }
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) })
  if (request.method !== 'GET') return reply(request, 405, { error: 'method_not_allowed' })

  if (!(await knownVault(request))) return reply(request, 401, { error: 'unauthorized' })

  const params = new URL(request.url).searchParams
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const real = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
  if (!real(from) || !real(to) || from > to || isoToDayNumber(to) - isoToDayNumber(from) >= MAX_WINDOW_DAYS) {
    return reply(request, 400, { error: 'invalid_range', maxDays: MAX_WINDOW_DAYS })
  }
  const zone = params.get('tz') ?? ''
  if (!zone || !validZone(zone)) return reply(request, 400, { error: 'invalid_timezone' })

  const address = feedAddress()
  if (!address) return reply(request, 503, { error: 'not_configured' })

  try {
    const feed = await readFeed(address)
    const result = expandIcs(feed.text, from, to, zone)
    return reply(request, 200, {
      schemaVersion: 1,
      readOnly: true,
      source: 'apple-calendar',
      ...(result.calendarName ? { calendarName: result.calendarName } : {}),
      timezone: zone,
      from,
      to,
      fetchedAt: new Date(feed.at).toISOString(),
      stale: feed.stale,
      skipped: result.skipped,
      truncated: result.truncated,
      events: result.events,
    })
  } catch (error) {
    // The address is a secret, so only the kind of failure is logged.
    console.error('apple-calendar:', error instanceof Error ? error.message.replace(/https?:\/\/\S+/g, '[url]') : 'failed')
    return reply(request, 502, { error: 'feed_unavailable' })
  }
})
