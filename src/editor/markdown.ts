import { RangeSet, type Extension, type Range } from '@codemirror/state'
import { IMAGE_RE, PICTURE_DRAG, type Placement } from '../lib/model'
import { cachedImageUrl, imageUrl } from '../lib/images'
import { movePicture } from './commands'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view'

/* Live markdown, drawn rather than described.

   The syntax is never shown — not on hover, not on the active line. Every
   marker is a `replace` decoration, which also registers as an atomic range,
   so the cursor steps over `**` in one move and backspace takes both
   asterisks at once. That is the whole reason this is CodeMirror and not the
   spike's re-render-everything loop. */

/* ── the drawn marks ────────────────────────────────────────────────── */

/* Drawn by hand, not stamped. The box is a circle now, and fills brass when
   it's ticked with the check cut out of it in the page's own colour. */
const BOX_D =
  'M10 2.6c4.3-.5 7.7 3.2 7.4 7.5-.2 4.2-3.5 7.5-7.7 7.3C5.4 17.2 2.3 13.8 2.7 9.6 3 5.8 6.1 2.9 10 2.6z'
const CHECK_D = 'M6.2 10.2c1.1 1.1 2 2.4 2.8 4C10.7 10.6 12.8 7.2 15.4 4.6'

function svgFor(checked: boolean): SVGSVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  el.setAttribute('viewBox', '0 0 20 20')
  el.setAttribute('aria-hidden', 'true')

  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  ring.setAttribute('d', BOX_D)
  ring.setAttribute('class', checked ? 'bx bx-on' : 'bx')
  ring.setAttribute('stroke-width', '1.5')
  el.appendChild(ring)

  if (checked) {
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    tick.setAttribute('d', CHECK_D)
    tick.setAttribute('class', 'ck')
    tick.setAttribute('stroke-width', '1.9')
    el.appendChild(tick)
  }
  return el
}

class CheckboxWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly to: number,
    readonly checked: boolean,
  ) {
    super()
  }

  eq(other: CheckboxWidget) {
    return other.checked === this.checked && other.from === this.from
  }

  toDOM(view: EditorView) {
    const box = document.createElement('span')
    box.className = 'md-box'
    box.setAttribute('role', 'checkbox')
    box.setAttribute('aria-checked', String(this.checked))
    box.contentEditable = 'false'
    box.appendChild(svgFor(this.checked))
    box.addEventListener('mousedown', (e) => {
      e.preventDefault()
      view.dispatch({
        changes: { from: this.from, to: this.to, insert: this.checked ? '[ ]' : '[x]' },
      })
    })
    return box
  }

  ignoreEvent() {
    return true
  }
}

class GlyphWidget extends WidgetType {
  constructor(
    readonly text: string,
    readonly cls: string,
  ) {
    super()
  }

  eq(other: GlyphWidget) {
    return other.text === this.text && other.cls === this.cls
  }

  toDOM() {
    const el = document.createElement('span')
    el.className = this.cls
    el.textContent = this.text
    el.contentEditable = 'false'
    return el
  }

  ignoreEvent() {
    return true
  }
}

/* A picture on the page. The markdown carries the path it will have on export
   and where it sits; the bytes come out of Dexie. */
class PictureWidget extends WidgetType {
  constructor(
    readonly id: string,
    readonly caption: string,
    readonly placement: Placement,
    readonly ext: string,
    readonly from: number,
    readonly to: number,
  ) {
    super()
  }

  eq(other: PictureWidget) {
    return (
      other.id === this.id &&
      other.caption === this.caption &&
      other.placement === this.placement &&
      other.from === this.from
    )
  }

  toDOM(view: EditorView) {
    const figure = document.createElement('span')
    const vector = this.ext.toLowerCase() === 'svg'
    figure.className =
      `md-plate md-plate-${this.placement}` + (vector ? ' md-plate-vector' : '')
    figure.contentEditable = 'false'

    const img = document.createElement('img')
    img.className = 'md-plate-image'
    img.alt = this.caption
    /* Pick the picture up and put it somewhere else in the page. */
    img.draggable = true
    img.addEventListener('dragstart', (event) => {
      event.dataTransfer?.setData(
        PICTURE_DRAG,
        JSON.stringify({ from: this.from, to: this.to }),
      )
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
    })

    /* iOS never fires dragstart, so touch gets its own lift: press and hold,
       then move. Without this the picture can only be moved on a desktop. */
    let hold: number | undefined
    let lifted = false

    const drop = (x: number, y: number) => {
      const at = view.posAtCoords({ x, y })
      if (at != null) movePicture(view, this.from, this.to, at)
    }
    const release = () => {
      clearTimeout(hold)
      figure.classList.remove('lifted')
      lifted = false
    }

    img.addEventListener(
      'touchstart',
      () => {
        hold = window.setTimeout(() => {
          lifted = true
          figure.classList.add('lifted')
        }, 350)
      },
      { passive: true },
    )
    img.addEventListener(
      'touchmove',
      (event) => {
        if (!lifted) return release()
        event.preventDefault()
      },
      { passive: false },
    )
    img.addEventListener('touchend', (event) => {
      const wasLifted = lifted
      const touch = event.changedTouches[0]
      release()
      if (wasLifted && touch) drop(touch.clientX, touch.clientY)
    })
    img.addEventListener('touchcancel', release)

    const known = cachedImageUrl(this.id)
    if (known) img.src = known
    else void imageUrl(this.id).then((url) => url && (img.src = url))
    figure.appendChild(img)

    if (this.caption) {
      const caption = document.createElement('span')
      caption.className = 'md-plate-caption'
      caption.textContent = this.caption
      figure.appendChild(caption)
    }
    return figure
  }

  ignoreEvent(event: Event) {
    /* Let a drag or a lift through; swallow everything else. */
    return !event.type.startsWith('drag') && !event.type.startsWith('touch')
  }
}

class RuleWidget extends WidgetType {
  eq() {
    return true
  }

  toDOM() {
    const el = document.createElement('span')
    el.className = 'md-rule-line'
    el.contentEditable = 'false'
    return el
  }

  ignoreEvent() {
    return true
  }
}

/* ── the grammar ────────────────────────────────────────────────────── */

const RE = {
  heading: /^(#{1,3})(\s+)(.*)$/,
  todo: /^([-*]\s)(\[[ xX]\])(\s)(.*)$/,
  quote: /^(>\s?)(.*)$/,
  ordered: /^(\d+\.\s)(.*)$/,
  bullet: /^([-*])(\s)(.*)$/,
  rule: /^-{3,}$/,
}

const INLINE = {
  picture: IMAGE_RE,
  code: /`([^`]+)`/g,
  highlight: /==(?:\{(\w+)\})?([^=]+)==/g,
  strong: /\*\*([^*]+)\*\*/g,
  strike: /~~([^~]+)~~/g,
  em: /(^|[^*\w])\*([^*\n]+)\*(?!\*)/g,
  tag: /(^|\s)(#[A-Za-z][\w-]*)/g,
}

const HL_COLORS = new Set(['oxblood', 'forest', 'navy', 'driftwood', 'brass'])

const hidden = Decoration.replace({})
const lineDeco = (cls: string) => Decoration.line({ class: cls })
const markDeco = (cls: string) => Decoration.mark({ class: cls })

type Ranges = Range<Decoration>[]

interface Build {
  marks: Ranges
  atoms: Ranges
  blocked: [number, number][]
}

function block(b: Build, from: number, to: number, deco = hidden) {
  if (to <= from) return
  b.marks.push(deco.range(from, to))
  b.atoms.push(deco.range(from, to))
  b.blocked.push([from, to])
}

function isBlocked(b: Build, from: number, to: number) {
  return b.blocked.some(([s, e]) => from < e && to > s)
}

function decorateInline(b: Build, base: number, text: string) {
  const local: [number, number][] = []
  const free = (from: number, to: number) =>
    !isBlocked(b, from, to) && !local.some(([s, e]) => from < e && to > s)

  /* Pictures first — everything inside the node is a path, not prose. */
  for (const m of text.matchAll(INLINE.picture)) {
    const from = base + m.index
    const to = from + m[0].length
    if (!free(from, to)) continue
    local.push([from, to])
    const placement: Placement = m[4] === 'full' ? 'full' : 'margin'
    block(
      b,
      from,
      to,
      Decoration.replace({
        widget: new PictureWidget(m[2], m[1], placement, m[3], from, to),
      }),
    )
  }

  /* Code first, and its contents are then off limits — a backtick span is
     literal by definition. */
  for (const m of text.matchAll(INLINE.code)) {
    const from = base + m.index
    const to = from + m[0].length
    if (!free(from, to)) continue
    local.push([from, to])
    block(b, from, from + 1)
    b.marks.push(markDeco('md-code').range(from + 1, to - 1))
    block(b, to - 1, to)
  }

  for (const m of text.matchAll(INLINE.highlight)) {
    const from = base + m.index
    const to = from + m[0].length
    if (!free(from, to)) continue
    local.push([from, to])
    const color = m[1] && HL_COLORS.has(m[1]) ? m[1] : 'brass'
    const openLen = 2 + (m[1] ? m[1].length + 2 : 0)
    block(b, from, from + openLen)
    b.marks.push(markDeco(`md-hl md-hl-${color}`).range(from + openLen, to - 2))
    block(b, to - 2, to)
  }

  for (const [re, cls, len] of [
    [INLINE.strong, 'md-strong', 2],
    [INLINE.strike, 'md-strike', 2],
  ] as const) {
    for (const m of text.matchAll(re)) {
      const from = base + m.index
      const to = from + m[0].length
      if (!free(from, to)) continue
      local.push([from, to])
      block(b, from, from + len)
      b.marks.push(markDeco(cls).range(from + len, to - len))
      block(b, to - len, to)
    }
  }

  for (const m of text.matchAll(INLINE.em)) {
    const from = base + m.index + m[1].length
    const to = base + m.index + m[0].length
    if (!free(from, to)) continue
    local.push([from, to])
    block(b, from, from + 1)
    b.marks.push(markDeco('md-em').range(from + 1, to - 1))
    block(b, to - 1, to)
  }

  for (const m of text.matchAll(INLINE.tag)) {
    const from = base + m.index + m[1].length
    const to = from + m[2].length
    if (!free(from, to)) continue
    b.marks.push(markDeco('md-tag').range(from, to))
  }
}

function decorateLine(b: Build, from: number, text: string) {
  let m: RegExpMatchArray | null

  if ((m = text.match(RE.todo))) {
    const [, lead, box, gap, rest] = m
    const done = box.toLowerCase() === '[x]'
    const boxFrom = from + lead.length
    const boxTo = boxFrom + box.length
    b.marks.push(lineDeco('md-line md-todo').range(from))
    block(b, from, boxFrom)
    const widget = Decoration.replace({
      widget: new CheckboxWidget(boxFrom, boxTo, done),
    })
    block(b, boxFrom, boxTo + gap.length, widget)
    const contentFrom = boxTo + gap.length
    if (done && rest) b.marks.push(markDeco('md-done').range(contentFrom, from + text.length))
    decorateInline(b, contentFrom, rest)
    return
  }

  if ((m = text.match(RE.heading))) {
    const [, hashes, gap, rest] = m
    b.marks.push(lineDeco(`md-line md-h${hashes.length}`).range(from))
    block(b, from, from + hashes.length + gap.length)
    decorateInline(b, from + hashes.length + gap.length, rest)
    return
  }

  if ((m = text.match(RE.quote))) {
    const [, lead, rest] = m
    b.marks.push(lineDeco('md-line md-quote').range(from))
    block(b, from, from + lead.length)
    decorateInline(b, from + lead.length, rest)
    return
  }

  if (RE.rule.test(text)) {
    b.marks.push(lineDeco('md-line md-rule').range(from))
    block(b, from, from + text.length, Decoration.replace({ widget: new RuleWidget() }))
    return
  }

  if ((m = text.match(RE.ordered))) {
    const [, lead, rest] = m
    b.marks.push(lineDeco('md-line md-ol').range(from))
    block(
      b,
      from,
      from + lead.length,
      Decoration.replace({ widget: new GlyphWidget(lead.trim(), 'md-marker md-num') }),
    )
    decorateInline(b, from + lead.length, rest)
    return
  }

  if ((m = text.match(RE.bullet))) {
    const [, sign, gap, rest] = m
    const dot = sign === '*'
    b.marks.push(lineDeco(`md-line md-li ${dot ? 'md-dot' : 'md-dash'}`).range(from))
    block(
      b,
      from,
      from + sign.length + gap.length,
      Decoration.replace({
        widget: new GlyphWidget(dot ? '•' : '–', 'md-marker'),
      }),
    )
    decorateInline(b, from + sign.length + gap.length, rest)
    return
  }

  b.marks.push(lineDeco('md-line md-p').range(from))
  decorateInline(b, from, text)
}

function build(view: EditorView): { decorations: DecorationSet; atomic: RangeSet<Decoration> } {
  const b: Build = { marks: [], atoms: [], blocked: [] }
  const doc = view.state.doc
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    decorateLine(b, line.from, line.text)
  }
  return {
    decorations: Decoration.set(b.marks, true),
    atomic: RangeSet.of(b.atoms, true),
  }
}

const livePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    atomic: RangeSet<Decoration>

    constructor(view: EditorView) {
      const built = build(view)
      this.decorations = built.decorations
      this.atomic = built.atomic
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        const built = build(update.view)
        this.decorations = built.decorations
        this.atomic = built.atomic
      }
    }
  },
  {
    decorations: (v) => v.decorations,
    provide: (plugin) =>
      EditorView.atomicRanges.of((view) => view.plugin(plugin)?.atomic ?? RangeSet.empty),
  },
)

export function liveMarkdown(): Extension {
  return [livePlugin, EditorView.lineWrapping]
}
