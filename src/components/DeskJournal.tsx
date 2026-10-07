import { useState } from 'react'
import { SienaItemCard } from './SienaItemCard'
import { Icon } from './Icon'
import { RouteLink } from './DeskHeader'
import { to } from '../lib/router'
import { titleOf, stripMarkers, type Page, type SienaItem } from '../lib/model'
import { field } from '../lib/project-desk'
import { replaceBodyIfUnchanged } from '../lib/db'

function steps(body: string) {
  let fence: string | null = null
  return body.split('\n').flatMap((line, index) => {
    const marker = line.match(/^\s*(`{3,}|~{3,})/)
    if (marker) { const kind = marker[1][0]; if (!fence) fence = kind; else if (fence === kind) fence = null; return [] }
    if (fence) return []
    const match = line.match(/^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+(.+)$/)
    return match ? [{ index, done: match[1] !== ' ', text: stripMarkers(match[2]) }] : []
  }).slice(0, 4)
}

export function DeskJournal({ note, project, unseen }: { note?: SienaItem; project?: Page; unseen: number }) {
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const toggle = async (index: number) => {
    if (!project || saving) return
    setSaving(true)
    try {
      const lines = project.body.split('\n')
      lines[index] = lines[index].replace(/^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]/, (_, prefix, done) => `${prefix}[${done === ' ' ? 'x' : ' '}]`)
      const saved = await replaceBodyIfUnchanged(project.id, project.updated, project.body, lines.join('\n'))
      setMessage(saved ? '' : 'This project changed. Review its current steps before trying again.')
    } catch { setMessage('The step could not be saved. Your project is unchanged.') }
    finally { setSaving(false) }
  }
  return <section className="fn-notebook overview-from-siena" aria-label="Desk journal">
    <span className="fn-book-cover-gutter" aria-hidden="true" /><div className="fn-book-spread">
      <div className="fn-page fn-page-left"><div className="fn-note-top"><RouteLink className="fn-tape-label" href={to.fromSiena()} aria-label={`All saved items${unseen ? `, ${unseen} unseen` : ''}`}>From Siena{unseen ? <span className="siena-badge">{unseen}</span> : null}</RouteLink></div>
        {note ? <SienaItemCard item={note} paper journal /> : <p className="fn-note-body">No new note here. Your saved items are still available.</p>}
      </div>
      <div className="fn-page fn-page-right"><span className="fn-book-ribbon" aria-hidden="true" />
        {project ? <><h3>{titleOf(project.body)}</h3>{field(project.body, 'Next step') ? <p className="fn-handwritten">{field(project.body, 'Next step')}</p> : null}
          <div className="fn-step-list" aria-label="Project steps">{steps(project.body).map(step => <button key={`${project.id}:${step.index}`} className={`fn-sample-step${step.done ? ' is-done' : ''}`} aria-pressed={step.done} disabled={saving} onClick={() => void toggle(step.index)}><Icon name={step.done ? 'done' : 'circle'} /><span>{step.text}</span></button>)}</div>
          <RouteLink className="fn-paper-link" href={to.page(project.id)} aria-label={`Open project: ${titleOf(project.body)}`} title="Open project"><Icon name="forward" /></RouteLink>
          {message ? <p role="status" className="fn-step-message">{message}</p> : null}
        </> : <><h3>A place for the next idea.</h3><p className="fn-handwritten">An active project will appear here when you add or link its page.</p></>}
      </div><span className="fn-book-gutter" aria-hidden="true" />
    </div>
  </section>
}
