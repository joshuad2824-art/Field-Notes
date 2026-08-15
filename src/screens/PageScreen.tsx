import { useEffect, useRef, useState } from 'react'
import { redo, undo, undoDepth, redoDepth } from '@codemirror/commands'
import type { EditorView } from '@codemirror/view'
import { Editor } from '../editor/Editor'
import { applyBlock, applyHighlight, applyWrap } from '../editor/commands'
import { Sheet, SheetItem } from '../components/Sheet'
import {
  deletePage,
  getPage,
  moveTo,
  patchPage,
  saveBody,
  setPen,
  setPinned,
  setStock,
} from '../lib/db'
import { exportPage } from '../lib/export'
import { editedStamp, countLabel } from '../lib/format'
import {
  NOTEBOOKS,
  type NotebookId,
  type Page,
  isBlank,
  notebookOf,
  tagsOf,
  wordCount,
} from '../lib/model'
import { back, navigate, to } from '../lib/router'

const SAVE_DELAY = 250

export function PageScreen({ id }: { id: string }) {
  const [page, setPage] = useState<Page | null>(null)
  const [missing, setMissing] = useState(false)
  const [body, setBody] = useState('')
  const [view, setView] = useState<EditorView | null>(null)
  const [panel, setPanel] = useState<'style' | 'hl' | null>(null)
  const [menu, setMenu] = useState(false)

  const color = useRef('brass')
  const bodyRef = useRef('')
  const openedBlank = useRef(false)
  const timer = useRef<number | null>(null)

  bodyRef.current = body

  useEffect(() => {
    let live = true
    getPage(id).then((found) => {
      if (!live) return
      if (!found) return setMissing(true)
      setPage(found)
      setBody(found.body)
      bodyRef.current = found.body
      openedBlank.current = isBlank(found.body)
    })
    return () => {
      live = false
    }
  }, [id])

  /* Writes go to local storage and return immediately. The debounce only
     batches keystrokes; anything that could take the tab away flushes first. */
  const flush = useRef(() => {})
  flush.current = () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    void saveBody(id, bodyRef.current)
  }

  useEffect(() => {
    const onHide = () => flush.current()
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onHide)
      /* A page opened blank and left blank was never written; it leaves
         nothing behind. A page that had text and was emptied is still a page,
         and goes to the tombstone pile like any other. */
      if (openedBlank.current && isBlank(bodyRef.current)) void deletePage(id)
      else flush.current()
    }
  }, [id])

  const onChange = (next: string) => {
    setBody(next)
    bodyRef.current = next
    if (timer.current) clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = null
      void saveBody(id, next)
    }, SAVE_DELAY)
  }

  const update = (patch: Partial<Page>) => {
    setPage((current) => (current ? { ...current, ...patch } : current))
  }

  if (missing) {
    return (
      <div className="app">
        <header className="chrome">
          <button className="btn glyph" onClick={() => navigate(to.shelf())} aria-label="Back">
            ‹
          </button>
          <span className="chrome-title">Gone</span>
        </header>
        <div className="empty">That page isn't here.</div>
      </div>
    )
  }

  if (!page) return <div className="app" />

  const book = notebookOf(page.notebook)
  const tags = tagsOf(body)
  const words = wordCount(body)
  const canUndo = view ? undoDepth(view.state) > 0 : false
  const canRedo = view ? redoDepth(view.state) > 0 : false

  const togglePanel = (which: 'style' | 'hl') => {
    setPanel((current) => (current === which ? null : which))
    view?.focus()
  }

  const run = (fn: (v: EditorView) => void) => () => {
    if (view) fn(view)
  }

  return (
    <div className="app">
      <header className="chrome">
        <button className="btn glyph" onClick={() => back(to.notebook(book.id))} aria-label="Back">
          ‹
        </button>
        <button className="btn caps quiet" onClick={() => navigate(to.notebook(book.id))}>
          {book.name}
        </button>
        <span className="grow" />
        <button
          className={`btn caps${page.pinned ? ' on' : ''}`}
          onClick={() => {
            void setPinned(page.id, !page.pinned)
            update({ pinned: page.pinned ? 0 : 1 })
          }}
        >
          {page.pinned ? 'Pinned' : 'Pin'}
        </button>
        <button className="btn glyph" onClick={() => setMenu(true)} aria-label="Page options">
          ⋯
        </button>
      </header>

      <main className="desk">
        <article className="leaf" data-stock={page.stock} data-pen={page.pen}>
          <div className="tools">
            <div className="row">
              <button
                className={`tool${panel === 'style' ? ' on' : ''}`}
                onClick={() => togglePanel('style')}
                title="Styles"
              >
                Aa
              </button>
              <button className="tool" onClick={run((v) => applyWrap(v, '**'))} title="Bold ⌘B">
                <b>B</b>
              </button>
              <button className="tool" onClick={run((v) => applyWrap(v, '*'))} title="Italic ⌘I">
                <i>I</i>
              </button>
              <button
                className={`tool${panel === 'hl' ? ' on' : ''}`}
                onClick={() => togglePanel('hl')}
                title="Highlighter"
              >
                ▮
              </button>
              <button
                className="tool"
                onClick={run((v) => applyBlock(v, '- [ ] '))}
                title="Checklist"
              >
                ☐
              </button>
              <span className="grow" />
              <button
                className="tool"
                onClick={run(undo)}
                disabled={!canUndo}
                title="Undo ⌘Z"
              >
                ↶
              </button>
              <button
                className="tool"
                onClick={run(redo)}
                disabled={!canRedo}
                title="Redo ⌘⇧Z"
              >
                ↷
              </button>
            </div>

            <div className={`panel${panel === 'style' ? ' open' : ''}`}>
              <button className="tool serif" onClick={run((v) => applyBlock(v, '# '))}>
                Title
              </button>
              <button className="tool serif" onClick={run((v) => applyBlock(v, '## '))}>
                Heading
              </button>
              <button className="tool caps" onClick={run((v) => applyBlock(v, '### '))}>
                Subhead
              </button>
              <span className="divider" />
              <button
                className="tool"
                onClick={run((v) => applyWrap(v, '~~'))}
                title="Strikethrough"
              >
                <s>S</s>
              </button>
              <button className="tool mono" onClick={run((v) => applyWrap(v, '`'))} title="Monostyled">
                ``
              </button>
              <span className="divider" />
              <button className="tool" onClick={run((v) => applyBlock(v, '* '))} title="Bulleted list">
                •
              </button>
              <button className="tool" onClick={run((v) => applyBlock(v, '- '))} title="Dashed list">
                –
              </button>
              <button
                className="tool mono"
                onClick={run((v) => applyBlock(v, '1. '))}
                title="Numbered list"
              >
                1.
              </button>
              <span className="divider" />
              <button className="tool serif" onClick={run((v) => applyBlock(v, '> '))} title="Block quote">
                “
              </button>
            </div>

            <div className={`panel${panel === 'hl' ? ' open' : ''}`}>
              {['oxblood', 'forest', 'navy', 'driftwood', 'brass'].map((c) => (
                <button
                  key={c}
                  className="sw"
                  data-c={c}
                  aria-label={c}
                  onClick={() => {
                    color.current = c
                    if (view) applyHighlight(view, c)
                  }}
                />
              ))}
              <button
                className="sw none"
                aria-label="Remove highlight"
                onClick={run((v) => applyHighlight(v, 'off'))}
              >
                ×
              </button>
            </div>
          </div>

          <Editor
            key={page.id}
            initialBody={page.body}
            onChange={onChange}
            onView={setView}
            highlightColor={() => color.current}
            autofocus={isBlank(page.body)}
          />

          <div className="pagefoot">
            <span>{countLabel(words, 'word')}</span>
            <span>·</span>
            <span>{editedStamp(page.updated)}</span>
            <span className="grow" />
            {tags.slice(0, 3).map((tag) => (
              <button key={tag} className="foot-tag" onClick={() => navigate(to.tag(tag))}>
                #{tag}
              </button>
            ))}
          </div>
        </article>
      </main>

      {menu ? (
        <Sheet onClose={() => setMenu(false)}>
          <div className="sheet-label">Notebook</div>
          {NOTEBOOKS.map((b) => (
            <SheetItem
              key={b.id}
              label={b.name}
              state={b.id === page.notebook ? 'here' : undefined}
              onClick={() => {
                void moveTo(page.id, b.id as NotebookId)
                update({ notebook: b.id })
                setMenu(false)
              }}
            />
          ))}

          <div className="sheet-rule" />
          <div className="sheet-label">Page</div>
          <SheetItem
            label="Pen"
            state={page.pen === 'felt' ? 'felt' : 'ink'}
            onClick={() => {
              const next = page.pen === 'felt' ? 'ink' : 'felt'
              void setPen(page.id, next)
              update({ pen: next })
            }}
          />
          <SheetItem
            label="Stock"
            state={page.stock === 'night' ? 'night' : 'paper'}
            onClick={() => {
              const next = page.stock === 'night' ? 'paper' : 'night'
              void setStock(page.id, next)
              update({ stock: next })
            }}
          />
          <div className="sheet-item">
            <span className="grow">Entry date</span>
            <input
              type="date"
              value={page.entryDate ?? ''}
              onChange={(e) => {
                const value = e.target.value || undefined
                void patchPage(page.id, { entryDate: value })
                update({ entryDate: value })
              }}
            />
          </div>

          <div className="sheet-rule" />
          <SheetItem
            label="Export as markdown"
            onClick={() => {
              exportPage({ ...page, body })
              setMenu(false)
            }}
          />
          <SheetItem
            label="Delete page"
            danger
            onClick={() => {
              void deletePage(page.id)
              setMenu(false)
              navigate(to.notebook(book.id), { replace: true })
            }}
          />
        </Sheet>
      ) : null}
    </div>
  )
}
