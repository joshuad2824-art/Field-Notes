import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { liveMarkdown } from './markdown'
import { applyBlock, applyHighlight, applyWrap, continueList } from './commands'

interface Props {
  initialBody: string
  onChange: (body: string) => void
  onView: (view: EditorView | null) => void
  highlightColor: () => string
  autofocus?: boolean
}

export function Editor({ initialBody, onChange, onView, highlightColor, autofocus }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const latest = useRef({ onChange, highlightColor })
  latest.current = { onChange, highlightColor }

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
