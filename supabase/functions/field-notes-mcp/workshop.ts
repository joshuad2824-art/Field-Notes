// Pure validation shared by MCP handlers and local checks.
export function metadataText(body: string) {
  let fenced = false
  return body.split('\n').filter(line => { if (/^\s*(?:`{3,}|~{3,})/.test(line)) { fenced = !fenced; return false }; return !fenced }).join('\n')
}
export function hasMark(body: string, tag: string) { return new RegExp(`(^|\\s)#${tag}(?=[^\\w-]|$)`, 'im').test(metadataText(body)) }
export function detail(body: string, label: string) { return metadataText(body).split('\n').find(line => line.toLowerCase().startsWith(`${label.toLowerCase()}:`))?.slice(label.length + 1).trim() || '' }
export function workshopBody(body: string, kind: 'plan' | 'equipment', values: Record<string, string | undefined>, owned: boolean) {
  if (kind === 'equipment' && !owned) throw new Error('Equipment requires explicit confirmation that it is already owned.')
  const allowed = kind === 'plan' ? ['Project', 'Version'] : ['Brand', 'Model']
  let fenced = false
  const lines = body.split('\n'), consumed = new Set<string>()
  const result = lines.map(line => {
    if (/^\s*(?:`{3,}|~{3,})/.test(line)) { fenced = !fenced; return line }
    if (!fenced) for (const label of allowed) if (values[label] !== undefined && line.toLowerCase().startsWith(`${label.toLowerCase()}:`)) {
      consumed.add(label); return values[label] ? `${label}: ${values[label]}` : ''
    }
    return line
  })
  for (const label of allowed) if (values[label] !== undefined && !consumed.has(label) && values[label]) result.push(`${label}: ${values[label]}`)
  const tag = kind === 'plan' ? 'project-plan' : 'owned'
  if (!hasMark(body, tag)) result.push(`#${tag}`)
  return result.join('\n')
}
export function imageReferences(body: string): string[] {
  return [...new Set([...body.matchAll(/!\[[^\]]*\]\(images\/([a-zA-Z0-9_-]+)\.[a-zA-Z0-9]+\)/g)].map(match => match[1]))]
}
export function validateImage(bytes: string, mime: string) {
  if (!bytes || bytes.length > 11_184_812 || bytes.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(bytes)) throw new Error('Provide plain base64 image bytes, up to 8 MB; no data URL.')
  const raw = atob(bytes)
  if (!raw.length || raw.length > 8 * 1024 * 1024) throw new Error('Image exceeds 8 MB.')
  const formats: Record<string, [string, boolean]> = {
    'image/png': ['png', raw.startsWith('\x89PNG\r\n\x1a\n')],
    'image/jpeg': ['jpg', raw.startsWith('\xff\xd8\xff')],
    'image/webp': ['webp', raw.startsWith('RIFF') && raw.slice(8, 12) === 'WEBP'],
    'image/gif': ['gif', raw.startsWith('GIF87a') || raw.startsWith('GIF89a')],
  }
  if (!formats[mime]?.[1]) throw new Error('Image bytes do not match a supported PNG, JPEG, WebP, or GIF type.')
  return { ext: formats[mime][0], byteLength: raw.length }
}
export function dateValid(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value }
export function validateEvent(event: { date: string; end_date?: string | null; start_time?: string | null; end_time?: string | null }) {
  if (!dateValid(event.date) || (event.end_date && (!dateValid(event.end_date) || event.end_date < event.date))) throw new Error('Choose valid dates with the end on or after the start.')
  const clock = /^([01][0-9]|2[0-3]):[0-5][0-9]$/
  if ([event.start_time, event.end_time].some(time => time && !clock.test(time))) throw new Error('Use 24-hour HH:MM times.')
  if (event.end_time && !event.start_time) throw new Error('End time requires a start time.')
  if (event.start_time && event.end_date && event.end_date > event.date && !event.end_time) throw new Error('Timed multi-day events require an end time.')
  if (event.start_time && event.end_time && (!event.end_date || event.end_date === event.date) && event.end_time <= event.start_time) throw new Error('End time must follow start time.')
}
