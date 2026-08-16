import { useEffect, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { Editor } from '../editor/Editor'
import { insertPicture } from '../editor/commands'
import { Sheet, SheetItem } from '../components/Sheet'
import { Shell } from '../components/Shell'
import { StyleTray } from '../components/StyleTray'
import {
  clearOverrides,
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
import { addImage, isImage, pruneImages } from '../lib/images'
import { editedStamp, countLabel, todayLine } from '../lib/format'
import {
  type NotebookId,
  type Page,
  type Placement,
  effectivePen,
  effectiveStock,
  imageMarkdown,
  isBlank,
  tagsOf,
  wordCount,
} from '../lib/model'
import { notebookForPage, useNotebooks } from '../lib/notebooks'
import { useSettings } from '../lib/settings'
import { useKeyboardOpen } from '../lib/viewport'
import { SIDEBAR_DOCKED, useMediaQuery } from '../lib/media'
import { back, navigate, to } from '../lib/router'

const SAVE_DELAY = 250

export function PageScreen({ id }: { id: string }) {
  const settings = useSettings()
  const books = useNotebooks()
  const keyboardOpen = useKeyboardOpen()
  const docked = useMediaQuery(SIDEBAR_DOCKED)

  const [page, setPage] = useState<Page | null>(null)
  const [missing, setMissing] = useState(false)
  const [body, setBody] = useState('')
  const [view, setView] = useState<EditorView | null>(null)
  const [tray, setTray] = useState(false)
  const [menu, setMenu] = useState(false)
  const [placement, setPlacement] = useState<Placement>('margin')

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
      if (openedBlank.current && isBlank(bodyRef.current)) void deletePage(id)
      else flush.current()
      void pruneImages(id, bodyRef.current)
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

  /* Drop a photograph on the page and it lands where it was dropped. */
  const onDropFile = async (file: File) => {
    if (!view || !isImage(file)) return
    const record = await addImage(id, file)
    insertPicture(view, imageMarkdown(record.id, record.ext, '', placement))
  }

  if (missing) {
    return (
      <div className="app">
        <div className="statusband" />
        <div className="empty">That page isn't here.</div>
      </div>
    )
  }

  if (!page) return <div className="app" />

  const book = notebookForPage(page.notebook)
  const tags = tagsOf(body)
  const words = wordCount(body)
  const pen = effectivePen(page, settings.pen)
  const stock = effectiveStock(page, settings.stock)
  const follows = page.pen === undefined && page.stock === undefined

  const togglePen = () => {
    const next = pen === 'felt' ? 'ink' : 'felt'
    void setPen(page.id, next)
    update({ pen: next })
  }

  const toggleStock = () => {
    const next = stock === 'night' ? 'paper' : 'night'
    void setStock(page.id, next)
    update({ stock: next })
  }

  return (
    <div className="app">
      <div className="statusband" />

      <Shell notebook={book.id} activeId={page.id}>
        {({ toggle, hidden }) => (
          <main className="desk" key="desk">
            <article className="leaf" data-stock={stock} data-pen={pen}>
              {/* Three marks at rest, not eleven. */}
              <div className="tools">
                <div className="row">
                  {toggle}
                  {hidden ? (
                    <span className="breadcrumb">
                      {book.name} · {todayLine()}
                    </span>
                  ) : null}
                  <span className="grow" />
                  <span className="saved">Saved</span>
                  <button
                    className={`mark-button wide${tray ? ' on' : ''}`}
                    onClick={() => setTray((open) => !open)}
                    aria-label="Style"
                  >
                    Aa
                  </button>
                  <button
                    className="mark-button"
                    onClick={() => setMenu(true)}
                    aria-label="Page options"
                  >
                    ⋯
                  </button>
                </div>
              </div>

              <Editor
                key={page.id}
                initialBody={page.body}
                onChange={onChange}
                onView={setView}
                highlightColor={() => color.current}
                onDropFile={onDropFile}
                autofocus={isBlank(page.body)}
              />

              {keyboardOpen ? null : (
                <div className="pagefoot">
                  <div className="pagefoot-measure">
                    {docked ? null : (
                      <button
                        className="foot-back"
                        onClick={() => back(to.notebook(book.id))}
                      >
                        ‹ list
                      </button>
                    )}
                    <span>{countLabel(words, 'word')}</span>
                    <span>·</span>
                    <span>{editedStamp(page.updated)}</span>
                    <span className="grow" />
                    {tags.slice(0, 3).map((tag) => (
                      <button
                        key={tag}
                        className="foot-tag"
                        onClick={() => navigate(to.tag(tag))}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tray ? (
                <StyleTray
                  view={view}
                  pageId={page.id}
                  pen={pen}
                  stock={stock}
                  placement={placement}
                  highlight={color.current}
                  onPlacement={setPlacement}
                  onHighlight={(next) => (color.current = next)}
                  onPen={togglePen}
                  onStock={toggleStock}
                  onClose={() => setTray(false)}
                />
              ) : null}
            </article>
          </main>
        )}
      </Shell>

      {menu ? (
        <Sheet onClose={() => setMenu(false)}>
          <div className="sheet-label">Page</div>
          <SheetItem
            label={page.pinned ? 'Unpin' : 'Pin'}
            state={page.pinned ? 'pinned' : undefined}
            onClick={() => {
              void setPinned(page.id, !page.pinned)
              update({ pinned: page.pinned ? 0 : 1 })
            }}
          />
          <SheetItem
            label="Pen"
            state={page.pen === undefined ? `${pen} · default` : pen}
            onClick={togglePen}
          />
          <SheetItem
            label="Stock"
            state={page.stock === undefined ? `${stock} · default` : stock}
            onClick={toggleStock}
          />
          {!follows ? (
            <SheetItem
              label="Follow defaults"
              onClick={() => {
                void clearOverrides(page.id)
                setPage((current) =>
                  current ? { ...current, pen: undefined, stock: undefined } : current,
                )
              }}
            />
          ) : null}
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
          <div className="sheet-label">Notebook</div>
          {books.map((b) => (
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
          <SheetItem
            label="Export as markdown"
            onClick={() => {
              void exportPage({ ...page, body })
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
