/* What a scroller's travel says about the pill, and nothing about the pill
   itself: no React, no DOM, no clock — so `npm run check` can prove the whole
   truth table on node (tests/pill-scroll.mjs).

   The pill used to answer every scroll event on its own. Down by more than two
   pixels receded it; up by more than two brought it back; and a quarter of a
   second without an event brought it back as well. That is three ways to flip
   and no memory, and a scroller that is not perfectly steady will use all of
   them in a second: a mouse wheel arrives in notches with gaps wider than a
   quarter second, a trackpad's momentum has a gap in it, and CodeMirror — which
   draws only the lines in view and estimates the rest — corrects the editor's
   scrollTop by a few pixels, up and down, every time a line it guessed at is
   measured. Read down a long page and the toolbar blinked in and out under
   your eyes (October 14, from Joshua's own recording).

   So the pill now asks for a run, not a nudge. A run is travel in one
   direction since the scroller last turned round, measured to the furthest
   point it reached; turning round takes a real step back (about a line), and a
   turn starts a new run where the old one peaked. A few pixels of correction
   against the grain neither end a run nor add to one. Going down has to go
   further than coming back, because reading is mostly down and a glance up is
   not a decision. */

/* Travel, in px, before a scroller is allowed to say anything. */
export const TRAVEL_DOWN = 64
export const TRAVEL_UP = 48
/* And how far back against a run counts as turning round rather than as the
   scroller settling: about a line of the page. Anything shorter is a
   correction, and a correction neither ends a run nor adds to one. */
export const TURN = 24

/* Which way one scroller is going, where that run began, and the furthest it
   has got along it. */
export interface Travel {
  dir: -1 | 0 | 1
  from: number
  edge: number
}

export type Verdict = 'down' | 'up' | null

/* A scroller seen for the first time is taken to have been at the top. The pill
   has no earlier reading to compare with, and a page restored to the middle
   reads as a long scroll down — which is what it was. */
export const unseen: Travel = { dir: 0, from: 0, edge: 0 }

/* `top` is the scroller's own scrollTop, already held between 0 and its
   furthest point by the caller: iOS lets a scroller travel past either end and
   spring back, and that spring is not the reader scrolling up.

   Measured to the furthest point of the run rather than to where the scroller
   is this instant, so a page that is read down with a few pixels of
   correction every screen still adds up to a run; the first version restarted
   the count at every nudge back, and a scroller that never travelled more than
   30px between corrections never said anything at all. */
export function travel(prev: Travel | undefined, top: number): { next: Travel; verdict: Verdict } {
  const was = prev ?? unseen
  let { dir, from, edge } = was
  if (dir === 0) {
    /* Sub-pixel noise is not travel — and not a direction either. */
    if (Math.abs(top - from) < 1) return { next: was, verdict: null }
    dir = top > from ? 1 : -1
    edge = top
  } else if (dir > 0) {
    if (top >= edge) edge = top
    else if (edge - top >= TURN) {
      dir = -1
      from = edge
      edge = top
    }
  } else if (top <= edge) edge = top
  else if (top - edge >= TURN) {
    dir = 1
    from = edge
    edge = top
  }
  const run = Math.abs(edge - from)
  const verdict: Verdict = dir > 0 && run >= TRAVEL_DOWN ? 'down' : dir < 0 && run >= TRAVEL_UP ? 'up' : null
  return { next: { dir, from, edge }, verdict }
}

/* How long the pill holds a verdict before a scroll may reverse it, how long a
   scroller must be quiet before the pill comes back on its own, and how soon
   after a scroll a mouse's movement counts as the reader reaching for it.
   Browsers send a mouse move after a scroll to refresh what is under the
   pointer, and a hand on a wheel is never perfectly still; neither is reaching
   for anything. */
export const HOLD_MS = 500
export const SETTLE_MS = 800
export const AFTER_SCROLL_MS = 500
/* And how far the pointer has to travel to be reaching at all. */
export const REACH_PX = 6
