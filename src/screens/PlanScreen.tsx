import { useEffect, useRef, useState } from 'react'
import { getPage } from '../lib/db'
import { attachPlanImage } from '../lib/plan-images'
import { getImage, imageUrl } from '../lib/images'
import { IMAGE_RE, titleOf, type Page } from '../lib/model'
import { field } from '../lib/project-desk'
import { useLive } from '../lib/useLive'
import { navigate, to } from '../lib/router'
import { Icon } from '../components/Icon'

function PlanImage({ id, caption }: { id: string; caption: string }) {
  const [picture, setPicture] = useState<{ url: string; pixels: string; bytes: number } | null>(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const [original, url] = await Promise.all([getImage(id), imageUrl(id)])
        if (!original || !url) { if (active) setMissing(true); return }
        const img = new Image(); img.src = url
        await img.decode()
        if (active) setPicture({ url, pixels: `${img.naturalWidth} × ${img.naturalHeight} px`, bytes: original.blob.size })
      } catch { if (active) setMissing(true) }
    })()
    return () => { active = false }
  }, [id])
  return <figure className="plan-image">{picture ? <><a href={picture.url} target="_blank" rel="noopener" aria-label={`Open original image: ${caption || 'Plan image'}`}><img src={picture.url} alt={caption || 'Plan reference'} /></a><figcaption>{caption || 'Plan reference'}<small>{picture.pixels} · Original file · {picture.bytes.toLocaleString()} bytes</small><a href={picture.url} target="_blank" rel="noopener">View original resolution</a></figcaption></> : <p role="status">{missing ? 'This original image is not available on this device yet.' : 'Loading original image…'}</p>}</figure>
}

function planParts(body: string) {
  const parts: ({ text: string } | { id: string; caption: string })[] = []
  const re = new RegExp(IMAGE_RE.source, 'g')
  let at = 0
  for (const match of body.matchAll(re)) {
    if (match.index! > at) parts.push({ text: body.slice(at, match.index) })
    parts.push({ id: match[2], caption: match[1] }); at = match.index! + match[0].length
  }
  if (at < body.length) parts.push({ text: body.slice(at) })
  return parts
}
function PlanText({ text }: { text: string }) {
  // Plain text nodes only: notes can never introduce executable HTML here.
  const lines = text.trim().split('\n')
  const blocks: React.ReactNode[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    if (line.startsWith('|') && lines[i + 1]?.match(/^\|(?:\s*:?-+:?\s*\|)+\s*$/)) {
      const cells = (row: string) => row.replace(/^\||\|$/g, '').split('|').map((value) => value.trim())
      const header = cells(line); const rows: string[][] = []; i += 2
      while (i < lines.length && lines[i].startsWith('|')) rows.push(cells(lines[i++]))
      i--
      blocks.push(<div className="plan-table-wrap" key={i}><table><thead><tr>{header.map((value, j) => <th key={j}>{value}</th>)}</tr></thead><tbody>{rows.map((row, j) => <tr key={j}>{row.map((value, k) => <td key={k}>{value}</td>)}</tr>)}</tbody></table></div>)
    } else if (/^#{1,3}\s/.test(line)) blocks.push(<h2 key={i}>{line.replace(/^#{1,3}\s+/, '')}</h2>)
    else blocks.push(<p key={i}>{line.replace(/^[-*]\s+/, '• ')}</p>)
  }
  return <div className="plan-text">{blocks}</div>
}
export function PlanScreen({ id }: { id: string }) {
  const imageInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState('')
  const page = useLive<Page | null | undefined>(() => getPage(id).then((p) => p && !p.deleted ? p : null), [id], undefined)
  async function upload(file?: File) {
    if (!file || !page || uploading) return
    setUploading(true); setNotice('')
    try { await attachPlanImage(page, file); setNotice('Image added to this plan.') }
    catch (error) { setNotice(error instanceof Error ? error.message : 'The image could not be saved.') }
    finally { setUploading(false); if (imageInput.current) imageInput.current.value = '' }
  }
  return <div className="app plan-app"><div className="statusband" /><main className="plan-screen scroll"><div className="plan-wrap">
    <div className="plan-tools"><button className="overview-back" onClick={() => navigate(to.workshop())} aria-label="Back to Workshop"><Icon name="back" />Back to Workshop</button>{page ? <><input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden aria-label="Plan image" onChange={event => void upload(event.target.files?.[0])} /><button className="overview-action" disabled={uploading} onClick={() => imageInput.current?.click()}>{uploading ? 'Adding image…' : 'Add image'}</button><button className="overview-action" onClick={() => navigate(to.page(id))}><Icon name="notebook" />Open source page</button><button className="overview-action" onClick={() => window.print()}><Icon name="print" />Print / Save PDF</button></> : null}</div>
    {notice ? <p role="status">{notice}</p> : null}
    {page ? <article className="plan-paper"><header><span className="section-label">Project plan</span><h1>{titleOf(page.body)}</h1><p>Updated {new Intl.DateTimeFormat([], { dateStyle: 'long' }).format(page.updated)}{field(page.body, 'Version') ? ` · Version ${field(page.body, 'Version')}` : ''}</p></header>
      <aside className="plan-scale-note"><strong>Reference view · Print scale is unverified</strong><p>Image pixels do not establish physical dimensions. For a cutting template, record the units and physical dimensions, print at 100%, and check a measured calibration mark before cutting.</p></aside>
      <div className="plan-content">{planParts(page.body).map((part, i) => 'text' in part ? <PlanText key={i} text={part.text} /> : <PlanImage key={i} id={part.id} caption={part.caption} />)}</div>
    </article> : <p role="status" className="overview-empty">{page === undefined ? 'Loading plan…' : 'This plan is not available.'}</p>}
  </div></main></div>
}
