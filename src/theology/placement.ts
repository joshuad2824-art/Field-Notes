// Where the reading's two popovers sit: the highlight toolbar and a saved
// highlight's actions. Both are measured rather than assumed, so a wrapped row,
// a longer label or enlarged text can't push a button off the screen or under
// the pill. Placement only writes left, top and max-height; it never moves focus.
export type AnchorRect = Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>

const EDGE = 12, GAP = 8

function viewport() {
  const v = window.visualViewport
  return v ? {left: v.offsetLeft, top: v.offsetTop, width: v.width, height: v.height} : {left: 0, top: 0, width: innerWidth, height: innerHeight}
}

// The pill keeps its box when it recedes, so its top is a steady floor.
function floor(view: ReturnType<typeof viewport>) {
  const bottom = view.top + view.height, pill = document.querySelector<HTMLElement>('nav.floating-nav')?.getBoundingClientRect()
  return (pill && pill.height > 0 && pill.top < bottom ? Math.min(bottom, pill.top) : bottom) - GAP
}

// Above the passage, else below it, else as low as the pill allows. A popover
// taller than the room it has scrolls inside itself rather than leaving the screen.
// The width limit is the visual viewport's, set on the element itself before it is measured, so
// under pinch zoom the row wraps to what can be seen rather than to the layout viewport.
export function placePopover(el: HTMLElement, anchor: AnchorRect) {
  const view = viewport(), scrolled = el.scrollTop
  el.style.maxHeight = ''
  el.style.maxWidth = `${Math.max(44, view.width - EDGE * 2)}px`
  el.style.left = `${view.left}px`
  el.style.top = `${view.top}px`
  const top0 = view.top + EDGE, bottom = floor(view), room = Math.max(44, bottom - top0)
  // Only a popover taller than its room scrolls, and only then may a finger pan it.
  el.toggleAttribute('data-overflow', el.offsetHeight > room)
  const width = el.offsetWidth, height = Math.min(el.offsetHeight, room)
  const left = Math.max(view.left + EDGE, Math.min(view.left + view.width - EDGE - width, anchor.left + anchor.width / 2 - width / 2))
  const wanted = anchor.top - GAP - height >= top0 ? anchor.top - GAP - height : anchor.bottom + GAP + height <= bottom ? anchor.bottom + GAP : bottom - height
  const top = Math.max(top0, Math.min(wanted, bottom - height))
  el.style.left = `${left}px`
  el.style.top = `${top}px`
  el.style.maxHeight = `${room}px`
  // Measuring took the height limit off for a moment; give a scrolled popover its place back.
  el.scrollTop = scrolled
}

// Whether any of the anchor survives every scroller that clips it and the screen.
export function anchorVisible(anchor: Element) {
  const r = anchor.getBoundingClientRect()
  let left = r.left, top = r.top, right = r.right, bottom = r.bottom
  for (let el = anchor.parentElement; el && el !== document.body; el = el.parentElement) {
    const style = getComputedStyle(el)
    if (!/(auto|scroll|hidden|clip)/.test(style.overflowX + style.overflowY)) continue
    const c = el.getBoundingClientRect()
    left = Math.max(left, c.left); top = Math.max(top, c.top); right = Math.min(right, c.right); bottom = Math.min(bottom, c.bottom)
  }
  const view = viewport()
  left = Math.max(left, view.left); top = Math.max(top, view.top); right = Math.min(right, view.left + view.width); bottom = Math.min(bottom, view.top + view.height)
  return right > left && bottom > top
}
