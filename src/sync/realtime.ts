import { RealtimeClient, type RealtimeChannel } from '@supabase/realtime-js'
import type { Vault } from './pairing'

/* The doorbell. The second leaf in this app that talks to the mirror, and the
   only one that holds a socket open.

   It carries no writing at all — not a title, not an id. When a device has
   pushed something it rings, and every other paired device that is awake
   hears it and runs an ordinary sync at once instead of waiting for its next
   heartbeat. So an iPad sitting open on Today shows what the phone just wrote
   within a second or two, and everything about *what* crosses the wire is
   still decided by the same pull, reconcile and push as before.

   It is a Realtime broadcast channel, deliberately not a subscription to row
   changes: the rows are guarded by a policy that reads the vault key from the
   request headers, and a socket has no request headers to read, so row events
   would never be delivered. A broadcast needs no table and no policy. The
   channel's name is a hash of the vault key under its own label, so it is
   neither the key nor the id the rows are stamped with; anyone who somehow
   knew it could ring the bell and make the devices check for nothing.

   If the project refuses the channel, or the socket can't stay up, nothing
   breaks: `doorbellLive()` stays false and the engine keeps its one-minute
   heartbeat instead. */

let client: RealtimeClient | null = null
let channel: RealtimeChannel | null = null
let live = false
let generation = 0

async function topicFor(vault: Vault): Promise<string> {
  const bytes = new TextEncoder().encode(`field-notes.doorbell:${vault.key}`)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return 'fn-' + [...digest.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function doorbellLive(): boolean {
  return live
}

/* `rung` is called when another device rings, and once each time the channel
   (re)joins, since anything rung while the socket was down was missed. */
export async function startDoorbell(vault: Vault, rung: () => void): Promise<void> {
  stopDoorbell()
  const mine = ++generation
  let topic: string
  try {
    topic = await topicFor(vault)
  } catch {
    return
  }
  if (mine !== generation) return
  try {
    client = new RealtimeClient(`${vault.url.replace(/^http/i, 'ws')}/realtime/v1`, {
      params: { apikey: vault.anonKey },
      heartbeatIntervalMs: 25_000,
    })
    channel = client.channel(topic, { config: { broadcast: { self: false, ack: false } } })
    channel.on('broadcast', { event: 'ring' }, () => rung())
    channel.subscribe((status) => {
      if (mine !== generation) return
      const was = live
      live = status === 'SUBSCRIBED'
      if (live && !was) rung()
    })
  } catch {
    live = false
  }
}

/* After this device has pushed something. Over the socket when it is up;
   realtime-js falls back to a plain request when it isn't. Never awaited by
   anything that matters, and a failure costs only the other devices' speed. */
export function ring(): void {
  const open = channel
  if (!open) return
  void open.send({ type: 'broadcast', event: 'ring', payload: {} }).catch(() => {})
}

export function stopDoorbell(): void {
  generation++
  live = false
  const old = client
  client = null
  channel = null
  if (old) {
    void old.removeAllChannels().catch(() => {})
    void Promise.resolve()
      .then(() => old.disconnect())
      .catch(() => {})
  }
}
