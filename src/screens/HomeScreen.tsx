import { Shell } from '../components/Shell'
import { SIDEBAR_DOCKED, useMediaQuery } from '../lib/media'
import { notebookForPage } from '../lib/notebooks'
import { useLive } from '../lib/useLive'
import { livePages } from '../lib/db'
import { colorName } from '../lib/theme'
import { navigate, to } from '../lib/router'
export function HomeScreen({notebook}:{notebook:string}) {
 const docked=useMediaQuery(SIDEBAR_DOCKED),book=notebookForPage(notebook),pages=useLive(()=>livePages(notebook),[notebook],[])
 return <div className="app"><div className="statusband"/><Shell notebook={notebook}>{({toggle})=>docked?<main className="desk desk-bare notebook-empty"><div className="desk-marks">{toggle}</div><div className="empty-state">{!pages.length?<img src="/redesign/moose-left.webp" alt=""/>:null}<span className="section-label">{book.name} · {colorName(book.color)} cover</span><h1>{pages.length?'Pick up a page.':'Nothing here yet. Plenty of time.'}</h1><p>{pages.length?'Your writing is right here.':'The first page can be anything: a list, a thought, a place to begin.'}</p><div className="actions"><button className="cream-button" onClick={()=>navigate(to.newPage(notebook))}>{pages.length?'Write a new page':'Write the first page'}</button><button className="collection-chip" onClick={()=>navigate(to.settings()+'#settings-backup')}>Import markdown</button></div></div></main>:null}</Shell></div>
}
