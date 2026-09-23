import { JOURNAL_NOTEBOOK, stripMarkers, type Page } from './model.ts'

export interface OpenTask {
  page: Page
  text: string
}

export interface Overview {
  pageCount: number
  recent: Page[]
  pinned: Page[]
  tasks: OpenTask[]
  taskCount: number
  notebookCounts: Record<string, number>
}

/* The overview reads the same local pages as the notebook lists. A checkbox is
   only a task when it is a Markdown list item outside a fenced code block. */
export function summarizeOverview(pages: Page[]): Overview {
  const live = pages.filter((page) => !page.deleted)
  const ordinary = live.filter((page) => page.notebook !== JOURNAL_NOTEBOOK)
  const recent = [...live].sort((a, b) => b.updated - a.updated).slice(0, 5)
  const pinned = ordinary.filter((page) => page.pinned).sort((a, b) => b.updated - a.updated)
  const tasks: OpenTask[] = []
  const notebookCounts: Record<string, number> = {}

  for (const page of live) {
    notebookCounts[page.notebook] = (notebookCounts[page.notebook] ?? 0) + 1
    let fence: '`' | '~' | null = null
    for (const line of page.body.split('\n')) {
      const marker = line.match(/^\s*(`{3,}|~{3,})/)
      if (marker) {
        const kind = marker[1][0] as '`' | '~'
        if (fence === null) fence = kind
        else if (fence === kind) fence = null
        continue
      }
      if (fence) continue
      const match = line.match(/^\s*(?:[-*]|\d+\.)\s+\[ \]\s+(.+)$/)
      if (!match) continue
      const text = stripMarkers(match[1])
      if (text) tasks.push({ page, text })
    }
  }

  tasks.sort((a, b) => b.page.updated - a.page.updated)
  return { pageCount: live.length, recent, pinned, tasks, taskCount: tasks.length, notebookCounts }
}
