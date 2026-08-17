import type { Vault } from './pairing'
import type { Row, TableName } from './wire'

/* The only file in the app that knows a network exists.

   Everything above it — the editor, the store, the reconciler — is written as
   though there were nothing here at all, and that is not a convention. A write
   goes to IndexedDB and returns; this runs afterwards, on its own schedule,
   and every failure it can have is a failure that leaves the page exactly as
   it was. */

export class SyncError extends Error {
  /* True when the network never answered — no wifi, aeroplane mode, a paused
     project. Worth telling apart from a real refusal, because one of them is
     nothing to act on and the other means the vault is wrong. */
  readonly offline: boolean
  readonly status: number
  constructor(message: string, status = 0, offline = false) {
    super(message)
    this.name = 'SyncError'
    this.status = status
    this.offline = offline
  }
}

export interface Transport {
  /* Rows stamped at or after the cursor, oldest first. `gte` rather than `gt`
     so a row written in the same instant as the cursor can't fall through the
     gap; applying a row twice is a no-op, missing one is not. */
  since(table: TableName, cursor: string, limit: number): Promise<Row[]>
  byId(table: TableName, ids: string[]): Promise<Row[]>
  put(table: TableName, rows: Row[]): Promise<void>
}

export const EPOCH = '1970-01-01T00:00:00Z'

export function supabaseTransport(vault: Vault): Transport {
  const base = `${vault.url}/rest/v1`

  const headers = (extra: Record<string, string> = {}) => ({
    apikey: vault.anonKey,
    Authorization: `Bearer ${vault.anonKey}`,
    /* The whole of the authentication. It never expires, there is no session
       behind it, and the server only ever compares its hash. */
    'x-vault-key': vault.key,
    ...extra,
  })

  const call = async (path: string, init: RequestInit): Promise<Response> => {
    let response: Response
    try {
      response = await fetch(base + path, init)
    } catch {
      throw new SyncError('No answer from the mirror.', 0, true)
    }
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 200)
      throw new SyncError(
        response.status === 401 || response.status === 403
          ? 'The vault key was refused.'
          : `The mirror answered ${response.status}. ${detail}`.trim(),
        response.status,
      )
    }
    return response
  }

  return {
    async since(table, cursor, limit) {
      const query =
        `?select=*&vault=eq.${encodeURIComponent(vault.id)}` +
        `&server_at=gte.${encodeURIComponent(cursor)}` +
        `&order=server_at.asc&limit=${limit}`
      const response = await call(`/${table}${query}`, { headers: headers() })
      return (await response.json()) as Row[]
    },

    async byId(table, ids) {
      if (!ids.length) return []
      const list = ids.map((id) => `"${id.replace(/"/g, '')}"`).join(',')
      const query =
        `?select=*&vault=eq.${encodeURIComponent(vault.id)}` +
        `&id=in.(${encodeURIComponent(list)})`
      const response = await call(`/${table}${query}`, { headers: headers() })
      return (await response.json()) as Row[]
    },

    async put(table, rows) {
      if (!rows.length) return
      await call(`/${table}?on_conflict=vault,id`, {
        method: 'POST',
        headers: headers({
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        }),
        body: JSON.stringify(rows),
      })
    },
  }
}
