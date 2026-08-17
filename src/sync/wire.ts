import type { Notebook, Page, PageImage } from '../lib/model'

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

export const TABLES = ['pages', 'notebooks', 'images'] as const
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
