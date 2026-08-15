import { zipSync, strToU8 } from 'fflate'
import { db } from './db'
import { NOTEBOOKS, type NotebookId, type Page, notebookOf, titleOf } from './model'
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
    `notebook: ${notebookOf(page.notebook).name}`,
    `created: ${new Date(page.created).toISOString()}`,
    `updated: ${new Date(page.updated).toISOString()}`,
  ]
  if (page.entryDate) lines.push(`date: ${page.entryDate}`)
  if (page.pinned) lines.push('pinned: true')
  if (page.pen !== 'ink') lines.push(`pen: ${page.pen}`)
  if (page.stock !== 'paper') lines.push(`stock: ${page.stock}`)
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

type Tree = Record<string, Uint8Array | Record<string, Uint8Array>>

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
  const book = notebookOf(notebook)
  const zip = zipSync({ [slug(book.name)]: folder } as Tree, { level: 6 })
  download(new Blob([zip as BlobPart], { type: 'application/zip' }), `${slug(book.name)}-${isoDay()}.zip`)
  return pages.length
}

export async function exportShelf(): Promise<number> {
  const pages = await livePages()
  const tree: Tree = {}
  for (const book of NOTEBOOKS) {
    const folder: Record<string, Uint8Array> = {}
    for (const page of pages.filter((p) => p.notebook === book.id)) {
      const { name, text } = fileFor(page)
      addUnique(folder, name, strToU8(text))
    }
    if (Object.keys(folder).length) tree[slug(book.name)] = folder
  }
  const zip = zipSync(tree, { level: 6 })
  download(new Blob([zip as BlobPart], { type: 'application/zip' }), `field-notes-${isoDay()}.zip`)
  return pages.length
}

export function exportPage(page: Page) {
  const { name, text } = fileFor(page)
  download(new Blob([text], { type: 'text/markdown;charset=utf-8' }), name)
}
