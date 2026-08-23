import { getModelKey } from './key'

/* The third — and, for the third time, hopefully last — file in the app that
   calls `fetch`.

   `src/sync/transport.ts` talks to the user's own mirror. `weather/open-meteo.ts`
   asks a keyless service what the sky is doing. This one hands a week of the
   user's own writing to a model and gets prose back, and it is the only place
   in the app where page text leaves the device to anyone but the user's own
   Supabase. That is a real cost and it is why nothing here runs unless a key
   has been pasted and the consent line has been answered — the collected week
   is a complete entry on its own and this is laid on top of it.

   `open-meteo.ts` opens by explaining that Open-Meteo was chosen because it
   needs no key, and that a key in a client build is a key in public, "which
   would have meant a server, for weather." That reasoning still holds for
   weather. It does not generalise to this: the key here is not shipped in the
   bundle, it is typed into one device by the one person who uses the app, and
   it can be deleted from Settings in a tap. There is nothing public about it.

   Same discipline as the other two: nothing above this file knows a network
   exists, and every failure it can have leaves the page exactly as it was. */

const ENDPOINT = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-5'

/* Straight from the browser, which needs saying out loud: Anthropic's API
   refuses a browser request unless it is asked to allow one. Sending it from
   here rather than from a function of ours is the same trade the vault key
   already makes — no server, and therefore nothing of ours to keep running. */
const BROWSER_HEADER = 'anthropic-dangerous-direct-browser-access'

const SYSTEM = `You are helping one person keep a journal.

You will be given a mechanically assembled digest of everything they wrote in one week, across several notebooks, grouped by day. Rewrite it as a single journal entry that retells the week: what went on, what was worked on, what was thought.

Rules:
- Write in the first person, as them, in plain unshowy English.
- Follow the week in order. Keep the day headings as "## " sections where a day had something in it; drop days that had nothing.
- Keep the first line as the "# " heading it already has, unchanged.
- Prefer their own words and phrases where they said something well. Do not invent events, names, dates or feelings that are not in the material.
- No preamble, no sign-off, no summary of what you did. Return only the entry.
- Markdown only, and only the marks already in the source: headings, emphasis, lists, quotes, links, tags.`

export interface WriteupFailure {
  message: string
  /* True when the request never left — no network, or a key a header cannot
     hold. The distinction matters for the same reason it does in the sync
     transport: one of these is weather and the other is a setup that will
     never work until something is changed. */
  offline: boolean
}

export class WriteupError extends Error implements WriteupFailure {
  offline: boolean
  constructor(message: string, offline = false) {
    super(message)
    this.offline = offline
  }
}

interface Reply {
  content?: { type?: string; text?: string }[]
  error?: { message?: string }
}

export async function writeUp(digest: string, signal?: AbortSignal): Promise<string> {
  const key = getModelKey()
  if (!key) throw new WriteupError('No key yet.')

  let response: Response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        [BROWSER_HEADER]: 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM,
        messages: [{ role: 'user', content: digest }],
      }),
    })
  } catch {
    throw new WriteupError(
      'Could not reach the model. Nothing was sent and the page is untouched.',
      true,
    )
  }

  if (response.status === 401 || response.status === 403) {
    throw new WriteupError('That key was refused. Check it in Settings.')
  }
  if (!response.ok) {
    let detail = ''
    try {
      detail = ((await response.json()) as Reply).error?.message ?? ''
    } catch {
      /* a body that isn't JSON tells us nothing we can use */
    }
    throw new WriteupError(detail || `The model answered ${response.status}.`)
  }

  const body = (await response.json()) as Reply
  const text = (body.content ?? [])
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text as string)
    .join('')
    .trim()

  /* An empty answer is a failure, not a page. Replacing a week's digest with
     nothing would be the one way this feature could actually lose writing. */
  if (!text) throw new WriteupError('The model sent nothing back. The page is untouched.')
  return text + '\n'
}
