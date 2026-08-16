import { zipSync, strToU8 } from 'fflate'
import { db } from './db'
import { imagesForPage } from './images'
import { IMAGE_DIR, type NotebookId, type Page, imageIdsIn, titleOf } from './model'
import { allNotebooks, notebookForPage } from './notebooks'
import { isoDay } from './format'

/* A notebook downloads as a folder of .md files. Storage is already markdown,
   so this is a copy rather than a conversion — the only thing added is a short
   frontmatter block carrying the envelope the filename can't. */

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'page'
  )
}

function frontmatter(page: Page): string {
  const lines = [
    '---',
    `notebook: ${notebookForPage(page.notebook).name}`,
    `created: ${new Date(page.created).toISOString()}`,
    `updated: ${new Date(page.updated).toISOString()}`,
  ]
  if (page.entryDate) lines.push(`date: ${page.entryDate}`)
  if (page.pinned) lines.push('pinned: true')
  if (page.pen && page.pen !== 'ink') lines.push(`pen: ${page.pen}`)
  if (page.stock && page.stock !== 'paper') lines.push(`stock: ${page.stock}`)
  lines.push('---', '')
  return lines.join('\n')
}

export function fileFor(page: Page): { name: string; text: string } {
  const day = page.entryDate ?? isoDay(page.created)
  return {
    name: `${day} ${slug(titleOf(page.body))}.md`,
    text: frontmatter(page) + page.body + (page.body.endsWith('\n') ? '' : '\n'),
  }
}

type Folder = Record<string, Uint8Array | Record<string, Uint8Array>>
type Tree = Record<string, Uint8Array | Folder>

/* The markdown says `images/<id>.<ext>`; export writes the bytes at exactly
   that path, so the link resolves wherever the folder is opened. */
async function imagesFolder(pages: Page[]): Promise<Record<string, Uint8Array>> {
  const files: Record<string, Uint8Array> = {}
  for (const page of pages) {
    const wanted = new Set(imageIdsIn(page.body))
    if (!wanted.size) continue
    for (const record of await imagesForPage(page.id)) {
      if (!wanted.has(record.id)) continue
      const bytes = new Uint8Array(await record.blob.arrayBuffer())
      files[`${record.id}.${record.ext}`] = bytes
    }
  }
  return files
}

function addUnique(folder: Record<string, Uint8Array>, name: string, data: Uint8Array) {
  let candidate = name
  let n = 2
  while (candidate in folder) {
    candidate = name.replace(/\.md$/, ` ${n}.md`)
    n++
  }
  folder[candidate] = data
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function livePages(notebook?: NotebookId): Promise<Page[]> {
  const rows = await db.pages.toArray()
  return rows
    .filter((p) => !p.deleted && (!notebook || p.notebook === notebook))
    .sort((a, b) => a.created - b.created)
}

export async function exportNotebook(notebook: NotebookId): Promise<number> {
  const pages = await livePages(notebook)
  const folder: Record<string, Uint8Array> = {}
  for (const page of pages) {
    const { name, text } = fileFor(page)
    addUnique(folder, name, strToU8(text))
  }
  const book = notebookForPage(notebook)
  const pictures = await imagesFolder(pages)
  const tree: Tree = { [slug(book.name)]: folder as Folder }
  if (Object.keys(pictures).length) {
    ;(tree[slug(book.name)] as Folder)[IMAGE_DIR] = pictures
  }
  const zip = zipSync(tree as never, { level: 6 })
  download(
    new Blob([zip as BlobPart], { type: 'application/zip' }),
    `${slug(book.name)}-${isoDay()}.zip`,
  )
  return pages.length
}

export async function exportShelf(): Promise<number> {
  const pages = await livePages()
  const tree: Tree = {}
  for (const book of allNotebooks()) {
    const folder: Record<string, Uint8Array> = {}
    for (const page of pages.filter((p) => p.notebook === book.id)) {
      const { name, text } = fileFor(page)
      addUnique(folder, name, strToU8(text))
    }
    if (Object.keys(folder).length) {
      const pictures = await imagesFolder(pages.filter((p) => p.notebook === book.id))
      const branch: Folder = { ...folder }
      if (Object.keys(pictures).length) branch[IMAGE_DIR] = pictures
      tree[slug(book.name)] = branch
    }
  }
  const zip = zipSync(tree as never, { level: 6 })
  download(
    new Blob([zip as BlobPart], { type: 'application/zip' }),
    `field-notes-${isoDay()}.zip`,
  )
  return pages.length
}

/* A single page with pictures has to be a folder too, or the links dangle. */
export async function exportPage(page: Page): Promise<void> {
  const { name, text } = fileFor(page)
  const pictures = await imagesFolder([page])

  if (!Object.keys(pictures).length) {
    download(new Blob([text], { type: 'text/markdown;charset=utf-8' }), name)
    return
  }

  const stem = name.replace(/\.md$/, '')
  const zip = zipSync(
    { [stem]: { [name]: strToU8(text), [IMAGE_DIR]: pictures } } as never,
    { level: 6 },
  )
  download(new Blob([zip as BlobPart], { type: 'application/zip' }), `${stem}.zip`)
}
