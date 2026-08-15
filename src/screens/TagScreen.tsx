import { pagesWithTag } from '../lib/db'
import type { Page } from '../lib/model'
import { back } from '../lib/router'
import { useLive } from '../lib/useLive'
import { PageRow } from '../components/PageRow'

export function TagScreen({ tag }: { tag: string }) {
  const pages = useLive<Page[]>(() => pagesWithTag(tag), [tag], [])

  return (
    <div className="app">
      <header className="chrome">
        <button className="btn glyph" onClick={() => back()} aria-label="Back">
          ‹
        </button>
        <span className="chrome-title">#{tag}</span>
      </header>

      <div className="scroll">
        {pages.length === 0 ? (
          <div className="empty">Nothing carries that tag.</div>
        ) : (
          <div className="rows">
            {pages.map((page) => (
              <PageRow key={page.id} page={page} showNotebook />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
