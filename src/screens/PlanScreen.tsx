import { useEffect, useRef, useState } from 'react'
import { getPage } from '../lib/db'
import { attachPlanImage } from '../lib/plan-images'
import { getImage, imageUrl } from '../lib/images'
import { titleOf, type Page } from '../lib/model'
import { planPapers, planReading, readingBlocks } from '../lib/reading'
import { InlineReading, ReadingBlocks } from '../components/Reading'
import { PageScreen } from './PageScreen'
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
  return <figure className="plan-image">{picture ? <><a href={picture.url} target="_blank" rel="noopener" aria-label={`Open original image: ${caption || 'Plan image'}`}><img src={picture.url} alt={caption || 'Plan reference'} /></a><figcaption>{caption || 'Plan reference'}<small>{picture.pixels} · Original file · {picture.bytes.toLocaleString()} bytes</small><a className="icon-control" aria-label="View original resolution" title="View original resolution" href={picture.url} target="_blank" rel="noopener"><Icon name="source" /></a></figcaption></> : <p role="status">{missing ? 'This original image is not available on this device yet.' : 'Loading original image…'}</p>}</figure>
}

export function PlanScreen({ id, editing = false }: { id: string; editing?: boolean }) {
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
  if (editing) return <PageScreen key={id} id={id} workshop />
  const first = page ? readingBlocks(page.body)[0] : null
  const title = first?.kind === 'heading' && first.level === 1 ? first.text : page ? titleOf(page.body) : ''
  const plan = page ? planReading(page.body, title) : null
  const papers = plan ? planPapers(id, plan.sections.map(section => section.title)) : []
  return <div className="app plan-app"><main className="plan-screen scroll"><div className="plan-wrap">
    <div className="plan-tools"><button className="icon-control overview-back" onClick={() => navigate(to.workshop())} aria-label="Back to Workshop" title="Back to Workshop"><Icon name="back" /></button><span className="grow" />{page ? <><input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden aria-label="Plan image" onChange={event => void upload(event.target.files?.[0])} /><button className="icon-control overview-action" aria-label={uploading ? 'Adding image…' : 'Add image'} title="Add image" disabled={uploading} onClick={() => imageInput.current?.click()}><Icon name="image" /></button><button className="icon-control overview-action" aria-label="Edit plan" title="Edit plan" onClick={() => navigate(to.planEdit(id))}><Icon name="edit" /></button><button className="icon-control overview-action" aria-label="Print / Save PDF" title="Print / Save PDF" onClick={() => window.print()}><Icon name="print" /></button></> : null}</div>
    {notice ? <p role="status">{notice}</p> : null}
    {page && plan ? <article className="plan-paper"><header className="plan-heading"><span className="section-label">Workshop</span><h1><InlineReading text={title} /></h1><p>{plan.metadata.project ? <><InlineReading text={plan.metadata.project} /> · </> : null}Updated {new Intl.DateTimeFormat([], { dateStyle: 'long' }).format(page.updated)}{plan.metadata.version ? ` · Version ${plan.metadata.version}` : ''}{plan.metadata.owner ? ` · ${plan.metadata.owner}` : ''}</p></header>
      {plan.metadata['where we left off'] || plan.metadata['next step'] ? <aside className="plan-resume">{plan.metadata['where we left off'] ? <p><InlineReading text={plan.metadata['where we left off']} /></p> : null}{plan.metadata['next step'] ? <div><span className="section-label">Next</span><p><InlineReading text={plan.metadata['next step']} /></p></div> : null}</aside> : null}
      {plan.sections.length > 1 ? <nav className="plan-index" aria-label="Plan sections"><select aria-label="Jump to plan section" defaultValue="" onChange={event => { const section = document.getElementById(event.target.value); section?.scrollIntoView({ block: 'start' }); section?.focus({ preventScroll: true }); event.target.value = '' }}><option value="" disabled>Sections</option>{plan.sections.map(section => <option key={section.id} value={section.id}>{section.title}</option>)}</select></nav> : null}
      <div className="plan-content plan-sections">{plan.sections.map((section, index) => <section data-paper={papers[index].paper} data-decoration={papers[index].decoration} key={section.id} id={section.id} tabIndex={-1} className={`plan-section plan-section-${section.role}${section.blocks.some(block => block.kind === 'image' || (block.kind === 'table' && block.head.length > 4) || (block.kind === 'code' && block.text.split('\n').some(line => line.length > 68))) ? ' plan-section-wide' : ''}`}><h2><InlineReading text={section.title} /></h2><div className="plan-text reading-content"><ReadingBlocks blocks={section.blocks} image={(picture, caption) => <PlanImage id={picture} caption={caption} />} /></div></section>)}</div>
      {plan.sections.some(section => section.blocks.some(block => block.kind === 'image')) ? <details className="plan-scale-note"><summary>Printing reference images</summary><p>Image pixels do not establish physical dimensions. For a cutting template, record the units and physical dimensions, print at 100%, and check a measured calibration mark before cutting.</p></details> : null}
    </article> : <p role="status" className="overview-empty">{page === undefined ? 'Loading plan…' : 'This plan is not available.'}</p>}
  </div></main></div>
}
