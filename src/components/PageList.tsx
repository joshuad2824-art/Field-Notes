import { Icon } from './Icon'
import React, { useEffect, useMemo, useRef } from 'react'
import { livePages } from '../lib/db'
import { countLabel, groupFor, mastheadParts, shortStamp } from '../lib/format'
import { SIDEBAR_DOCKED, useMediaQuery } from '../lib/media'
import { NotebookSwitcher } from './NotebookSwitcher'
import { JOURNAL_NOTEBOOK, type Page, snippetOf, titleOf, wordCount } from '../lib/model'
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
  onPick,
}: Props) {
  const book = notebookForPage(notebook)
  const pages = useLive<Page[]>(() => livePages(notebook), [notebook], [])
  const query = ''
  const { weekday, day, month, year } = mastheadParts()
  const journal = notebook === JOURNAL_NOTEBOOK

  /* iOS keeps a strip below the app and paints it from the page's own canvas
     background, so that colour has to be whatever is at the bottom of the screen.
     When the list is the whole window, that is the list itself. Docked, the list
     is one column of three and has no claim on the width of the screen. */
  const colRef = useRef<HTMLDivElement>(null)
  const docked = useMediaQuery(SIDEBAR_DOCKED)
  useEffect(() => {
    const col = colRef.current
    if (docked || !col) return
    setEdgeColor(surfaceColor(col))
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
    <div className={`listcol${railShown ? ' rail-shown' : ''}`} ref={colRef}>
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
            <Icon name="menu" />
          </button>
        </div>
      ) : null}

      {/* The head wears the notebook's colour as a band along its bottom
          edge, where a border already was. The 9px dot beside the name is
          nearly invisible against the frame; a wide band is read by hue at
          a glance in a way a dot never is. */}
      <div className="list-head" style={{ '--book-color': book.color } as React.CSSProperties}>
        <div className="list-head-row">
          {compact ? null : (
            <button
              className={`sidebar-tab${railShown ? ' on' : ''}`}
              onClick={onToggleRail}
              aria-label={railShown ? 'Hide the notebooks' : 'Show the notebooks'}
              title="Notebooks — ⌘⇧\"
            >
              <span aria-hidden="true">{railShown ? '‹' : '›'}</span>
            </button>
          )}
          <span className="book-dot" style={{ background: book.color }} />
          <NotebookSwitcher notebook={book.id} className="list-title" />
          <span className="grow" />
        </div>
      </div>

      <div className="scroll list-body">
        {groups.length === 0 ? (
          <div className="empty">
            {query.trim()
              ? 'No pages match.'
              : journal
                ? 'Your weekly reviews will appear here.'
                : 'Nothing here yet. Plenty of time.'}
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

    </div>
  )
}
