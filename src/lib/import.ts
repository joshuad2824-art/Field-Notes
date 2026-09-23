import { unzipSync, strFromU8 } from 'fflate'
import { changed, db } from './db'
import { isCutout } from './images'
import {
  COVER_COLORS,
  type FieldEvent,
  type Page,
  type PageImage,
  type Pen,
  type SienaItem,
  type Stock,
  imageIdsIn,
} from './model'
import { addNotebook, allNotebooks, shelfNotebooks } from './notebooks'

/* The way back in. Export has always been a copy rather than a conversion;
   this is the same copy read in the other direction, which is what makes
   "markdown is the storage format" true in both directions rather than a
   promise. Four things stand on this one function: the monthly export becomes
   a backup that can actually be restored, the commonplace book has a door, an
   Apple Notes migration has a path, and a rebuilt device can be fed from a
   folder instead of only from the mirror.

   Three rules, argued in the level-up plan:

   - Upsert by id, never by filename. A page carrying its id lands as itself,
     so restoring twice gets one copy. A file with the same id at the same or
     an older `updated` is skipped whole — which is also what makes pairing
     after a restore reconcile cleanly instead of growing conflict copies.
   - Import is not sync. Everything here is a local write like any other; the
     mirror catches up on its own schedule and nothing in this file knows a
     network exists.
   - A foreign file is welcome. No frontmatter means the whole file is the
     body and the envelope is invented on the spot — a new id, today's
     timestamps, the first notebook. That is an import rather than a restore,
     and importing it twice honestly makes two pages, because there is no id
     to say they are the same one. */

export interface ImportReport {
  added: number
  replaced: number
  skipped: number
  pictures: number
  notebooks: number
  events: number
  sienaItems: number
}

interface BackupData {
  events: FieldEvent[]
  sienaItems: SienaItem[]
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function optionalString(value: unknown, max: number): value is string | undefined {
  return value === undefined || (typeof value === 'string' && value.length <= max)
}

function optionalClock(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === 'string' && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value))
}

function optionalStamp(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value))
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 100 && !/\s/.test(value)
}

/* This file is included only in a whole-shelf export. Validate its shape
   before writing any rows: a hand-edited or unrelated zip is still welcome
   for markdown pages, but cannot smuggle arbitrary objects into the stores. */
function parseBackupData(text: string): BackupData {
  const raw: unknown = JSON.parse(text)
  if (!record(raw) || raw.format !== 'field-notes-data' || raw.version !== 1 ||
      !Array.isArray(raw.events) || !Array.isArray(raw.sienaItems)) throw new Error('Invalid Field Notes backup data')

  const events = raw.events.map((value): FieldEvent => {
    if (!record(value) || !validId(value.id) || typeof value.title !== 'string' ||
        !value.title.trim() || value.title.length > 240 || typeof value.date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value.date) || !optionalClock(value.startTime) ||
        !optionalClock(value.endTime) || !optionalString(value.location, 500) ||
        !optionalString(value.note, 10000) || !optionalString(value.conflictOf, 100) ||
        typeof value.created !== 'number' || !Number.isFinite(value.created) ||
        typeof value.updated !== 'number' || !Number.isFinite(value.updated) ||
        !optionalStamp(value.deleted)) throw new Error('Invalid event in Field Notes backup')
    return {
      id: value.id, title: value.title, date: value.date,
      ...(value.startTime ? { startTime: value.startTime } : {}),
      ...(value.endTime ? { endTime: value.endTime } : {}),
      ...(value.location ? { location: value.location } : {}),
      ...(value.note ? { note: value.note } : {}),
      created: value.created, updated: value.updated,
      ...(value.deleted !== undefined ? { deleted: value.deleted } : {}),
      ...(value.conflictOf ? { conflictOf: value.conflictOf } : {}),
    }
  })

  const sienaItems = raw.sienaItems.map((value): SienaItem => {
    if (!record(value) || !validId(value.id) ||
        typeof value.type !== 'string' || !['note', 'reminder', 'task_update', 'saved'].includes(value.type) ||
        !optionalString(value.title, 240) || typeof value.body !== 'string' ||
        !value.body.trim() || value.body.length > 100000 ||
        !optionalString(value.sourceUrl, 2000) || !optionalString(value.sourceKey, 200) ||
        typeof value.created !== 'number' || !Number.isFinite(value.created) ||
        typeof value.updated !== 'number' || !Number.isFinite(value.updated) ||
        !optionalStamp(value.dueAt) || !optionalStamp(value.seenAt) ||
        (value.type === 'reminder' && value.dueAt === undefined)) throw new Error('Invalid Siena item in Field Notes backup')
    return {
      id: value.id, type: value.type as SienaItem['type'], body: value.body,
      ...(value.title ? { title: value.title } : {}),
      ...(value.sourceUrl ? { sourceUrl: value.sourceUrl } : {}),
      ...(value.sourceKey ? { sourceKey: value.sourceKey } : {}),
      created: value.created, updated: value.updated,
      ...(value.dueAt !== undefined ? { dueAt: value.dueAt } : {}),
      ...(value.seenAt !== undefined ? { seenAt: value.seenAt } : {}),
    }
  })
  return { events, sienaItems }
}

interface ParsedFile {
  meta: Map<string, string>
  body: string
}

/* Export quotes every scalar; older exports and other hands don't. Single
   quotes double their innards, double quotes escape theirs, and a bare value
   is taken as it stands — which is exactly the reader a hand-written file
   needs and the writer never produces. */
function unquote(raw: string): string {
  const v = raw.trim()
  if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) {
    return v.slice(1, -1).replace(/''/g, "'")
  }
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    return v.slice(1, -1).replace(/\\"/g, '"')
  }
  return v
}

/* Frontmatter only if the file opens with `---`, closes it, and everything
   between reads as `key: value`. A page that merely begins with a thematic
   break fails that shape and stays a body — eating someone's writing because
   it looked like metadata would be the worst failure this parser could have. */
function parseFile(text: string): ParsedFile {
  const lines = text.split('\n')
  const meta = new Map<string, string>()
  if (lines[0] === '---') {
    const close = lines.indexOf('---', 1)
    if (close > 0) {
      const between = lines.slice(1, close)
      const pairs = between.map((line) => line.match(/^(\w+):\s*(.*)$/))
      if (pairs.every(Boolean)) {
        for (const m of pairs) meta.set(m![1], unquote(m![2]))
        return { meta, body: trimExportNewline(lines.slice(close + 1).join('\n')) }
      }
    }
  }
  return { meta, body: trimExportNewline(text) }
}

/* Export appends one newline when the body lacks it, so a file always ends in
   exactly one more than the page did. Taking one back is the smaller lie: a
   body that genuinely ended in a newline loses an invisible character, where
   not taking it grows one on every round trip. */
function trimExportNewline(body: string): string {
  return body.endsWith('\n') ? body.slice(0, -1) : body
}

function uuid(): string {
  if (crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function parseStamp(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const at = Date.parse(raw)
  return Number.isNaN(at) ? fallback : at
}

const MIME_FOR: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
}

/* Notebooks arrive as names, because that is what the frontmatter says and
   what a person renaming folders on disk would expect to matter. A name the
   shelf already has — case blind — is that notebook; one it hasn't is added,
   coloured from the palette like any other. */
async function resolveNotebook(
  name: string | undefined,
  cache: Map<string, string>,
  report: ImportReport,
): Promise<string> {
  const fallback = shelfNotebooks()[0]?.id ?? 'field-notes'
  const trimmed = name?.trim()
  if (!trimmed) return fallback
  const known = cache.get(trimmed.toLowerCase())
  if (known) return known
  const book = await addNotebook(trimmed, COVER_COLORS[cache.size % COVER_COLORS.length])
  cache.set(trimmed.toLowerCase(), book.id)
  report.notebooks++
  return book.id
}

async function applyPage(
  parsed: ParsedFile,
  books: Map<string, string>,
  report: ImportReport,
): Promise<Page | null> {
  const { meta, body } = parsed
  const now = Date.now()
  const id = meta.get('id')?.trim() || uuid()
  if (id.length > 64 || /\s/.test(id)) return null

  const incoming: Page = {
    id,
    notebook: await resolveNotebook(meta.get('notebook'), books, report),
    body,
    created: parseStamp(meta.get('created'), now),
    updated: parseStamp(meta.get('updated'), now),
    pinned: meta.get('pinned') === 'true' ? 1 : 0,
  }
  const date = meta.get('date')
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) incoming.entryDate = date
  const pen = meta.get('pen')
  if (pen === 'felt') incoming.pen = pen as Pen
  const stock = meta.get('stock')
  if (stock === 'night') incoming.stock = stock as Stock

  const standing = await db.pages.get(id)
  if (!standing) {
    await db.pages.put(incoming)
    report.added++
    return incoming
  }
  if (standing.deleted) {
    /* Importing over a tombstone is a person deliberately reaching into a
       backup for a page they deleted. That is a fresh local write and gets a
       fresh stamp — an old `updated` would lose to the mirror's tombstone on
       the next sync and the page would quietly vanish twice. */
    await db.pages.put({ ...incoming, updated: Date.now() })
    report.added++
    return incoming
  }
  if (incoming.updated <= standing.updated) {
    report.skipped++
    return standing
  }
  await db.pages.put(incoming)
  report.replaced++
  return incoming
}

/* The bytes ride at `images/<id>.<ext>` — the same path the markdown says —
   whatever folder the zip nests them under. */
const IMAGE_PATH = /(?:^|\/)images\/([\w-]+)\.(\w+)$/

async function applyImages(
  page: Page,
  bytes: Map<string, { data: Uint8Array; ext: string }>,
  report: ImportReport,
): Promise<void> {
  for (const id of imageIdsIn(page.body)) {
    const found = bytes.get(id)
    if (!found) continue
    if (await db.images.get(id)) continue
    const type = MIME_FOR[found.ext.toLowerCase()] ?? 'image/png'
    const blob = new Blob([found.data as BlobPart], { type })
    const record: PageImage = {
      id,
      page: page.id,
      blob,
      type,
      ext: found.ext.toLowerCase(),
      cutout: await isCutout(blob),
      added: Date.now(),
    }
    await db.images.put(record)
    report.pictures++
  }
}

export async function importFiles(files: File[]): Promise<ImportReport> {
  const report: ImportReport = { added: 0, replaced: 0, skipped: 0, pictures: 0, notebooks: 0, events: 0, sienaItems: 0 }
  const texts: string[] = []
  const backups: BackupData[] = []
  const bytes = new Map<string, { data: Uint8Array; ext: string }>()

  for (const file of files) {
    if (/\.zip$/i.test(file.name) || file.type === 'application/zip') {
      const entries = unzipSync(new Uint8Array(await file.arrayBuffer()))
      for (const [path, data] of Object.entries(entries)) {
        if (!data.length) continue
        const image = path.match(IMAGE_PATH)
        if (image) bytes.set(image[1], { data, ext: image[2] })
        else if (path === 'field-notes-data.json') backups.push(parseBackupData(strFromU8(data)))
        else if (/\.(md|markdown)$/i.test(path)) texts.push(strFromU8(data))
      }
    } else if (/\.(md|markdown|txt)$/i.test(file.name) || file.type.startsWith('text/')) {
      texts.push(await file.text())
    }
  }

  const books = new Map(allNotebooks().map((b) => [b.name.trim().toLowerCase(), b.id]))
  for (const text of texts) {
    const page = await applyPage(parseFile(text), books, report)
    if (page) await applyImages(page, bytes, report)
  }

  for (const backup of backups) {
    for (const event of backup.events) {
      const standing = await db.events.get(event.id)
      if (!standing || event.updated > standing.updated) {
        await db.events.put(event)
        report.events++
      }
    }
    for (const item of backup.sienaItems) {
      const standing = await db.sienaItems.get(item.id)
      if (!standing || item.updated > standing.updated) {
        await db.sienaItems.put(item)
        report.sienaItems++
      }
    }
  }

  if (report.added || report.replaced || report.pictures || report.notebooks || report.events || report.sienaItems) changed()
  return report
}
