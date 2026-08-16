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
  autofocus?: boolean
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
