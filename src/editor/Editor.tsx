import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { liveMarkdown } from './markdown'
import {
  applyBlock,
  applyHighlight,
  applyIndent,
  applyWrap,
  continueList,
  deleteAround,
  movePicture,
} from './commands'
import { PICTURE_DRAG } from '../lib/model'
import { hideDropMarker, showDropMarker } from './dropmarker'

interface Props {
  initialBody: string
  onChange: (body: string) => void
  onView: (view: EditorView | null) => void
  highlightColor: () => string
  onDropFile?: (file: File) => void
  /* `'end'` lands the caret after the last character — what an appended line
     wants — where `true` takes the top, which is right for a blank page. */
  autofocus?: boolean | 'end'
}

export function Editor({
  initialBody,
  onChange,
  onView,
  highlightColor,
  onDropFile,
  autofocus,
}: Props) {
  const host = useRef<HTMLDivElement>(null)
  const latest = useRef({ onChange, highlightColor, onDropFile })
  latest.current = { onChange, highlightColor, onDropFile }

  useEffect(() => {
    if (!host.current) return

    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initialBody,
        extensions: [
          history(),
          keymap.of([
            { key: 'Enter', run: continueList },
            /* Before the default keymap, so a marker about to go takes the one
               it is paired with rather than leaving it on the page. Both fall
               through when there is no mark in the way. */
            { key: 'Backspace', run: (v) => deleteAround(v, false) },
            { key: 'Delete', run: (v) => deleteAround(v, true) },
            /* Tab belongs to the page while the page has the caret. Escape
               hands it back, so the editor is still something a keyboard can
               get out of.

               Both always report handled, even at the ends of the range —
               letting Tab fall through at the fourth level would send the
               focus out of the editor mid-sentence, which is a far stranger
               thing for a key to do than nothing. */
            {
              key: 'Tab',
              run: (v) => {
                applyIndent(v, 1)
                return true
              },
            },
            {
              key: 'Shift-Tab',
              run: (v) => {
                applyIndent(v, -1)
                return true
              },
            },
            {
              key: 'Escape',
              run: (v) => {
                v.contentDOM.blur()
                return true
              },
            },
            { key: 'Mod-1', run: (v) => applyBlock(v, '# ') },
            { key: 'Mod-2', run: (v) => applyBlock(v, '## ') },
            { key: 'Mod-3', run: (v) => applyBlock(v, '### ') },
            { key: 'Mod-b', run: (v) => applyWrap(v, '**') },
            { key: 'Mod-i', run: (v) => applyWrap(v, '*') },
            { key: 'Mod-u', run: (v) => applyWrap(v, '<u>', '</u>') },
            {
              key: 'Mod-Shift-h',
              run: (v) => applyHighlight(v, latest.current.highlightColor()),
            },
          ]),
          keymap.of([...historyKeymap, ...defaultKeymap]),
          liveMarkdown(),
          EditorView.contentAttributes.of({
            spellcheck: 'true',
            autocorrect: 'on',
            autocapitalize: 'sentences',
            'aria-label': 'Page',
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) latest.current.onChange(update.state.doc.toString())
          }),
          EditorView.domEventHandlers({
            /* A plain press lets go of whatever was selected before it.

               Two separate things made the mouse look broken, and this one
               handler is the answer to both.

               The first: a press inside writing that is already selected is
               read by every browser as the start of a drag of that text, and
               the selection is held still until an HTML5 drag actually
               begins. A drag that ends back inside itself changes nothing, so
               the second attempt to pick a phrase — which is what anyone does
               when the first pick was a word too long — quietly did nothing.

               The second is worse, because it needs no press inside anything.
               CodeMirror asks whether the press landed in the selection by
               reading the *browser's* selection and measuring its rectangles;
               when the browser has no selection at all it answers `true`
               rather than `false`, and every press on the page is treated as
               the start of a text drag. That state is ordinary on Windows,
               where Chrome and Edge drop the selection when the editor loses
               the focus — so after so much as glancing at the page list, no
               drag anywhere in the note would pick anything. A plain click
               still worked, which is why the way round it was to click the
               line first and then select it. Reported exactly that way.

               Letting go first makes the question moot: the selection is
               empty when CodeMirror asks, so a press always starts a new one
               no matter what the browser did with its own. What it costs is
               dragging text about with the mouse, which nothing in this app
               has ever advertised and which, on a page of writing, is mostly
               a way to move a paragraph somewhere by accident. A picture is
               still dragged by its own plate, which CodeMirror never sees.

               Shift extends rather than starts, a second click is a word and
               a third is a line, and anything but the left button — the right
               one above all, which opens a menu about the selection — is left
               alone. */
            mousedown(event, view) {
              if (event.button !== 0) return false
              if (event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return false
              if (event.detail > 1) return false
              if (view.state.selection.main.empty) return false
              /* The imprecise reading never returns null, so the selection is
                 always left genuinely empty — including for a press in the
                 margin beside a line, which is where a drag across a
                 paragraph usually starts. */
              const at =
                view.posAtCoords({ x: event.clientX, y: event.clientY }) ??
                view.posAtCoords({ x: event.clientX, y: event.clientY }, false)
              view.dispatch({ selection: { anchor: at } })
              return false
            },
            /* Paste a picture straight in. Safari puts the image in
               clipboardData.files; some sources use items instead. */
            paste(event, view) {
              const data = event.clipboardData
              if (!data) return false
              const fromFiles = Array.from(data.files ?? []).find((f) =>
                f.type.startsWith('image/'),
              )
              const fromItems = Array.from(data.items ?? [])
                .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
                .map((item) => item.getAsFile())
                .find(Boolean)
              const file = fromFiles ?? fromItems
              if (!file) return false
              event.preventDefault()
              latest.current.onDropFile?.(file)
              void view
              return true
            },
            drop(event, view) {
              hideDropMarker(view)
              /* A picture being moved within the page. */
              const moved = event.dataTransfer?.getData(PICTURE_DRAG)
              if (moved) {
                event.preventDefault()
                const at = view.posAtCoords({ x: event.clientX, y: event.clientY })
                if (at == null) return true
                try {
                  const { from, to } = JSON.parse(moved) as { from: number; to: number }
                  movePicture(view, from, to, at)
                } catch {
                  /* a payload we didn't write */
                }
                return true
              }

              const file = event.dataTransfer?.files?.[0]
              if (!file || !file.type.startsWith('image/')) return false
              event.preventDefault()
              latest.current.onDropFile?.(file)
              return true
            },
            dragover(event, view) {
              const types = event.dataTransfer?.types
              if (!types?.includes('Files') && !types?.includes(PICTURE_DRAG)) return false
              event.preventDefault()
              /* Show where it will land before the finger or mouse lets go. */
              const at = view.posAtCoords({ x: event.clientX, y: event.clientY })
              if (at != null) showDropMarker(view, view.state.doc.lineAt(at).from)
              return false
            },
            dragleave(event, view) {
              /* Crossing between lines fires dragleave with a null
                 relatedTarget, so go by where the pointer actually is —
                 otherwise the marker blinks out on every line boundary. */
              const bounds = view.contentDOM.getBoundingClientRect()
              const outside =
                event.clientX < bounds.left ||
                event.clientX > bounds.right ||
                event.clientY < bounds.top ||
                event.clientY > bounds.bottom
              if (outside) hideDropMarker(view)
              return false
            },
            dragend(_event, view) {
              hideDropMarker(view)
              return false
            },
          }),
        ],
      }),
    })

    onView(view)
    if (autofocus === 'end') {
      view.dispatch({ selection: { anchor: view.state.doc.length }, scrollIntoView: true })
    }
    if (autofocus) view.focus()

    return () => {
      onView(null)
      view.destroy()
    }
    // The editor owns its document once created; the page id keys this component,
    // so a new page means a new instance rather than a doc swap under the caret.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div className="editor" ref={host} />
}
