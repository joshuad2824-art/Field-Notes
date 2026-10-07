import { useEffect, useRef, useState } from 'react'
import { type Page, titleOf } from '../lib/model'
import { sienaRequest } from '../lib/siena-request'
import { navigate, to } from '../lib/router'
import { Icon } from './Icon'

export function AskSiena({ pages, onClose }: { pages: Page[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef(document.activeElement as HTMLElement | null)
  const [context, setContext] = useState('')
  const [instruction, setInstruction] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const page = pages.find((p) => p.id === context && !p.deleted)
  const request = sienaRequest(instruction, page)
  useEffect(() => {
    dialog.current?.showModal()
    return () => { dialog.current?.close(); opener.current?.focus() }
  }, [])
  async function copy() {
    setBusy(true)
    try {
      await navigator.clipboard.writeText(request)
      setNotice('Copied. Paste this request into your conversation with Siena.')
    } catch { setNotice('Copy failed. Your request is still here; select and copy the request preview.') }
    finally { setBusy(false) }
  }
  return <dialog ref={dialog} className="ask-dialog" aria-labelledby="ask-title" onCancel={(e) => { e.preventDefault(); onClose() }} onClick={(e) => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose() } }}>
    <div className="ask-top"><span className="tape-label">Work with Siena</span><button className="icon-control" aria-label="Close request" title="Close request" onClick={onClose}>×</button></div>
    <h2 id="ask-title">Ask Siena</h2>
    <p>Write your request, choose any page to include, then copy it into our conversation.</p>
    <label htmlFor="siena-context">Include a saved page <span>(optional)</span></label>
    <select id="siena-context" value={context} onChange={(e) => { setContext(e.target.value); setNotice('') }}><option value="">No page attached</option>{pages.filter((p) => !p.deleted && !p.purpose).map((p) => <option key={p.id} value={p.id}>{titleOf(p.body)}</option>)}</select>
    <label htmlFor="siena-request">What would you like to work on?</label>
    <textarea id="siena-request" autoFocus rows={4} value={instruction} onChange={(e) => { setInstruction(e.target.value); setNotice('') }} placeholder="A question, a plan, or a change to discuss…" />
    <details className="request-context" open><summary>Request preview</summary><pre tabIndex={0} aria-label="Exact request preview">{request}</pre></details>
    <div className="ask-actions"><button className="overview-action primary" disabled={busy || !instruction.trim()} onClick={() => void copy()}><Icon name="copy" />Copy request</button>{page ? <button className="overview-back" onClick={() => { onClose(); navigate(to.review(page.id)) }}>Review a proposed page <Icon name="forward" /></button> : null}</div>
    {notice ? <p role="status" className="request-notice">{notice}</p> : null}
  </dialog>
}
