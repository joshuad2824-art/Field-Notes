import { db, changed } from './db'
import { extensionFor, isCutout } from './images'
import type { Page } from './model'

export async function attachPlanImage(base: Page, file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || !file.size || file.size > 8 * 1024 * 1024) throw new Error('Choose a PNG, JPEG, WebP, or GIF image up to 8 MB.')
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) throw new Error('This file could not be read as an image.')
  bitmap.close()
  const id = crypto.randomUUID().replace(/-/g, ''), ext = extensionFor(file.type)
  const caption = file.name.replace(/\.[^.]+$/, '').replace(/[\[\]\r\n]/g, ' ').trim() || 'Plan image'
  const cutout = await isCutout(file)
  await db.transaction('rw', db.pages, db.images, async () => {
    const current = await db.pages.get(base.id)
    if (!current || current.deleted || current.updated !== base.updated || current.body !== base.body) throw new Error('This plan changed. Review its latest version, then add the image again.')
    const now = Math.max(Date.now(), current.updated + 1)
    await db.images.add({ id, page: current.id, blob: file, type: file.type, ext, cutout, added: now })
    await db.pages.put({ ...current, updated: now, body: `${current.body}\n\n![${caption}](images/${id}.${ext}){full}\n` })
  })
  changed()
}
