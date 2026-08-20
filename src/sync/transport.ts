import { firstUnsafe, headerSafe, looksTruncated, type Vault } from './pairing'
import type { Row, TableName } from './wire'

/* The only file in the app that knows a network exists.

   Everything above it — the editor, the store, the reconciler — is written as
   though there were nothing here at all, and that is not a convention. A write
   goes to IndexedDB and returns; this runs afterwards, on its own schedule,
   and every failure it can have is a failure that leaves the page exactly as
   it was. */

export class SyncError extends Error {
  /* True when the mirror genuinely could not be reached — no wifi, aeroplane
     mode, a paused project, a project URL with a typo in it. Worth telling
     apart from a refusal, because one of them passes on its own and the other
     will still be there tomorrow.

     It is deliberately *not* set for every thrown fetch. A browser reports a
     blocked request and an unreachable host identically, and calling both of
     them "offline — it will catch up" is how a permanently broken setup gets
     to look like weather. `diagnose` below is what tells them apart. */
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
  /* Asked only after something has already gone wrong, to work out which of
     the several quite different things it was. */
  diagnose(): Promise<Diagnosis>
}

export interface Diagnosis {
  /* Whether the mirror could be reached at all. False is weather — no wifi, a
     paused project — and passes on its own. True with a failed sync is a
     setup that will still be broken tomorrow, and says so. */
  reachable: boolean
  message: string
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
    } catch (error) {
      /* Whatever the browser actually said. It is usually one unhelpful word,
         but one unhelpful word is still more than none, and the console beside
         it will have the long version. */
      const said = error instanceof Error ? error.message : String(error)
      throw new SyncError(`The request never left: ${said}`, 0, false)
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

    /* Run only after a request has already failed to leave, because the
       browser refuses to say which of these it was — a blocked request and an
       unreachable host are the same TypeError with the same one-word message.

       So ask a second, plainer question: the same project, the same anon key,
       and *no* vault-key header. What comes back separates the three cases
       that need quite different things done about them. */
    async diagnose() {
      const unreachable = (message: string) => ({ reachable: false, message })
      const reached = (message: string) => ({ reachable: true, message })

      /* Ask this before anything about the network. A key with a stray
         character in it makes `fetch` refuse to build the headers and throw
         before it opens a socket — which is indistinguishable, from the catch
         block, from a host that isn't there. Blaming the project URL for it
         sends you to check a dashboard that was fine all along. */
      for (const [what, value, remedy] of [
        ['anon key', vault.anonKey, 'Unpair, and copy it from the project API settings again.'],
        ['vault key', vault.key, 'Pair this device again from the code.'],
      ] as const) {
        if (looksTruncated(value)) {
          return reached(
            `The ${what} has an ellipsis in it, so what was pasted is a shortened display of it rather than the whole thing. ${remedy}`,
          )
        }
        if (!headerSafe(value)) {
          return reached(
            `The ${what} contains ${firstUnsafe(value)}, which cannot go in a request, so nothing was ever sent. ${remedy}`,
          )
        }
      }

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return unreachable('This device has no network at all. It will catch up on its own.')
      }

      let bare: Response
      try {
        bare = await fetch(`${base}/pages?select=id&limit=0`, {
          headers: { apikey: vault.anonKey, Authorization: `Bearer ${vault.anonKey}` },
        })
      } catch {
        /* Not reachable even asking plainly. The host, not the request. */
        return unreachable(
          `Couldn't reach ${vault.url} at all — check the project URL, and whether the project is paused.`,
        )
      }

      if (bare.status === 404) {
        return reached(
          "Reached the project, but it has no `pages` table — supabase/schema.sql hasn't been run, or didn't finish.",
        )
      }
      if (bare.status === 401 || bare.status === 403) {
        return reached(
          'Reached the project, but the anon key was refused. Copy it again from the project API settings.',
        )
      }
      if (!bare.ok) {
        return reached(`Reached the project and it answered ${bare.status} to a plain request.`)
      }

      /* The project is there, the table is there, the anon key is good — and
         the only difference between that request and the one that failed is
         the vault-key header. Which means the browser is refusing to send it,
         and that is a CORS preflight, not anything about the vault. */
      return reached(
        'Reached the project fine without the vault key, so the browser is blocking the x-vault-key header itself (a CORS preflight). This one is ours to fix, not yours.',
      )
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
