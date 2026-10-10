import { db, changed } from '../src/lib/db'
import { loadNotebooks, reloadNotebooks } from '../src/lib/notebooks'
import { ST_JOHN_NOTEBOOK as book, notebookDeskItems, hasAccessDetails } from '../src/lib/notebook-desk'
import { fileSienaItem, completeReminder } from '../src/lib/siena-items'
import { sienaItemToRow, rowToSienaItem } from '../src/sync/wire'
function safe() { if (!['localhost','127.0.0.1'].includes(location.hostname) || localStorage.getItem('field-notes.vault')) throw Error('Unpaired localhost only') }
const status = document.querySelector('#status')!
const assert = (test: boolean, message: string) => { if (!test) throw Error(message) }
async function load() {
 safe();await loadNotebooks();const now=Date.now()
 await db.notebooks.put({id:book,name:'St. John',color:'#082744',order:1,updated:now});await reloadNotebooks()
 await db.pages.bulkPut([
 {id:'work-reminders',notebook:book,purpose:'reminders',body:'# Reminders',pinned:1,created:now,updated:now},
 ...['Cerner training · the essentials','Onboarding reference','A conversation worth keeping','Friday follow-through'].map((title,i)=>({id:`work-page-${i}`,notebook:book,body:`# ${title}\n\nA useful place for the details you will want again. Keep the next step clear, and the source close at hand.`,pinned:(i<2?1:0) as 0|1,created:now-i,updated:now-i}))
 ])
 await db.sienaItems.bulkPut([
 {id:'work-brief',notebook:book,type:'note',title:'A few threads for the week ahead',body:'The next training sessions are on the horizon. The roster has changed, and there are a few details to check before the week gets moving.\n\nStart with the open follow-ups on your list. Keep the source records close, and leave room to confirm anything that is still uncertain.\n\nThe calendar connection is not active yet. This saved brief is a point-in-time note, not a live account of the day.',created:now,updated:now},
 {id:'work-unfiled',type:'note',title:'An older work brief',body:'Keep the original words and reading state.',created:now-100,updated:now-100,seenAt:now-50},
 {id:'other-brief',notebook:'church',type:'note',title:'Church-only message',body:'Must not appear on the work desk.',created:now,updated:now},
 ...['Review the next training session','Confirm the coverage swap','Check the updated welcome material','Follow up on a registration','Prepare next week’s handoff','Review the quick reference','Confirm a meeting time','Update the training checklist'].map((title,i)=>({id:`work-action-${i}`,notebook:book,type:'reminder' as const,title,body:'Check the source before acting. This fixture uses invented information.',dueAt:now+(i<3?-86400000*(i+1):86400000*(i+1)),created:now-i,updated:now,sourceUrl:'/p/work-reminders'})),
 {id:'other-action',notebook:'church',type:'reminder',title:'Church-only reminder',body:'Must not appear here.',dueAt:now-100,created:now,updated:now}
 ]);changed();status.textContent='Fixtures ready'
}
async function verify() {
 safe();assert(hasAccessDetails('Activation code: FAKE-EXAMPLE'), 'Access detail preview guarded');assert(!hasAccessDetails('Training registration reference'), 'Ordinary previews retained');const original=(await db.sienaItems.get('work-unfiled'))!
 await fileSienaItem(original.id,book,original.updated)
 const filed=(await db.sienaItems.get(original.id))!
 assert(filed.notebook===book,'Notebook assignment persisted')
 assert(filed.body===original.body && filed.seenAt===original.seenAt && filed.created===original.created,'Filing preserved content and reading state')
 assert(rowToSienaItem(sienaItemToRow(filed,'fixture-vault')).notebook===book,'Notebook assignment roundtrips')
 let conflict=false;try{await fileSienaItem(original.id,'church',original.updated)}catch{conflict=true}assert(conflict,'Stale version rejected')
 let invalid=false;try{await fileSienaItem(original.id,'missing-notebook',filed.updated)}catch{invalid=true}assert(invalid,'Missing notebook rejected')
 let reminder=false;try{const r=(await db.sienaItems.get('work-action-0'))!;await fileSienaItem(r.id,'church',r.updated)}catch{reminder=true}assert(reminder,'Reminder reassignment rejected')
 const before=notebookDeskItems(await db.sienaItems.toArray(),book);assert(!before.active.some(i=>i.id==='other-action')&&!before.briefs.some(i=>i.id==='other-brief'),'Notebook isolation')
 await completeReminder('work-action-0');const after=notebookDeskItems(await db.sienaItems.toArray(),book)
 assert(after.active.length===before.active.length-1&&after.completed.some(i=>i.id==='work-action-0'),'Completion shared with source record')
 await fileSienaItem(filed.id,undefined,filed.updated);assert(!(await db.sienaItems.get(filed.id))!.notebook,'Unfiling reversible')
 status.textContent='PASS: notebook isolation, content and seen-state preservation, sync roundtrip, stale conflict, invalid notebook, reminder guard, shared completion, reversible filing.'
}
document.querySelector('#load')!.addEventListener('click',()=>load().catch(e=>status.textContent=String(e)))
document.querySelector('#verify')!.addEventListener('click',()=>verify().catch(e=>status.textContent=String(e)))
