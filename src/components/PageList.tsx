import { useEffect, useMemo, useRef, useState } from 'react'
import { livePages } from '../lib/db'
import { countLabel, groupFor, mastheadParts, shortStamp } from '../lib/format'
import { SIDEBAR_DOCKED, useMediaQuery } from '../lib/media'
import { type Page, snippetOf, titleOf, wordCount } from '../lib/model'
import { notebookForPage } from '../lib/notebooks'
import { navigate, to } from '../lib/router'
import { resetEdgeColor, setEdgeColor, surfaceColor } from '../lib/themecolor'
import { WeatherLine } from './WeatherLine'
import { useLive } from '../lib/useLive'

interface Props {
  notebook: string
  activeId?: string
  compact: boolean
  /* Whether the notebooks column is docked beside us — the mark in the head
     is what folds and unfolds it. */
  railShown: boolean
  onToggleRail: () => void
  onNewPage: () => void
  onPick?: () => void
}

interface Group {
  label: string
  pages: Page[]
}

function group(pages: Page[]): Group[] {
  const groups: Group[] = []
  const pinned = pages.filter((page) => page.pinned)
  if (pinned.length) groups.push({ label: 'Pinned', pages: pinned })

  for (const page of pages.filter((p) => !p.pinned)) {
    const label = groupFor(page.updated)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.pages.push(page)
    else groups.push({ label, pages: [page] })
  }
  return groups
}

export function PageList({
  notebook,
  activeId,
  compact,
  railShown,
  onToggleRail,
  onNewPage,
  onPick,
}: Props) {
  const book = notebookForPage(notebook)
  const pages = useLive<Page[]>(() => livePages(notebook), [notebook], [])
  const [query, setQuery] = useState('')
  const { weekday, day, month, year } = mastheadParts()

  /* iOS keeps a strip below the app and paints it from the page's own canvas
     background, so that colour has to be whatever is at the bottom of the screen.
     When the list is the whole window, that is this foot — a near-black bar,
     not the frame's teal — and getting it wrong draws exactly the band the
     colour is there to prevent.

     Only when the list is the whole window. Docked, the foot is one column of
     three and has no claim on the width of the screen. */
  const footRef = useRef<HTMLDivElement>(null)
  const docked = useMediaQuery(SIDEBAR_DOCKED)
  useEffect(() => {
    const foot = footRef.current
    if (docked || !foot) return
    setEdgeColor(surfaceColor(foot))
    return resetEdgeColor
  }, [docked])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return pages
    return pages.filter((page) => page.body.toLowerCase().includes(q))
  }, [pages, query])

  const groups = useMemo(() => group(shown), [shown])

  const open = (page: Page) => {
    navigate(to.page(page.id))
    onPick?.()
  }

  return (
    <div className="listcol">
      {compact ? (
        <div className="list-masthead">
          <span className="list-numeral">{day}</span>
          <span className="list-datum">
            {weekday}
            <br />
            {month} {year}
          </span>
          <span className="grow" />
          {/* The rail is a closed drawer at this width, so the weather has to
              be here or it is nowhere. Compact: the day's range gives up its
              place to a numeral 76px tall. */}
          <WeatherLine compact />
          <button className="mark-button" onClick={onToggleRail} aria-label="Notebooks">
            ☰
          </button>
        </div>
      ) : null}

      <div className="list-head">
        <div className="list-head-row">
          {compact ? null : (
            <button
              className={`mark-button tight${railShown ? ' on' : ''}`}
              onClick={onToggleRail}
              aria-label={railShown ? 'Hide the notebooks' : 'Show the notebooks'}
              title="Notebooks — ⌘⇧\"
            >
              ☰
            </button>
          )}
          <span className="book-dot" style={{ background: book.color }} />
          <span className="list-title">{book.name}</span>
          <span className="grow" />
          <span className="list-count">{countLabel(pages.length, 'page')}</span>
        </div>
        <input
          className="well"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search this notebook"
          type="search"
          autoComplete="off"
          spellCheck={false}
          aria-label="Search this notebook"
        />
      </div>

      <div className="scroll list-body">
        {groups.length === 0 ? (
          <div className="empty">
            {query.trim() ? 'No pages match.' : 'Nothing here yet. Plenty of time.'}
          </div>
        ) : (
          groups.map((section) => (
            <div key={section.label}>
              <div className="section-label list-group">{section.label}</div>
              {section.pages.map((page) => (
                <button
                  key={page.id}
                  className={`list-row${page.id === activeId ? ' active' : ''}`}
                  onClick={() => open(page)}
                  aria-current={page.id === activeId ? 'page' : undefined}
                >
                  <span className="list-row-mark" />
                  <span className="list-row-title">
                    {page.pinned ? <span className="list-row-pin">●</span> : null}
                    {titleOf(page.body)}
                  </span>
                  <span className="list-row-snippet">{snippetOf(page.body)}</span>
                  <span className="list-row-meta">
                    {shortStamp(page.updated)} · {countLabel(wordCount(page.body), 'word')}
                  </span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>

      {/* New page belongs under the pages it makes, at every width. */}
      <div className="list-foot" ref={footRef}>
        <button className="link-signage" onClick={() => navigate(to.search())}>
          Search
        </button>
        <span className="grow" />
        <button className="plate-button tight" onClick={onNewPage} title="⌘⇧N">
          New page
        </button>
      </div>
    </div>
  )
}
