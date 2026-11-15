import { getImage } from './images'
import { imageIdsIn, titleOf } from './model'
import { readableText } from './share-text.ts'

/* Sharing a page (November 2026): the system share sheet on a phone or an
   iPad, so a page goes to Messages, Mail or Notes as readable text — with its
   pictures, where the place it is going accepts them. Nothing leaves the
   device until a destination is chosen there; this module only hands it over.

   iOS only opens the sheet from inside the tap that asked for it, and a read
   from IndexedDB in between can cost that. So the payload is made ready when
   the page's menu opens, and the tap itself only hands it over. */

export interface SharePayload {
  title: string
  text: string
  files: File[]
}

export function canShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

function slug(title: string): string {
  return title.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'page'
}

/* The page's own pictures, as files, when the browser says it can send them. */
async function pictures(body: string, title: string): Promise<File[]> {
  if (!canShare() || typeof navigator.canShare !== 'function') return []
  const files: File[] = []
  for (const [index, id] of imageIdsIn(body).entries()) {
    const image = await getImage(id)
    if (!image) continue
    files.push(new File([image.blob], `${slug(title)}-${index + 1}.${image.ext}`, { type: image.type }))
  }
  try {
    return files.length && navigator.canShare({ files }) ? files : []
  } catch {
    return []
  }
}

export async function preparePage(body: string): Promise<SharePayload> {
  const title = titleOf(body)
  return { title, text: readableText(body), files: await pictures(body, title) }
}

export function prepareText(markdown: string, title: string): SharePayload {
  return { title, text: readableText(markdown), files: [] }
}

export type ShareResult = 'shared' | 'cancelled' | 'failed'

export async function share(payload: SharePayload): Promise<ShareResult> {
  if (!canShare()) return 'failed'
  try {
    await navigator.share({
      title: payload.title,
      text: payload.text,
      ...(payload.files.length ? { files: payload.files } : {}),
    })
    return 'shared'
  } catch (error) {
    return error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'failed'
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
