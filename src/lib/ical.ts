import type { FieldEvent } from './model.ts'

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,')
}

function fold(line: string): string {
  const encoder = new TextEncoder()
  const parts: string[] = []
  let part = ''
  let bytes = 0
  for (const char of line) {
    const length = encoder.encode(char).length
    if (bytes + length > 75) {
      parts.push(part)
      part = ' '
      bytes = 1
    }
    part += char
    bytes += length
  }
  parts.push(part)
  return parts.join('\r\n')
}

function nextDay(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + 1))
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}

export function eventIcs(event: FieldEvent): string {
  const date = event.date.replace(/-/g, '')
  const stamp = new Date(event.updated).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Timber & Ink//Field Notes//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:field-notes-${event.id}@timber-inkfieldnotes.netlify.app`,
    `DTSTAMP:${stamp}`,
    `SUMMARY:${escapeText(event.title)}`,
  ]
  if (event.startTime) {
    lines.push(`DTSTART:${date}T${event.startTime.replace(':', '')}00`)
    if (event.endTime) lines.push(`DTEND:${date}T${event.endTime.replace(':', '')}00`)
    else lines.push('DURATION:PT1H')
  } else {
    lines.push(`DTSTART;VALUE=DATE:${date}`, `DTEND;VALUE=DATE:${nextDay(event.date)}`)
  }
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`)
  if (event.note) lines.push(`DESCRIPTION:${escapeText(event.note)}`)
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

export async function handoffToAppleCalendar(event: FieldEvent): Promise<'shared' | 'downloaded'> {
  const name = `${event.date} ${event.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'event'}.ics`
  const file = new File([eventIcs(event)], name, { type: 'text/calendar' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: event.title })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
    }
  }
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return 'downloaded'
}
