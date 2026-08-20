import type { Place } from './place'

/* The second — and last — file in the app that calls `fetch`.

   Open-Meteo, and the reason is the fourth sentence of the architecture note:
   one person maintains this, in spare hours, for years. It needs no API key,
   so there is no secret to keep out of the bundle and nothing to rotate; no
   account, so there is nothing to be locked out of; and no attribution widget
   to carry. Every alternative wanted a key, and a key in a client-side build
   is a key in public anyway — which would have meant a server, for weather.

   Same discipline as `src/sync/transport.ts`: nothing above this file knows a
   network exists, every failure leaves the app exactly as it was, and a failure
   here costs one line of chrome. */

export type Unit = 'C' | 'F'

export interface Reading {
  temp: number
  high: number
  low: number
  /* WMO code — `conditionWord` turns it into the one word shown. */
  code: number
  unit: Unit
  /* When this was fetched, so staleness is the store's business and not a
     guess made at render time. */
  at: number
}

const FORECAST = 'https://api.open-meteo.com/v1/forecast'
const GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search'

async function ask(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`weather answered ${response.status}`)
  return response.json()
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export async function forecast(
  place: Place,
  unit: Unit,
  signal?: AbortSignal,
): Promise<Reading | null> {
  const query = new URLSearchParams({
    latitude: String(place.lat),
    longitude: String(place.lon),
    current: 'temperature_2m,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
    forecast_days: '1',
  })
  if (unit === 'F') query.set('temperature_unit', 'fahrenheit')

  const body = (await ask(`${FORECAST}?${query}`, signal)) as {
    current?: { temperature_2m?: unknown; weather_code?: unknown }
    daily?: { temperature_2m_max?: unknown[]; temperature_2m_min?: unknown[] }
  }

  const temp = num(body.current?.temperature_2m)
  const code = num(body.current?.weather_code)
  const high = num(body.daily?.temperature_2m_max?.[0])
  const low = num(body.daily?.temperature_2m_min?.[0])
  /* A reading missing its current temperature is not a reading. The day's
     range is allowed to be absent — some places, some hours — and the line
     simply says less rather than nothing. */
  if (temp === null || code === null) return null

  return {
    temp,
    code,
    high: high ?? temp,
    low: low ?? temp,
    unit,
    at: Date.now(),
  }
}

export interface Found extends Place {
  label: string
}

/* For the Settings fallback: a name typed by hand becomes coordinates. Same
   service, same absence of a key. */
export async function geocode(name: string, signal?: AbortSignal): Promise<Found[]> {
  const trimmed = name.trim()
  if (trimmed.length < 2) return []
  const query = new URLSearchParams({ name: trimmed, count: '5', format: 'json' })
  const body = (await ask(`${GEOCODE}?${query}`, signal)) as {
    results?: {
      name?: string
      latitude?: number
      longitude?: number
      country?: string
      admin1?: string
    }[]
  }
  return (body.results ?? [])
    .filter((r) => num(r.latitude) !== null && num(r.longitude) !== null && r.name)
    .map((r) => ({
      lat: r.latitude as number,
      lon: r.longitude as number,
      /* "York, North Yorkshire, United Kingdom" is how you tell one York from
         the other four the search will have found. */
      label: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
      chosen: true,
    }))
}
