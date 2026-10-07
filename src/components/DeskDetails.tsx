import { useEffect, useRef, useState } from 'react'
import { deskBody, deskFields, saveDeskPage, type DeskKind } from '../lib/desk-metadata'
import { field, projectDesk } from '../lib/project-desk'
import { titleOf, type Page } from '../lib/model'
import { useNotebooks } from '../lib/notebooks'

const label = { project: 'project', plan: 'plan', equipment: 'equipment' }
function valuesOf(kind: DeskKind, page?: Page): Record<string, string> {
  return Object.fromEntries(deskFields[kind].map((name) => [name, page ? field(page.body, name) : name === 'Status' ? 'active' : '']))
}
export function DeskDetails({ kind, pages, selected, notebook, onClose }: { kind: DeskKind; pages: Page[]; selected?: Page; notebook: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef(document.activeElement as HTMLElement | null)
  const books = useNotebooks()
  const [base, setBase] = useState(selected)
  const [title, setTitle] = useState('')
  const [book, setBook] = useState(notebook)
  const [values, setValues] = useState(() => valuesOf(kind, selected))
  const [owned, setOwned] = useState(Boolean(selected))
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const body = deskBody(base?.body ?? `# ${title.trim()}`, kind, values, kind !== 'equipment' || owned)
  useEffect(() => {
    dialog.current?.showModal()
    return () => { dialog.current?.close(); opener.current?.focus() }
  }, [])
  function choose(id: string) {
    const page = pages.find((p) => p.id === id)
    setBase(page); setValues(valuesOf(kind, page)); setOwned(Boolean(page && projectDesk([page]).owned.length)); setNotice('')
  }
  async function save() {
    setBusy(true); setNotice('')
    try {
      const saved = await saveDeskPage(base, body, book)
      if (!saved) { setNotice('This page changed while you were editing its details. Close and reopen these details before saving. Your entries are still here.'); return }
      onClose()
    } catch { setNotice('Could not save the details. Your entries are still here.') }
    finally { setBusy(false) }
  }
  return <dialog ref={dialog} className="ask-dialog desk-details-dialog" aria-labelledby="desk-details-title" onCancel={(e) => { e.preventDefault(); if (!busy) onClose() }} onClick={(e) => { if (!busy && e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose() } }}>
    <div className="ask-top"><span className="tape-label">Linked source page</span><button className="icon-control" disabled={busy} aria-label="Close details" onClick={onClose}>×</button></div>
    <h2 id="desk-details-title">{base ? 'Edit' : 'Add'} {label[kind]} details</h2>
    <p>Link an existing page or create one. Save puts these details in that source page and preserves its other writing and pictures.</p>
    <label htmlFor="desk-source">Source page</label><select id="desk-source" value={base?.id ?? ''} disabled={busy} onChange={(e) => choose(e.target.value)}><option value="">Create a new page</option>{pages.filter((p) => !p.deleted && !p.purpose).map((p) => <option value={p.id} key={p.id}>{titleOf(p.body)}</option>)}</select>
    {!base ? <><label htmlFor="desk-title">Page title</label><input id="desk-title" value={title} autoFocus onChange={(e) => setTitle(e.target.value)} /><label htmlFor="desk-notebook">Notebook</label><select id="desk-notebook" value={book} onChange={(e) => setBook(e.target.value)}>{books.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></> : null}
    {deskFields[kind].map((name) => <div key={name}><label htmlFor={`desk-${name.replace(/ /g, '-')}`}>{name === 'Project' ? 'Project name / revision group' : name}</label>{name === 'Status' ? <select id="desk-Status" value={values[name]} onChange={(e) => setValues({ ...values, [name]: e.target.value })}><option value="active">Active — on our desk</option><option value="paused">Paused</option><option value="complete">Complete</option></select> : <input id={`desk-${name.replace(/ /g, '-')}`} value={values[name]} onChange={(e) => setValues({ ...values, [name]: e.target.value })} />}</div>)}
    {kind === 'equipment' ? <label className="desk-owned-check"><input type="checkbox" checked={owned} onChange={(e) => setOwned(e.target.checked)} />I confirm this equipment is owned. Uncheck to remove its workshop link.</label> : null}
    {kind === 'plan' ? <p className="desk-details-help">Use the same project name on each revision to keep older plans linked.</p> : null}
    <details className="request-context"><summary>Preview source page after Save</summary><pre>{body}</pre></details>
    {notice ? <p role="status" className="request-notice">{notice}</p> : null}
    <div className="ask-actions"><button className="overview-action primary" disabled={busy || (!base && !title.trim()) || (kind === 'equipment' && !base && !owned)} onClick={() => void save()}>{busy ? 'Saving…' : 'Save details'}</button><button className="overview-back" disabled={busy} onClick={onClose}>Cancel</button></div>
  </dialog>
}
