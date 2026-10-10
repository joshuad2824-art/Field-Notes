import { createElement, type ReactNode } from 'react'
import { placement } from '../lib/table'
import { readingBlocks, safeReadingUrl, type ReadingBlock } from '../lib/reading'

export function InlineReading({ text }: { text: string }) {
  const nodes: ReactNode[] = []
  // Deliberately renders React text nodes rather than trusting saved HTML.
  const pattern = /\\([\\`*_[\]{}()#+.!|~-])|`([^`]+)`|\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|\*([^*\n]+)\*|_([^_\n]+)_|~~([^~]+)~~|==(?:\{\w+\})?([^=]+)==|<u>([^<>]*)<\/u>|\[([^\]]+)\]\(([^\s)]+)(?:\s+"[^"]*")?\)|https?:\/\/[^\s<>]+/g
  let at = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index! > at) nodes.push(text.slice(at, match.index))
    const key = match.index
    if (match[1]) nodes.push(match[1])
    else if (match[2]) nodes.push(<code key={key}>{match[2]}</code>)
    else if (match[3] || match[4]) nodes.push(<strong key={key}><InlineReading text={match[3] || match[4]} /></strong>)
    else if (match[5] || match[6]) nodes.push(<em key={key}><InlineReading text={match[5] || match[6]} /></em>)
    else if (match[7]) nodes.push(<s key={key}><InlineReading text={match[7]} /></s>)
    else if (match[8]) nodes.push(<mark key={key}><InlineReading text={match[8]} /></mark>)
    else if (match[9] !== undefined) nodes.push(<u key={key}>{match[9]}</u>)
    else {
      const label = match[10] || match[0], url = safeReadingUrl(match[11] || match[0])
      nodes.push(url ? <a key={key} href={url} target={url.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer"><InlineReading text={match[10] || ''} />{match[10] ? null : label}</a> : <span key={key}>{label}</span>)
    }
    at = match.index! + match[0].length
  }
  if (at < text.length) nodes.push(text.slice(at))
  return <>{nodes}</>
}

export function ReadingBlocks({ blocks, image, headingOffset = 0 }: { blocks: ReadingBlock[]; image?: (id: string, caption: string) => ReactNode; headingOffset?: number }) {
  return <>{blocks.map((block, i) => {
    if (block.kind === 'heading') return createElement(`h${Math.min(6, block.level + headingOffset)}`, { key: i, style: { textAlign: block.align } }, <InlineReading text={block.text} />)
    if (block.kind === 'paragraph') return <p key={i} style={{ textAlign: block.align }}><InlineReading text={block.text} /></p>
    if (block.kind === 'code') return <pre key={i} tabIndex={0} aria-label={block.language ? `${block.language} diagram or code` : 'Diagram or code'}><code>{block.text}</code></pre>
    if (block.kind === 'rule') return <hr key={i} />
    if (block.kind === 'image') return <div key={i}>{image ? image(block.id, block.caption) : <p className="reading-image-label">{block.caption || 'Attached image'}</p>}</div>
    if (block.kind === 'quote') return <blockquote key={i}><ReadingBlocks blocks={block.blocks} image={image} headingOffset={headingOffset} /></blockquote>
    if (block.kind === 'table') {
      const table = block.table
      if (table) { const spots = placement(table); return <div className="plan-table-wrap" key={i} tabIndex={0} aria-label="Plan table"><table style={{ width: `${table.width}%` }}><colgroup>{table.widths.map((width, j) => <col key={j} style={{ width: `${width}%` }} />)}</colgroup><tbody>{table.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => createElement(r === 0 ? 'th' : 'td', { key: c, scope: r === 0 ? 'col' : undefined, colSpan: cell.span, rowSpan: cell.rows, style: { textAlign: table.aligns[spots.find(spot => spot.row === r && spot.index === c)?.column ?? c] } }, <InlineReading text={cell.text} />))}</tr>)}</tbody></table></div> }
      return <div className="plan-table-wrap" key={i} tabIndex={0} aria-label="Plan table"><table><thead><tr>{block.head.map((cell, j) => <th scope="col" key={j}><InlineReading text={cell} /></th>)}</tr></thead><tbody>{block.rows.map((row, j) => <tr key={j}>{row.map((cell, k) => <td key={k}><InlineReading text={cell} /></td>)}</tr>)}</tbody></table></div>
    }
    return createElement(block.ordered ? 'ol' : 'ul', { key: i, start: block.ordered ? block.start : undefined }, block.items.map((item, j) => <li key={j} className={item.checked === undefined ? undefined : 'reading-check-item'}>{item.checked !== undefined ? <span className="reading-check" role="img" aria-label={item.checked ? 'Completed' : 'Not completed'}>{item.checked ? '✓' : '○'}</span> : null}<div><ReadingBlocks blocks={item.blocks} image={image} headingOffset={headingOffset} /></div></li>))
  })}</>
}

export function Reading({ text }: { text: string }) {
  return <div className="reading-content plan-text"><ReadingBlocks blocks={readingBlocks(text)} /></div>
}
