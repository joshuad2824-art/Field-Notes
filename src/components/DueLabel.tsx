import { dueStamp, lateBy } from '../lib/format'

/* A reminder whose time has passed carries one small mark beside the time —
   a dot, not a colour on the words, so the one-amber rule is untouched and a
   late reminder is told apart at a glance from one still to come. The mark
   says what it means to a screen reader and on hover. */
export function DueLabel({ at, completed = false, now = Date.now() }: { at: number; completed?: boolean; now?: number }) {
  const late = !completed && at < now
  const by = late ? lateBy(at, now) : ''
  return (
    <span className={`due-label${late ? ' is-late' : ''}`}>
      {late ? (
        <span className="due-late" role="img" aria-label={by ? `Overdue, ${by}` : 'Overdue'} title={by ? `Overdue · ${by}` : 'Overdue'} />
      ) : null}
      Due {dueStamp(at)}
    </span>
  )
}
