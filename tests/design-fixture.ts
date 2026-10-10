import { db, changed } from '../src/lib/db'
import { setSettings } from '../src/lib/settings'
import { isoDay } from '../src/lib/format'
import { loadNotebooks, reloadNotebooks } from '../src/lib/notebooks'
export async function loadDesignFixture() {
  if (!['localhost', '127.0.0.1'].includes(location.hostname) || localStorage.getItem('field-notes.vault')) throw Error('Fixtures require an unpaired localhost archive.')
  await loadNotebooks()
  await db.notebooks.put({id:'design-workshop-folder',name:'Workshop',color:'#52603e',order:4,updated:Date.now()})
  await reloadNotebooks()
  setSettings({notebook:'design-workshop-folder'})
  const now = Date.now(), page = (id: string, body: string, notebook = 'design-workshop-folder') => ({ id, body, notebook, pinned: 0 as const, created: now, updated: now })
  localStorage.setItem('field-notes.weather.unit', 'F')
  localStorage.setItem('field-notes.weather', JSON.stringify({temp:74,code:2,isDay:true,high:78,low:60,unit:'F',at:now,daily:Array.from({length:7},(_,i)=>{const day=new Date();day.setDate(day.getDate()+i);return {date:isoDay(day.getTime()),code:2,high:78+i,low:60+i,rainChance:i*10}})}))
  const plan = '# Three-Tray Artist Field Case\n#project-plan #workshop\nProject: Artist field case\nVersion: 2\nOwner: Joshua\nWhere we left off: Chose the six-board layout.\nNext step: Check the tray clearances before cutting.\n\n## Design overview\nA compact **wooden field case** for a day of painting outdoors. Keep the original measurements below.\n\n## Measurements and cut list\n| Piece | Qty | Size |\n| --- | --- | --- |\n| Side | 2 | 12 × 6 inches |\n| Rail | 4 | 1/2 × 11 inches |\n\n## Materials and tools\n- Six boards\n- Hinges\n  - Check the hinge width\n- [ ] Confirm the hardware\n\n## Build sequence\n### Dry fit\n1. Mark the original dimensions.\n2. Check the inside clearances.\n\n```text\n┌───────────────┐\n│  tray A       │\n├───────────────┤\n│  tray B       │\n└───────────────┘\n```\n\n### Fit the lid\nKeep **1/8 inch** clearance.\n\n## References\n[Reference](https://example.com/plan)\n\n![Original drawing](images/design-image.png){full}\n\n```md\n![Example only](images/not-a-real-image.png)\n```\n\n<script>window.designInjected = true</script>\n[Untrusted link](javascript:alert(1))'
  await db.pages.bulkPut([
    page('design-plan', plan),
    page('design-plan-2', '# Portable Desk\n#project-plan\nVersion: 1\nNext step: Measure the folding leg.\n\n## Overview\nA rear-folding work surface.'),
    page('design-plan-3', '# Leather Pen Case\n#project-plan\nVersion: 2\n\n## Measurements\nVerify the **bottle diameter** before cutting.'),
    page('design-plan-4', '# Siena Enclosure\n#project-plan\nVersion: 1\n\n## Design direction\nChoose the physical controls before final dimensions.'),
    { ...page('design-trash', '# Discardable design fixture'), deleted: now },
    page('design-archive', '# Original workshop writing\nThis ordinary note remains available and unchanged.'),
    page('design-project', '# Work at the desk\n#project\nStatus: active\nNext step: Review the field-case measurements.\n\n- [ ] Lay out the boards\n- [ ] Check the hinges', 'field-notes'),
  ])
  const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 450
  const context = canvas.getContext('2d')!; context.fillStyle = '#eee7d5'; context.fillRect(0,0,800,450); context.strokeStyle='#142a2b'; context.lineWidth=3;context.strokeRect(120,100,560,250);context.font='24px serif';context.fillStyle='#142a2b';context.fillText('Original field-case drawing',140,70)
  const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), 'image/png'))
  await db.images.put({ id:'design-image', page:'design-plan', blob, type:'image/png', ext:'png', added:now })
  await db.sienaItems.bulkPut([
    {id:'design-note',type:'note',title:'A little room to begin',body:'The next step can be small. Lay out the boards, take a breath, and give the idea a place to become something real.',created:now,updated:now},
    ...Array.from({length:12},(_,i)=>({id:`design-reminder-${i}`,type:'reminder' as const,title:`Reminder ${i+1}`,body:`Original reminder ${i+1}`,dueAt:now-1000*(i+1),created:now-i,updated:now,notebook:'field-notes'}))
  ])
  await db.events.put({id:'design-event',title:'Afternoon workshop',date:isoDay(),startTime:'15:00',created:now,updated:now})
  changed()
  return plan
}
