import { changed, db } from './db'
import { type PageImage, imageIdsIn } from './model'

/* The bytes behind a picture. They live in Dexie beside the page, keyed by the
   id that appears in the markdown path, so `images/<id>.<ext>` in the file and
   `images/<id>.<ext>` on export are the same string. */

const urls = new Map<string, string>()

function uuid(): string {
  if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  return Math.random().toString(36).slice(2, 14)
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
}

export function extensionFor(type: string): string {
  return EXTENSIONS[type] ?? 'png'
}

export function isImage(file: File | null | undefined): boolean {
  return !!file && file.type.startsWith('image/')
}

export async function addImage(page: string, file: File): Promise<PageImage> {
  const record: PageImage = {
    id: uuid(),
    page,
    blob: file,
    type: file.type,
    ext: extensionFor(file.type),
    added: Date.now(),
  }
  await db.images.put(record)
  changed()
  return record
}

export async function getImage(id: string): Promise<PageImage | undefined> {
  return db.images.get(id)
}

/* A cached object URL, so a page full of pictures doesn't leak a new one on
   every keystroke that rebuilds the decorations. */
export async function imageUrl(id: string): Promise<string | null> {
  const known = urls.get(id)
  if (known) return known
  const record = await db.images.get(id)
  if (!record) return null
  const url = URL.createObjectURL(record.blob)
  urls.set(id, url)
  return url
}

export function cachedImageUrl(id: string): string | null {
  return urls.get(id) ?? null
}

/* Pictures a page no longer refers to. Called after a save, so an image that
   was undone back out of existence doesn't sit in storage forever. */
export async function pruneImages(pageId: string, body: string): Promise<number> {
  const kept = new Set(imageIdsIn(body))
  const mine = await db.images.where('page').equals(pageId).toArray()
  const gone = mine.filter((row) => !kept.has(row.id))
  if (!gone.length) return 0
  await db.images.bulkDelete(gone.map((row) => row.id))
  for (const row of gone) {
    const url = urls.get(row.id)
    if (url) URL.revokeObjectURL(url)
    urls.delete(row.id)
  }
  changed()
  return gone.length
}

export async function imagesForPage(pageId: string): Promise<PageImage[]> {
  return db.images.where('page').equals(pageId).toArray()
}
