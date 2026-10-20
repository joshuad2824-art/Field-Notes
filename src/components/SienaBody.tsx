import { ReadingBlocks } from './Reading'
import { readingBlocks, type ReadingBlock } from '../lib/reading'

/* One read-only presentation for every Siena surface. The stored message is
   never rewritten and raw HTML is only rendered as escaped React text. */
function messageBlocks(text: string): ReadingBlock[] {
  return readingBlocks(text).flatMap((block): ReadingBlock[] => {
    if (block.kind === 'heading') return [{ ...block, level: 4 }]
    if (block.kind !== 'paragraph') return [block]
    // Older plain-text messages often use a short, standalone label.
    const lines = block.text.split('\n')
    const parts: ReadingBlock[] = []
    let prose: string[] = []
    const flush = () => {
      if (prose.length) parts.push({ ...block, text: prose.join('\n') })
      prose = []
    }
    for (const line of lines) {
      if (/^[A-Z][\p{L}\p{N} &'’/(),—–-]{2,58}:$/u.test(line.trim())) {
        flush()
        parts.push({ kind: 'heading', level: 4, text: line.trim() })
      } else prose.push(line)
    }
    flush()
    return parts
  })
}

export function SienaBody({ text }: { text: string }) {
  return <div className="siena-prose"><ReadingBlocks blocks={messageBlocks(text)} /></div>
}
