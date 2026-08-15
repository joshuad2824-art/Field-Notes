import { useEffect, useRef, useState } from 'react'
import { allTags } from '../lib/db'
import { search, type Hit } from '../lib/search'
import { back, navigate, to } from '../lib/router'
import { useLive } from '../lib/useLive'
import { PageRow } from '../components/PageRow'

export function SearchScreen() {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const input = useRef<HTMLInputElement>(null)
  const tags = useLive<{ tag: string; count: number }[]>(allTags, [], [])

  useEffect(() => {
    input.current?.focus()
  }, [])

  useEffect(() => {
    let live = true
    search(query).then((found) => {
      if (live) setHits(found)
    })
    return () => {
      live = false
    }
  }, [query])

  return (
    <div className="app">
      <header className="chrome">
        <button className="btn glyph" onClick={() => back()} aria-label="Back">
          ‹
        </button>
        <input
          ref={input}
          className="well"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          type="search"
          autoComplete="off"
          spellCheck={false}
          aria-label="Search"
        />
      </header>

      <div className="scroll">
        {query.trim() === '' ? (
          tags.length > 0 ? (
            <div className="tagpane">
              <div className="section-label">Tags</div>
              <div className="chips">
                {tags.map(({ tag, count }) => (
                  <button key={tag} className="chip" onClick={() => navigate(to.tag(tag))}>
                    #{tag}
                    <span className="count">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null
        ) : hits.length === 0 ? (
          <div className="empty">No pages match.</div>
        ) : (
          <div className="rows">
            {hits.map((hit) => (
              <PageRow key={hit.page.id} page={hit.page} excerpt={hit.excerpt} showNotebook />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
