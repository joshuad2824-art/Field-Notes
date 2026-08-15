import { RangeSet, type Extension, type Range } from '@codemirror/state'
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

const BOX_D =
  'M3.6 4.6C7.3 3.8 12.5 4.4 16.5 3.9c.5 3.8.1 8.5.4 12.4-4.2.7-9.4.1-13 .5C3.2 12.7 3.8 8.2 3.6 4.6z'
const CHECK_D = 'M4.6 9.9c1.5 1.5 2.8 3.4 4 5.7C10.9 10.8 13.9 6 17.6 2.3'

function svg(cls: string, d: string, width: number): SVGSVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  el.setAttribute('viewBox', '0 0 20 20')
  el.setAttribute('aria-hidden', 'true')
  el.setAttribute('class', cls)
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', d)
  path.setAttribute('stroke-width', String(width))
  el.appendChild(path)
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
    box.appendChild(svg('bx', BOX_D, 1.5))
    if (this.checked) box.appendChild(svg('ck', CHECK_D, 1.9))
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
