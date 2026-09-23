import { useEffect, useState } from 'react'
import { getPage, replaceBodyIfUnchanged } from '../lib/db'
import { imageIdsIn, titleOf, type Page } from '../lib/model'
import { notebookForPage } from '../lib/notebooks'
import { navigate, to } from '../lib/router'

function readable(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)(?:\{[^}]*\})?/g, '[Picture: $1]')
    .replace(/^\s{0,3}#{1,3}\s+/gm, '')
    .replace(/^\s*[-*]\s/gm, '• ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/==(?:\{\w+\})?([^=]+)==/g, '$1')
    .replace(/<u>([^<>]+)<\/u>/g, '$1')
}

export function ReviewScreen({ id }: { id: string }) {
  const [page, setPage] = useState<Page | null>(null)
  const [proposal, setProposal] = useState('')
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
    const request = `Siena, please help me with this Field Notes page. Suggest a complete revised page in Markdown and explain any substantive change. Do not update the saved page directly; I will review and apply it in Field Notes.\n\nNotebook: ${notebookForPage(page.notebook).name}\nPage ID: ${page.id}\nTitle: ${titleOf(page.body)}\n\nCurrent page:\n${page.body}`
    try {
      await navigator.clipboard.writeText(request)
      setNotice('Request copied. Paste it into our conversation, then paste Siena’s proposed page below.')
    } catch { setNotice('Could not copy on this device. You can still paste a proposed page below.') }
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
    <button className="overview-back" onClick={() => navigate(to.page(id))}>‹ Page</button>
    {page ? <>
      <span className="section-label">Work with Siena</span>
      <h1>{titleOf(page.body)}</h1>
      <p>Copy a request to discuss this page with Siena. Your saved page stays as it is until you review and apply a proposed version here.</p>
      <button className="overview-action primary" onClick={() => void copyRequest()}>Copy request for Siena</button>
      <div className="review-columns">
        <section><h2>Current page</h2><pre>{readable(page.body)}</pre></section>
        <section><h2>Proposed page</h2><label htmlFor="proposed-page">Paste Siena’s complete proposed page</label><textarea id="proposed-page" value={proposal} onChange={(e) => setProposal(e.target.value)} rows={12} /><pre>{proposal ? readable(proposal) : 'A preview will appear here after you paste a proposal.'}</pre></section>
      </div>
      {removedPictures.length ? <label className="review-picture-warning"><input type="checkbox" checked={allowPictureRemoval} onChange={(e) => setAllowPictureRemoval(e.target.checked)} /> This proposal removes {removedPictures.length} picture{removedPictures.length === 1 ? '' : 's'} from the page. I have reviewed that change.</label> : null}
      {notice ? <p className="event-notice" role="status">{notice}</p> : null}
      <div className="review-actions"><button className="overview-action primary" disabled={busy || !proposal.trim() || proposal === page.body || (removedPictures.length > 0 && !allowPictureRemoval)} onClick={() => void apply()}>Apply proposed page</button><button className="overview-back" onClick={() => navigate(to.page(id))}>Keep current page</button></div>
    </> : <p className="overview-empty">This page is not available.</p>}
  </div></main></div>
}
