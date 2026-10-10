import { dueStamp, lateBy } from '../lib/format'

/* Completion keeps the due date for history, but stops calling it late. */
export function DueLabel({ at, completed = false }: { at: number; completed?: boolean }) {
  const late = completed ? '' : lateBy(at)
  return <>Due {dueStamp(at)}{late ? <> · <span className="reminder-late">{late}</span></> : null}</>
}
