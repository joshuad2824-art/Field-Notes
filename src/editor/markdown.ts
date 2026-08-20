import { RangeSet, StateField, type Extension, type Range, type Text } from '@codemirror/state'
import {
  IMAGE_RE,
  PICTURE_DRAG,
  type Placement,
  defaultSize,
  depthOf,
  readPlacement,
  stepSize,
} from '../lib/model'
import { cachedCutout, cachedImageUrl, imageMeta } from '../lib/images'
import { tableDecoration, tableRunAt } from './table'
import { ALIGN_RE, movePicture, repicture } from './commands'
import { hideDropMarker, showDropMarker } from './dropmarker'
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

/* A picture on the page. The markdown carries the path it will have on export,
   which side the writing runs down and how wide it sits; the bytes come out of
   Dexie. */

/* Which plate is showing its controls. Kept outside the widget so it survives
   the rebuild that every edit causes. */
let activePicture: string | null = null

export function clearActivePicture(): void {
  activePicture = null
}

class PictureWidget extends WidgetType {
  constructor(
    readonly id: string,
    readonly caption: string,
    readonly placement: Placement,
    readonly size: number,
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
      other.size === this.size &&
      other.from === this.from
    )
  }

  toDOM(view: EditorView) {
    const figure = document.createElement('span')
    figure.className = `md-plate md-plate-${this.placement}`
    figure.style.setProperty('--plate-width', `${this.size}%`)
    figure.contentEditable = 'false'
    if (activePicture === this.id) figure.classList.add('active')

    const img = document.createElement('img')
    img.className = 'md-plate-image'
    img.alt = this.caption
    img.draggable = true

    /* A cut-out — an SVG or anything with transparency — is the graphic and
       nothing else. A photograph gets the plate. */
    const known = cachedImageUrl(this.id)
    const knownCutout = cachedCutout(this.id)
    if (known) img.src = known
    if (knownCutout) figure.classList.add('md-plate-cutout')
    if (!known || knownCutout === undefined) {
      void imageMeta(this.id).then((meta) => {
        if (!meta) return
        img.src = meta.url
        figure.classList.toggle('md-plate-cutout', meta.cutout)
      })
    }

    img.addEventListener('dragstart', (event) => {
      event.dataTransfer?.setData(
        PICTURE_DRAG,
        JSON.stringify({ from: this.from, to: this.to }),
      )
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
    })

    /* Tap or click shows the controls. */
    img.addEventListener('click', (event) => {
      event.preventDefault()
      activePicture = activePicture === this.id ? null : this.id
      figure.classList.toggle('active', activePicture === this.id)
    })

    /* iOS never fires dragstart, so touch gets its own lift: press and hold,
       then move. The marker follows the finger so you can see where it lands. */
    let hold: number | undefined
    let lifted = false

    const release = () => {
      clearTimeout(hold)
      figure.classList.remove('lifted')
      lifted = false
      hideDropMarker(view)
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
        if (!lifted) {
          clearTimeout(hold)
          return
        }
        event.preventDefault()
        const touch = event.touches[0]
        if (!touch) return
        const at = view.posAtCoords({ x: touch.clientX, y: touch.clientY })
        if (at != null) showDropMarker(view, view.state.doc.lineAt(at).from)
      },
      { passive: false },
    )
    img.addEventListener('touchend', (event) => {
      const wasLifted = lifted
      const touch = event.changedTouches[0]
      release()
      if (!wasLifted || !touch) return
      const at = view.posAtCoords({ x: touch.clientX, y: touch.clientY })
      if (at != null) movePicture(view, this.from, this.to, at)
    })
    img.addEventListener('touchcancel', release)

    figure.appendChild(img)

    if (this.caption) {
      const caption = document.createElement('span')
      caption.className = 'md-plate-caption'
      caption.textContent = this.caption
      figure.appendChild(caption)
    }

    /* The controls: which side the writing runs down, and how wide. */
    const bar = document.createElement('span')
    bar.className = 'plate-controls'

    const control = (label: string, title: string, run: () => void, on = false) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'plate-control' + (on ? ' on' : '')
      button.textContent = label
      button.title = title
      button.setAttribute('aria-label', title)
      button.addEventListener('mousedown', (e) => e.preventDefault())
      button.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        run()
      })
      bar.appendChild(button)
    }

    control(
      '◧',
      'Writing on the right',
      () => repicture(view, this.from, this.to, { placement: 'left' }),
      this.placement === 'left',
    )
    control(
      '▬',
      'Full measure',
      () => repicture(view, this.from, this.to, { placement: 'full' }),
      this.placement === 'full',
    )
    control(
      '◨',
      'Writing on the left',
      () => repicture(view, this.from, this.to, { placement: 'right' }),
      this.placement === 'right',
    )

    const gap = document.createElement('span')
    gap.className = 'plate-control-gap'
    bar.appendChild(gap)

    control('−', 'Smaller', () =>
      repicture(view, this.from, this.to, { size: stepSize(this.size, -1) }),
    )
    const readout = document.createElement('span')
    readout.className = 'plate-size'
    readout.textContent = `${Math.round(this.size)}%`
    bar.appendChild(readout)
    control('+', 'Larger', () =>
      repicture(view, this.from, this.to, { size: stepSize(this.size, 1) }),
    )

    figure.appendChild(bar)
    return figure
  }

  ignoreEvent() {
    /* Everything inside the plate is the plate's: the native drag the browser
       starts on the image, the press-and-hold, and the controls. Letting
       CodeMirror see mousedown here makes it start a text selection instead,
       which stops the drag from ever beginning. */
    return true
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
  align: ALIGN_RE,
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
  /* There is no markdown for underline, and the two candidates for inventing
     one are both taken: `__x__` is bold in CommonMark and `_x_` is italic. So
     this is the tag itself, which is the one thing every markdown reader
     already agrees about — `u` isn't a block tag, so it stays inline, the
     writing inside it is still parsed as markdown, and the line renders
     underlined in any editor that renders HTML at all. Seven characters of
     syntax to hide instead of four; the mechanism doesn't care. */
  underline: /<u>([^<>]+)<\/u>/g,
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

/* Hide a marker without claiming the run it belongs to, so other marks can
   still be found inside it and around it. Only ever safe for a marker no
   other rule could match — see the underline below. */
function mask(b: Build, from: number, to: number) {
  if (to <= from) return
  b.marks.push(hidden.range(from, to))
  b.atoms.push(hidden.range(from, to))
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
    const placement = readPlacement(m[4])
    const size = m[5] ? Number(m[5]) : defaultSize(placement)
    block(
      b,
      from,
      to,
      Decoration.replace({
        widget: new PictureWidget(m[2], m[1], placement, size, m[3], from, to),
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

  /* The underline goes in before the other paired marks, and alone among them
     it doesn't claim the run it wraps.

     Every other mark shuts the door behind it: a match registers the whole
     span, so a second mark inside it is skipped and its markers end up showing
     on the page. That is why `=={brass}**a**==` draws its asterisks. The
     underline can afford not to, because its tags are the only marker in here
     that no other rule could ever match — nothing else is looking for a `<` —
     so leaving the span open costs nothing and buys the one thing the others
     can't do. Both `<u>**a**</u>` and `**<u>a</u>**` draw, which matters
     because tapping U then B gives the first and B then U gives the second.

     First, though: it still asks whether it *may* match, so a `<u>` inside a
     code span stays the literal text it is. */
  for (const m of text.matchAll(INLINE.underline)) {
    const from = base + m.index
    const to = from + m[0].length
    if (!free(from, to)) continue
    mask(b, from, from + 3)
    b.marks.push(markDeco('md-underline').range(from + 3, to - 4))
    mask(b, to - 4, to)
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

  /* A line decoration has to sit at the start of its line, but the content
     offset moves past the indent. Keeping the two apart is load-bearing:
     hanging a line class off the moved offset drops it silently, and an
     indented bullet stops being a bullet at all. */
  const lineAt = from

  /* The spaces that carry the indent are syntax like any other marker: hidden,
     atomic, and re-said as space on the page. Everything below then works on
     the line as though it started at the margin. */
  const lead = text.match(/^ +/)?.[0]
  const depth = lead ? depthOf(text) : 0
  if (lead && depth > 0) {
    b.marks.push(lineDeco(`md-line md-in-${depth}`).range(lineAt))
    block(b, from, from + lead.length)
    from += lead.length
    text = text.slice(lead.length)
  }

  /* Where the line sits across the measure. A brace tag, the same shape as the
     one a highlight and a picture already carry, and hidden the same way — so
     a centred title is a centred title on the page and one legible word at the
     front of the line in any other editor. It comes after the indent and
     before everything else, so `{center}## A heading` is both. */
  if ((m = text.match(RE.align))) {
    const tag = m[0]
    b.marks.push(lineDeco(`md-line md-align-${m[1]}`).range(lineAt))
    block(b, from, from + tag.length)
    from += tag.length
    text = text.slice(tag.length)
  }

  if ((m = text.match(RE.todo))) {
    const [, lead, box, gap, rest] = m
    const done = box.toLowerCase() === '[x]'
    const boxFrom = from + lead.length
    const boxTo = boxFrom + box.length
    b.marks.push(lineDeco('md-line md-todo').range(lineAt))
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
    b.marks.push(lineDeco(`md-line md-h${hashes.length}`).range(lineAt))
    block(b, from, from + hashes.length + gap.length)
    decorateInline(b, from + hashes.length + gap.length, rest)
    return
  }

  if ((m = text.match(RE.quote))) {
    const [, lead, rest] = m
    b.marks.push(lineDeco('md-line md-quote').range(lineAt))
    block(b, from, from + lead.length)
    decorateInline(b, from + lead.length, rest)
    return
  }

  if (RE.rule.test(text)) {
    b.marks.push(lineDeco('md-line md-rule').range(lineAt))
    block(b, from, from + text.length, Decoration.replace({ widget: new RuleWidget() }))
    return
  }

  if ((m = text.match(RE.ordered))) {
    const [, lead, rest] = m
    b.marks.push(lineDeco('md-line md-ol').range(lineAt))
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
    b.marks.push(lineDeco(`md-line md-li ${dot ? 'md-dot' : 'md-dash'}`).range(lineAt))
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

  b.marks.push(lineDeco('md-line md-p').range(lineAt))
  decorateInline(b, from, text)
}

function build(view: EditorView): { decorations: DecorationSet; atomic: RangeSet<Decoration> } {
  const b: Build = { marks: [], atoms: [], blocked: [] }
  const doc = view.state.doc
  for (let i = 1; i <= doc.lines; i++) {
    /* A table is the one block that isn't a line — it's a run of them, and it
       stands in for the lot as a single widget. That widget is a *block*
       decoration, which CodeMirror will only take from a state field, so it
       is built in `tableField` below. All this loop does is keep its hands
       off the lines the table has already claimed. */
    const run = tableRunAt(doc, i)
    if (run) {
      i = run.lastLine
      continue
    }
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

/* Tables live in a state field rather than the view plugin, because a block
   decoration can only come from one. It carries its own atomic ranges too, so
   the caret steps over a whole table in one move instead of wandering into
   the pipes behind it. */
function buildTables(doc: Text): DecorationSet {
  const ranges: Range<Decoration>[] = []
  for (let i = 1; i <= doc.lines; i++) {
    const run = tableRunAt(doc, i)
    if (!run) continue
    const deco = tableDecoration(run)
    if (deco) ranges.push(deco.range(run.from, run.to))
    i = run.lastLine
  }
  return Decoration.set(ranges, true)
}

const tableField = StateField.define<DecorationSet>({
  create: (state) => buildTables(state.doc),
  update: (deco, tr) => (tr.docChanged ? buildTables(tr.state.doc) : deco),
  provide: (field) => [
    EditorView.decorations.from(field),
    EditorView.atomicRanges.of((view) => view.state.field(field)),
  ],
})

export function liveMarkdown(): Extension {
  return [tableField, livePlugin, EditorView.lineWrapping]
}
