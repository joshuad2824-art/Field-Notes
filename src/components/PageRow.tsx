import { navigate, to } from '../lib/router'
import { shortStamp, countLabel } from '../lib/format'
import { type Page, notebookOf, snippetOf, titleOf, wordCount } from '../lib/model'

interface Props {
  page: Page
  showNotebook?: boolean
  excerpt?: string
  active?: boolean
  compact?: boolean
  onOpen?: (page: Page) => void
}

export function PageRow({ page, showNotebook, excerpt, active, compact, onOpen }: Props) {
  const open = () => (onOpen ? onOpen(page) : navigate(to.page(page.id)))
  const text = excerpt ?? snippetOf(page.body)

  return (
    <button
      className={`row-page${active ? ' active' : ''}${compact ? ' compact' : ''}`}
      onClick={open}
      aria-current={active ? 'page' : undefined}
    >
      <div className="row-title">
        {page.pinned ? (
          <span className="row-pin" aria-label="Pinned">
            ●
          </span>
        ) : null}
        <span>{titleOf(page.body)}</span>
      </div>
      {text ? <div className="row-snippet">{text}</div> : null}
      <div className="row-meta">
        {showNotebook ? (
          <span className="row-book">{notebookOf(page.notebook).name}</span>
        ) : null}
        <span>{shortStamp(page.updated)}</span>
        {compact ? null : <span>{countLabel(wordCount(page.body), 'word')}</span>}
        {page.entryDate ? <span>{page.entryDate}</span> : null}
      </div>
    </button>
  )
}
