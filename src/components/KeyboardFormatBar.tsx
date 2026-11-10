import { type RefObject } from 'react'
import type { EditorView } from '@codemirror/view'
import { undo, redo } from '@codemirror/commands'
import { applyBlock } from '../editor/commands'
import { insertTable } from '../editor/table'
import { Icon } from './Icon'

interface Props {
  view: EditorView | null
  expanded: boolean
  keyboardOpen: boolean
  toggleRef: RefObject<HTMLButtonElement | null>
  onToggle: () => void
  onPicture: () => void
  onDone: () => void
  onBack: () => void
  backLabel: string
}

export function KeyboardFormatBar({ view, expanded, keyboardOpen, toggleRef, onToggle, onPicture, onDone, onBack, backLabel }: Props) {
  const hold = (event: { preventDefault: () => void }) => event.preventDefault()
  return <div className="keyboard-format-dock" data-tray-keep="">
    <div className="keyboard-format-bar" role="toolbar" aria-label="Note formatting">
      <button className="keyboard-format-back" onMouseDown={hold} onClick={onBack} aria-label={backLabel} title={backLabel}><Icon name="back" /></button>
      <div className="keyboard-format-actions">
        <button ref={toggleRef} onMouseDown={hold} onClick={onToggle} aria-label="Style" aria-expanded={expanded} title="Formatting"><span className="keyboard-aa">Aa</span></button>
        <button onMouseDown={hold} onClick={() => view && applyBlock(view, '- [ ] ')} aria-label="Checklist" title="Checklist"><Icon name="checklist" /></button>
        <button onMouseDown={hold} onClick={() => view && insertTable(view)} aria-label="Insert table" title="Table"><Icon name="table" /></button>
        <button onMouseDown={hold} onClick={onPicture} aria-label="Insert picture" title="Picture"><Icon name="image" /></button>
        <button onMouseDown={hold} onClick={() => view && undo(view)} aria-label="Undo" title="Undo"><Icon name="undo" /></button>
        <button onMouseDown={hold} onClick={() => view && redo(view)} aria-label="Redo" title="Redo"><Icon name="redo" /></button>
      </div>
      <button className="keyboard-format-done" onMouseDown={hold} onClick={onDone} aria-label={keyboardOpen ? 'Hide keyboard' : 'Close formatting'} title={keyboardOpen ? 'Hide keyboard' : 'Close formatting'}><Icon name={keyboardOpen ? 'hide-keyboard' : 'close'} /></button>
    </div>
  </div>
}
