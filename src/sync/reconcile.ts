/* The whole decision sync makes, with nothing around it. No Dexie, no fetch,
   no clock — everything here is a function of its arguments, which is why
   `npm run check` can run this file directly on node and doesn't need a
   server, a browser or a network to prove the rules hold.

   The rule from the architecture note, stated once: last-write-wins, but never
   silently. When two versions of a page have both moved since the devices last
   agreed, the newer one keeps the page and the older one is preserved as a
   copy in the same notebook. A stray duplicate is a mild annoyance; a silently
   discarded evening of writing is how an app loses trust permanently. */

import type { Page } from '../lib/model'

export type Verdict =
  /* nothing to do */
  | 'none'
  /* the device is ahead — send ours */
  | 'push'
  /* the mirror is ahead — take theirs */
  | 'apply'
  /* both moved. ours is newer: keep it, and keep theirs as a copy */
  | 'keep-local'
  /* both moved. theirs is newer: take it, and keep ours as a copy */
  | 'keep-remote'

export interface Facts {
  hasLocal: boolean
  /* Present in this pull — which is to say, changed on the mirror since our
     cursor. A row absent from the batch is unchanged, not missing. */
  hasRemote: boolean
  localUpdated: number
  remoteUpdated: number
  /* The `updated` both sides last agreed on, if they ever have. */
  marked?: number
  /* Same writing, same attributes — the same thought reached twice. */
  identical: boolean
  remoteDeleted: boolean
}

export function decide(f: Facts): Verdict {
  if (!f.hasLocal && !f.hasRemote) return 'none'

  /* A row we have never held that arrives already dead has nothing to delete.
     Applying it would create a tombstone, which would sit for thirty days and
     then be purged, having stood for a page this device never had. */
  if (!f.hasLocal) return f.remoteDeleted && f.marked === undefined ? 'none' : 'apply'

  const dirty = f.marked === undefined || f.localUpdated !== f.marked
  if (!f.hasRemote) return dirty ? 'push' : 'none'

  const moved = f.marked === undefined || f.remoteUpdated !== f.marked
  if (!dirty && !moved) return 'none'
  if (!dirty) return 'apply'
  if (!moved) return 'push'

  /* Both moved. If they moved to the same place it isn't a conflict — take
     whichever is nominally newer and leave no copy behind. */
  if (f.identical) return f.localUpdated >= f.remoteUpdated ? 'push' : 'apply'
  return f.localUpdated >= f.remoteUpdated ? 'keep-local' : 'keep-remote'
}

/* What counts as the same page. `updated` is deliberately not in here — two
   devices agreeing on the writing but not on the millisecond is not a
   conflict, and treating it as one would spawn a copy for every touch. */
export function samePage(a: Page, b: Page): boolean {
  return (
    a.body === b.body &&
    a.notebook === b.notebook &&
    a.pinned === b.pinned &&
    (a.entryDate ?? '') === (b.entryDate ?? '') &&
    (a.pen ?? '') === (b.pen ?? '') &&
    (a.stock ?? '') === (b.stock ?? '') &&
    !a.deleted === !b.deleted
  )
}

/* The losing side of a conflict, kept as its own page. It opens with one line
   saying what it is, because two pages with the same title and no explanation
   is a worse thing to find than one extra line to delete. The line is a
   blockquote and a tag, so the copy is both visible in the list and findable
   under #conflict. */
export function conflictBody(body: string, stamp: string): string {
  return `> Conflicting copy · ${stamp} #conflict\n\n${body}`
}

export const CONFLICT_TAG = 'conflict'
