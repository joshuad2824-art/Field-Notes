import type { FieldEvent, Notebook, Page, PageImage, SienaItem, SienaItemKind } from '../lib/model'

/* The envelope on the wire. Deliberately the same shape as the one on the
   device, in snake case because that is what Postgres wants, and with nothing
   added but the stamp the mirror puts on. There is no document tree here and
   there never will be — a page is a markdown string and eight small fields,
   which is the reason conflict handling is tractable at all. */

export interface Row {
  vault: string
  id: string
  server_at?: string
}

export interface PageRow extends Row {
  notebook: string
  body: string
  created: number
  updated: number
  pinned: number
  purpose: string | null
  entry_date: string | null
  pen: string | null
  stock: string | null
  deleted: number | null
}

export interface NotebookRow extends Row {
  name: string
  color: string
  ord: number
  updated: number
  deleted: number | null
}

export interface ImageRow extends Row {
  page: string
  mime: string
  ext: string
  cutout: boolean
  added: number
  bytes: string
}

export interface EventRow extends Row {
  title: string
  date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  note: string | null
  page_id: string | null
  calendar_target: string | null
  created: number
  updated: number
  deleted: number | null
  conflict_of: string | null
}

export interface SienaItemRow extends Row {
  kind: SienaItemKind
  title: string | null
  body: string
  source_url: string | null
  source_key: string | null
  due_at: number | null
  seen_at: number | null
  notebook: string | null
  completed_at: number | null
  created: number
  updated: number
}

export const TABLES = ['pages', 'notebooks', 'images', 'events', 'siena_items'] as const
export type TableName = (typeof TABLES)[number]

/* ── pages ─────────────────────────────────────────────────────────────── */

export function pageToRow(page: Page, vault: string): PageRow {
  return {
    vault,
    id: page.id,
    notebook: page.notebook,
    body: page.body,
    created: page.created,
    updated: page.updated,
    pinned: page.pinned,
    purpose: page.purpose ?? null,
    entry_date: page.entryDate ?? null,
    pen: page.pen ?? null,
    stock: page.stock ?? null,
    deleted: page.deleted ?? null,
  }
}

export function rowToPage(row: PageRow): Page {
  const page: Page = {
    id: row.id,
    notebook: row.notebook,
    body: row.body ?? '',
    created: Number(row.created),
    updated: Number(row.updated),
    pinned: row.pinned ? 1 : 0,
  }
  if (row.purpose === 'reminders') page.purpose = 'reminders'
  /* Absent rather than null, because "unset" is what makes a page follow the
     app default for pen and stock. A null stored on the page would be a third
     state nothing reads. */
  if (row.entry_date) page.entryDate = row.entry_date
  if (row.pen === 'ink' || row.pen === 'felt') page.pen = row.pen
  if (row.stock === 'paper' || row.stock === 'night') page.stock = row.stock
  if (row.deleted) page.deleted = Number(row.deleted)
  return page
}

/* ── notebooks ─────────────────────────────────────────────────────────── */

export function notebookToRow(book: Notebook, vault: string): NotebookRow {
  return {
    vault,
    id: book.id,
    name: book.name,
    color: book.color,
    ord: book.order,
    updated: book.updated ?? 0,
    deleted: book.deleted ?? null,
  }
}

export function rowToNotebook(row: NotebookRow): Notebook {
  const book: Notebook = {
    id: row.id,
    name: row.name,
    color: row.color,
    order: Number(row.ord) || 0,
    updated: Number(row.updated) || 0,
  }
  if (row.deleted) book.deleted = Number(row.deleted)
  return book
}

export function sameNotebook(a: Notebook, b: Notebook): boolean {
  return (
    a.name === b.name && a.color === b.color && a.order === b.order && !a.deleted === !b.deleted
  )
}

/* ── events ────────────────────────────────────────────────────────────── */

export function eventToRow(event: FieldEvent, vault: string): EventRow {
  return {
    vault, id: event.id, title: event.title, date: event.date,
    start_time: event.startTime ?? null, end_time: event.endTime ?? null,
    location: event.location ?? null, note: event.note ?? null,
    page_id: event.pageId ?? null, calendar_target: event.calendarTarget ?? null,
    created: event.created, updated: event.updated, deleted: event.deleted ?? null,
    conflict_of: event.conflictOf ?? null,
  }
}

export function rowToEvent(row: EventRow): FieldEvent {
  return {
    id: row.id, title: row.title, date: row.date,
    created: Number(row.created), updated: Number(row.updated),
    ...(row.start_time ? { startTime: row.start_time } : {}),
    ...(row.end_time ? { endTime: row.end_time } : {}),
    ...(row.location ? { location: row.location } : {}),
    ...(row.note ? { note: row.note } : {}),
    ...(row.page_id ? { pageId: row.page_id } : {}),
    ...(row.calendar_target === 'Joshua' || row.calendar_target === 'Family'
      ? { calendarTarget: row.calendar_target } : {}),
    ...(row.deleted ? { deleted: Number(row.deleted) } : {}),
    ...(row.conflict_of ? { conflictOf: row.conflict_of } : {}),
  }
}

export function sameEvent(a: FieldEvent, b: FieldEvent): boolean {
  return a.title === b.title && a.date === b.date &&
    (a.startTime ?? '') === (b.startTime ?? '') && (a.endTime ?? '') === (b.endTime ?? '') &&
    (a.location ?? '') === (b.location ?? '') && (a.note ?? '') === (b.note ?? '') &&
    (a.pageId ?? '') === (b.pageId ?? '') && (a.calendarTarget ?? '') === (b.calendarTarget ?? '') &&
    !!a.deleted === !!b.deleted && (a.conflictOf ?? '') === (b.conflictOf ?? '')
}

/* ── the quiet Siena inbox ─────────────────────────────────────────────── */

export function sienaItemToRow(item: SienaItem, vault: string): SienaItemRow {
  return {
    vault, id: item.id, kind: item.type, title: item.title ?? null,
    body: item.body, source_url: item.sourceUrl ?? null,
    source_key: item.sourceKey ?? null,
    due_at: item.dueAt ?? null, seen_at: item.seenAt ?? null,
    notebook: item.notebook ?? null, completed_at: item.completedAt ?? null,
    created: item.created, updated: item.updated,
  }
}

export function rowToSienaItem(row: SienaItemRow): SienaItem {
  return {
    id: row.id, type: row.kind, body: row.body,
    created: Number(row.created), updated: Number(row.updated),
    ...(row.title ? { title: row.title } : {}),
    ...(row.source_url ? { sourceUrl: row.source_url } : {}),
    ...(row.source_key ? { sourceKey: row.source_key } : {}),
    ...(row.due_at ? { dueAt: Number(row.due_at) } : {}),
    ...(row.seen_at ? { seenAt: Number(row.seen_at) } : {}),
    ...(row.notebook ? { notebook: row.notebook } : {}),
    ...(row.completed_at ? { completedAt: Number(row.completed_at) } : {}),
  }
}

export function sameSienaItem(a: SienaItem, b: SienaItem): boolean {
  return a.id === b.id && a.type === b.type && a.body === b.body &&
    (a.title ?? '') === (b.title ?? '') && (a.sourceUrl ?? '') === (b.sourceUrl ?? '') &&
    (a.sourceKey ?? '') === (b.sourceKey ?? '') && (a.dueAt ?? 0) === (b.dueAt ?? 0) &&
    (a.seenAt ?? 0) === (b.seenAt ?? 0) && (a.notebook ?? '') === (b.notebook ?? '') &&
    (a.completedAt ?? 0) === (b.completedAt ?? 0) && a.created === b.created && a.updated === b.updated
}

/* ── pictures ──────────────────────────────────────────────────────────── */

/* Chunked, because a photograph is a few million bytes and spreading those
   across the argument list of one call is how you find the engine's limit. */
function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step))
  }
  return btoa(binary)
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function imageToRow(image: PageImage, vault: string): Promise<ImageRow> {
  return {
    vault,
    id: image.id,
    page: image.page,
    mime: image.type,
    ext: image.ext,
    cutout: image.cutout ?? false,
    added: image.added,
    bytes: toBase64(new Uint8Array(await image.blob.arrayBuffer())),
  }
}

export function rowToImage(row: ImageRow): PageImage {
  const bytes = fromBase64(row.bytes)
  return {
    id: row.id,
    page: row.page,
    blob: new Blob([bytes as unknown as BlobPart], { type: row.mime }),
    type: row.mime,
    ext: row.ext,
    cutout: !!row.cutout,
    added: Number(row.added),
  }
}
