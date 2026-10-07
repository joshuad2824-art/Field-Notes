import { titleOf, type Page } from './model'
import { notebookForPage } from './notebooks'

// The preview and clipboard always use this same string. Preparing a request
// does not write a page or imply that a conversation transport is connected.
export function sienaRequest(instruction: string, page?: Page): string {
  const ask = instruction.trim() || 'Please help me think through this page and suggest a next step.'
  return `Siena, ${ask}\n\nDo not update saved notes directly. Explain substantive changes and, if revising a page, return its complete proposed Markdown for me to review and apply in Field Notes.${page ? `\n\nNotebook: ${notebookForPage(page.notebook).name}\nPage ID: ${page.id}\nTitle: ${titleOf(page.body)}\n\nCurrent page:\n${page.body}` : '\n\nNo saved page is attached.'}`
}
