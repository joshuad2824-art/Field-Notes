import { Reading } from '../components/Reading'
import { Icon } from '../components/Icon'
import { useEffect, useState } from 'react'
import { getPage, replaceBodyIfUnchanged } from '../lib/db'
import { imageIdsIn, titleOf, type Page } from '../lib/model'
import { sienaRequest } from '../lib/siena-request'
import { navigate, to } from '../lib/router'

export function ReviewScreen({ id }: { id: string }) {
  const [page, setPage] = useState<Page | null>(null)
  const [proposal, setProposal] = useState('')
  const [instruction, setInstruction] = useState('Please suggest a complete revised page and explain any substantive change.')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [allowPictureRemoval, setAllowPictureRemoval] = useState(false)
  const removedPictures = page && proposal ? imageIdsIn(page.body).filter((picture) => !imageIdsIn(proposal).includes(picture)) : []

  useEffect(() => {
    let active = true
    void getPage(id).then((found) => { if (active) setPage(found && !found.deleted ? found : null) })
    return () => { active = false }
  }, [id])

  const copyRequest = async () => {
    if (!page) return
    const request = sienaRequest(instruction, page)
    try {
      await navigator.clipboard.writeText(request)
      setNotice('Request copied. Paste it into our conversation, then paste Siena’s proposed page below.')
    } catch { setNotice('Copy failed. Your request is still here; select and copy the request preview.') }
  }

  const apply = async () => {
    if (!page || !proposal.trim() || proposal === page.body) return
    setBusy(true)
    setNotice('')
    try {
      const replaced = await replaceBodyIfUnchanged(id, page.updated, page.body, proposal)
      if (!replaced) {
        setNotice('This page changed while you were reviewing. Reopen this review before applying a proposal.')
        return
      }
      navigate(to.page(id), { replace: true })
    } catch { setNotice('Could not save the proposed page. Your proposal is still here.') }
    finally { setBusy(false) }
  }

  return <div className="app"><div className="statusband" /><main className="review-screen scroll"><div className="review-wrap">
    <button className="overview-back" onClick={() => navigate(to.page(id))} aria-label="‹ Page" title="‹ Page"><Icon name="back" /></button>
    {page ? <>
      <span className="section-label">Work with Siena</span>
      <h1>{titleOf(page.body)}</h1>
      
      <div className="review-request paper-panel"><div className="review-request-head"><label htmlFor="review-request">What would you like Siena to help with?</label><button className="overview-action primary" onClick={() => void copyRequest()} aria-label="Copy request for Siena" title="Copy request for Siena"><Icon name="copy" /></button></div><textarea id="review-request" rows={3} value={instruction} onChange={(e) => setInstruction(e.target.value)} /><details className="request-context"><summary>Request preview</summary><pre tabIndex={0}>{sienaRequest(instruction, page)}</pre></details></div>
      <div className="review-columns">
        <section><h2>Current page</h2><div className="review-reading"><Reading text={page.body} /></div></section>
        <section><h2>Proposed page</h2><label htmlFor="proposed-page">Paste Siena’s complete proposed page</label><textarea id="proposed-page" value={proposal} onChange={(e) => setProposal(e.target.value)} rows={12} /><details className="review-preview"><summary>Preview</summary><div className="review-reading"><Reading text={proposal} /></div></details></section>
      </div>
      {removedPictures.length ? <label className="review-picture-warning"><input type="checkbox" checked={allowPictureRemoval} onChange={(e) => setAllowPictureRemoval(e.target.checked)} /> This proposal removes {removedPictures.length} picture{removedPictures.length === 1 ? '' : 's'} from the page. I have reviewed that change.</label> : null}
      {notice ? <p className="event-notice" role="status">{notice}</p> : null}
      <div className="review-actions"><button className="overview-action primary" disabled={busy || !proposal.trim() || proposal === page.body || (removedPictures.length > 0 && !allowPictureRemoval)} onClick={() => void apply()} aria-label="Apply proposed page" title="Apply proposed page"><Icon name="save" /></button><button className="overview-back" onClick={() => navigate(to.page(id))} aria-label="Keep current page" title="Keep current page"><Icon name="back" /></button></div>
    </> : <p className="overview-empty">This page is not available.</p>}
  </div></main></div>
}
