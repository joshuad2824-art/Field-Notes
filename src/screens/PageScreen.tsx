import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { EditorView } from '@codemirror/view'
import { redo, undo } from '@codemirror/commands'
import { Editor } from '../editor/Editor'
import { insertPicture } from '../editor/commands'
import { Icon } from '../components/Icon'
import { Sheet, SheetItem } from '../components/Sheet'
import { Shell } from '../components/Shell'
import { StyleTray } from '../components/StyleTray'
import {
  clearOverrides,
  createPage,
  deletePage,
  getPage,
  moveTo,
  patchPage,
  saveEditorBody,
  setPen,
  setPinned,
  setStock,
  subscribe,
} from '../lib/db'
import { caretAtEndFor } from '../lib/capture'
import { exportPage } from '../lib/export'
import { eventsForPage } from '../lib/events'
import { addImage, isImage, pruneImages } from '../lib/images'
import { editedStamp, countLabel, todayLine } from '../lib/format'
import { collectWeek } from '../lib/journal'
import {
  JOURNAL_NOTEBOOK,
  type NotebookId,
  type Page,
  type FieldEvent,
  type Placement,
  effectivePen,
  effectiveStock,
  imageMarkdown,
  isBlank,
  tagsOf,
  wordCount,
} from '../lib/model'
import { firstNotebookId, isReserved, notebookForPage, useNotebooks } from '../lib/notebooks'
import { hasConsented, hasModelKey } from '../writeup/key'
import { WriteupError, writeUp } from '../writeup/anthropic'
import { getSettings, setSettings, stepZoom, useSettings } from '../lib/settings'
import { useKeyboardOpen } from '../lib/viewport'
import { resetEdgeColor, setEdgeColor, tokenColor } from '../lib/themecolor'
import { SIDEBAR_DOCKED, useMediaQuery } from '../lib/media'
import { back, navigate, to } from '../lib/router'
import { useLive } from '../lib/useLive'

const SAVE_DELAY = 250

export function PageScreen({ id, workshop = false }: { id: string; workshop?: boolean }) {
  const settings = useSettings()
  const books = useNotebooks()
  const keyboardOpen = useKeyboardOpen()
  const docked = useMediaQuery(SIDEBAR_DOCKED)
  const linkedEvents = useLive<FieldEvent[]>(() => eventsForPage(id), [id], [])

  const [page, setPage] = useState<Page | null>(null)
  const [missing, setMissing] = useState(false)
  const [body, setBody] = useState('')
  const [view, setView] = useState<EditorView | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [tray, setTray] = useState(false)
  const trayToggle = useRef<HTMLButtonElement>(null)
  const [menu, setMenu] = useState(false)
  /* The prose pass, which is the only thing in this app that can be busy or
     can fail out loud. Both states live here rather than in the sheet, because
     the sheet closes and the request does not. */
  const [writing, setWriting] = useState(false)
  const [gathering, setGathering] = useState(false)
  const [reviewProblem, setReviewProblem] = useState('')
  const [wroteUp, setWroteUp] = useState<string | null>(null)
  /* Where a newly dropped or inserted picture sits. The plate carries its own
     controls once it is on the page, so this is only ever the starting side. */
  const [placement] = useState<Placement>('right')

  const color = useRef('brass')
  const bodyRef = useRef('')
  const baseRef = useRef<Page | null>(null)
  const saves = useRef<Promise<void>>(Promise.resolve())
  const mounted = useRef(false)
  const refresh = useRef<() => void>(() => {})
  const loaded = useRef(false)
  const openedBlank = useRef(false)
  const timer = useRef<number | null>(null)

  bodyRef.current = body

  useEffect(() => {
    let live = true
    mounted.current = true
    getPage(id).then((found) => {
      if (!live) return
      if (!found) return setMissing(true)
      loaded.current = true
      setPage(found)
      baseRef.current = found
      setBody(found.body)
      bodyRef.current = found.body
      openedBlank.current = isBlank(found.body)
      refresh.current()
    })
    return () => {
      live = false
      mounted.current = false
    }
  }, [id])

  useEffect(() => {
    let live = true
    let request = 0
    const run = () => {
      const serial = ++request
      void getPage(id).then((found) => {
        const base = baseRef.current
        if (!live || serial !== request || !found || found.deleted || !base || base.id !== id) return
        if (viewRef.current?.composing) return
        // A pending local draft stays in the editor until its guarded save.
        if (bodyRef.current !== base.body && bodyRef.current !== found.body) return
        baseRef.current = found
        bodyRef.current = found.body
        setPage(found)
        setBody(found.body)
      })
    }
    refresh.current = run
    const off = subscribe(run)
    return () => { live = false; refresh.current = () => {}; off() }
  }, [id])

  /* Writes go to local storage and return immediately. The debounce only
     batches keystrokes; anything that could take the tab away flushes first. */
  const flush = useRef<() => Promise<void>>(async () => {})
  flush.current = () => {
    /* StrictMode tears down its first effect pass before the page has loaded.
       Flushing that empty initial ref would erase an existing page. */
    if (!loaded.current) return Promise.resolve()
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    // Serialize saves so a second keystroke cannot compare against an old
    // baseline and mistake this editor's own preceding save for a conflict.
    const save = saves.current.then(async () => {
      const base = baseRef.current
      const draft = bodyRef.current
      if (!base || draft === base.body) return
      const saved = await saveEditorBody(base, draft)
      baseRef.current = saved
      if (saved.id !== base.id) {
        const prefix = saved.body.slice(0, saved.body.length - draft.length)
        bodyRef.current = prefix + bodyRef.current
        if (mounted.current) {
          setBody(bodyRef.current)
          setPage(saved)
          navigate(to.page(saved.id))
        }
      } else if (mounted.current) setPage(saved)
    })
    saves.current = save.catch(() => {})
    return save
  }

  useEffect(() => {
    const onHide = () => void flush.current()
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onHide)
      if (!loaded.current) return
      if (openedBlank.current && isBlank(bodyRef.current)) void deletePage(id)
      else void flush.current()
      void pruneImages(id, bodyRef.current)
    }
  }, [id])

  /* The strip iOS keeps below the app is painted from the page's own canvas
     background, so that follows the stock of the page being looked at.
     Otherwise a night page sits above a teal-800 band and a cream one above a
     dark one — which is exactly the band this closes. */
  const stockNow = page ? effectiveStock(page, settings.stock) : null
  useEffect(() => {
    if (!stockNow) return
    const leaf = document.querySelector('.leaf')
    setEdgeColor(leaf ? tokenColor('--surface-page', leaf) : tokenColor('--frame-bg'))
    return resetEdgeColor
  }, [stockNow])

  const onChange = (next: string) => {
    setBody(next)
    bodyRef.current = next
    if (timer.current) clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = null
      void flush.current()
    }, SAVE_DELAY)
  }

  const update = (patch: Partial<Page>) => {
    setPage((current) => (current ? { ...current, ...patch } : current))
  }

  /* The optional prose rewrite goes through the editor so undo can restore
     the previous writing. Gathering changed notes creates a separate review.
     The rewrite dispatches into the editor rather than writing behind it. The editor owns
     its document once created — a save made underneath it would be undone by
     the next keystroke — and going through a dispatch means CodeMirror's
     history still owns undo, so a prose pass you don't like is one ⌘Z away.
     Same rule the table widget follows, for the same reason. */
  const replaceDocument = (next: string) => {
    if (!view) return
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } })
  }

  const recollect = async () => {
    if (!page?.entryDate || gathering) return
    setGathering(true)
    setReviewProblem('')
    try {
      await flush.current()
      const review = await collectWeek(new Date(`${page.entryDate}T12:00:00`).getTime(), true)
      setMenu(false)
      navigate(to.page(review.id))
    } catch (error) {
      setReviewProblem(error instanceof Error ? error.message : 'Could not gather the review.')
    } finally { setGathering(false) }
  }

  const runWriteUp = async () => {
    setWroteUp(null)
    setWriting(true)
    try {
      const prose = await writeUp(bodyRef.current)
      replaceDocument(prose)
      setWroteUp('written up · ⌘Z takes it back')
    } catch (e) {
      setWroteUp(
        e instanceof WriteupError
          ? e.message
          : 'That did not work, and the page is untouched.',
      )
    } finally {
      setWriting(false)
    }
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
    <div className={`app${workshop ? ' workshop-editor' : ''}`}>
      {/* The stock rides on the band itself rather than on `.app`, so the one
          custom property it needs resolves here and nothing else in the tree
          inherits a leaf's text colours. */}
      <div className="statusband" data-stock={stock} />

      <Shell notebook={book.id} activeId={page.id} focus={workshop}>
        {({ toggle, hidden }) => (
          <main className="desk" key="desk">
            <article
              className="leaf"
              data-stock={stock}
              data-pen={pen}
              style={{ '--zoom': settings.zoom } as CSSProperties}
            >
              {/* Three marks at rest, not eleven. */}
              <div className="tools">
                <div className="row">
                  {workshop ? <button className="icon-control" aria-label="Back to plan" title="Back to plan" onClick={() => navigate(to.plan(id))}><Icon name="back" /></button> : toggle}
                  {hidden ? (
                    <span className="breadcrumb">
                      {book.name} · {todayLine()}
                    </span>
                  ) : null}
                  <span className="grow" />
                  <span className="saved">Saved</span>
                  {/* Undo and redo are the editor's own; they sit with Aa
                      rather than with the navigation on the left. */}
                  <button
                    className="mark-button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => view && undo(view)}
                    aria-label="Undo — ⌘Z"
                    title="Undo — ⌘Z"
                  >
                    <Icon name="undo" />
                  </button>
                  <button
                    className="mark-button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => view && redo(view)}
                    aria-label="Redo — ⌘⇧Z"
                    title="Redo — ⌘⇧Z"
                  >
                    <Icon name="redo" />
                  </button>
                  <button
                    ref={trayToggle}
                    className={`mark-button wide${tray ? ' on' : ''}`}
                    /* Opening the tray must not take the focus off what the
                       tray is about to shape. CodeMirror keeps its selection
                       in state and survives a blur; a contenteditable table
                       cell does not, and loses the selection being marked. */
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setTray((open) => !open)}
                    aria-label="Style"
                    aria-expanded={tray}
                  >
                    Aa
                  </button>
                  <button
                    className="mark-button"
                    onClick={() => setMenu(true)}
                    aria-label="Page options"
                  >
                    <Icon name="more" />
                  </button>
                </div>
              </div>

              {tray ? (
                <StyleTray
                  toggleRef={trayToggle}
                  view={view}
                  pageId={page.id}
                  pen={pen}
                  stock={stock}
                  placement={placement}
                  highlight={color.current}
                  zoom={settings.zoom}
                  onHighlight={(next) => (color.current = next)}
                  onPen={togglePen}
                  onStock={toggleStock}
                  onZoom={(direction) =>
                    setSettings({ zoom: stepZoom(getSettings().zoom, direction) })
                  }
                  onClose={() => setTray(false)}
                />
              ) : null}

              <Editor
                key={page.id}
                initialBody={page.body}
                externalBody={body}
                onChange={onChange}
                onView={(next) => { viewRef.current = next; setView(next) }}
                onCompositionEnd={() => refresh.current()}
                highlightColor={() => color.current}
                onDropFile={onDropFile}
                autofocus={caretAtEndFor(id) ? 'end' : isBlank(page.body)}
              />

              {keyboardOpen ? null : (
                <div className="pagefoot">
                  <div className="pagefoot-measure">
                    {docked ? null : (
                      <button className="foot-back icon-control" aria-label={workshop ? "Back to plan" : "Back to list"} onClick={() => workshop ? navigate(to.plan(id)) : back(to.notebook(book.id))}><Icon name="back" /></button>
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
            </article>
          </main>
        )}
      </Shell>

      {menu ? (
        <Sheet onClose={() => setMenu(false)}>
          {/* Below 1120 the list isn't on screen, so this is the only way to
              start a page without leaving the one in hand. ⌘⇧N does it from
              anywhere on a desktop. */}
          <SheetItem
            label="New page" icon="new-page"
            state="⌘⇧N"
            onClick={() => {
              setMenu(false)
              /* Beside a journal entry, "here" is a notebook nothing is
                 written into by hand, so a new page goes to the shelf. */
              const into = isReserved(page.notebook) ? firstNotebookId() : page.notebook
              void createPage(into).then((next) => navigate(to.page(next.id)))
            }}
          />

          <div className="sheet-rule" />
          <div className="sheet-label">Page</div>
          <SheetItem
            label="Ask Siena about this page" icon="from-siena"
            state="review before applying"
            onClick={() => {
              setMenu(false)
              void flush.current().then(() => navigate(to.review(page.id)))
            }}
          />
          {linkedEvents.map((event) => (
            <SheetItem
              key={event.id}
              label={event.title}
              state="calendar event"
              onClick={() => { setMenu(false); navigate(to.event(event.id)) }}
            />
          ))}
          <SheetItem
            label={page.pinned ? 'Unpin' : 'Pin'} icon="pin"
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
              label="Follow defaults" icon="restore"
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

          {page.notebook === JOURNAL_NOTEBOOK ? (
            <>
              <div className="sheet-rule" />
              <div className="sheet-label">Journal</div>
              <p className="sheet-review-note">Gather a fresh copy to include changed notes. This review and your edits will be kept.</p>
              <SheetItem
                label={gathering ? 'Gathering review' : 'Gather a fresh copy'} icon="refresh"
                state={reviewProblem || page.entryDate || undefined}
                onClick={() => void recollect()}
              />
              {/* Off unless a key has been pasted and the line beside it in
                  Settings has been answered. The collected week is already a
                  real entry; this is laid on top of it and is allowed to be
                  unavailable. */}
              <SheetItem
                label={writing ? 'Writing it up' : 'Write it up'} icon="edit"
                state={
                  wroteUp ??
                  (!hasModelKey()
                    ? 'needs a key in Settings'
                    : !hasConsented()
                      ? 'not agreed to yet'
                      : undefined)
                }
                onClick={() => {
                  if (writing || !hasModelKey() || !hasConsented()) return
                  void runWriteUp()
                }}
              />
            </>
          ) : null}

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
            label="Export as markdown" icon="download"
            onClick={() => {
              void exportPage({ ...page, body })
              setMenu(false)
            }}
          />
          <SheetItem
            label="Delete page" icon="trash"
            danger
            onClick={() => {
              setMenu(false)
              void (async () => {
                /* Finish any pending edit before the tombstone. Navigating
                   first lets the unmount flush race the deletion and can
                   restore the page on this device. */
                await flush.current()
                await deletePage(page.id)
                navigate(to.notebook(book.id), { replace: true })
              })()
            }}
          />
        </Sheet>
      ) : null}
    </div>
  )
}
