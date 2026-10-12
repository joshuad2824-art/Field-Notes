import { db, changed } from '../src/lib/db'
import { loadNotebooks, reloadNotebooks } from '../src/lib/notebooks'
import { setSettings } from '../src/lib/settings'
import { isoDay } from '../src/lib/format'
import { shiftDate } from '../src/lib/event-recurrence'
import { ST_JOHN_NOTEBOOK } from '../src/lib/notebook-desk'
import type { Page, SienaItem, FieldEvent } from '../src/lib/model'
export async function loadRedesignFixture() {
  if (
    !['localhost', '127.0.0.1'].includes(location.hostname) ||
    localStorage.getItem('field-notes.vault')
  )
    throw Error('Fixtures require an unpaired localhost archive.')
  await loadNotebooks()
  const now = Date.now(),
    today = isoDay(),
    at = new Date(today + 'T12:00:00').getTime()
  await db.notebooks.bulkPut([
    { id: 'garden', name: 'Garden', color: '#2D5A12', order: 6, updated: now },
    { id: ST_JOHN_NOTEBOOK, name: 'St. John', color: '#1B2A5E', order: 5, updated: now },
  ])
  await reloadNotebooks()
  const page = (
    id: string,
    title: string,
    body: string,
    notebook = 'church',
    offset = 0,
  ): Page => ({
    id,
    body: `# ${title}\n\n${body}`,
    notebook,
    created: at + offset * 86400000,
    updated: now,
    pinned: 0,
  })
  const pages: Page[] = [
    {
      ...page(
        'redesign-page',
        'Fall projects around the house',
        'I’d like to get the outside work done =={brass}before Thanksgiving== while the weekends are still warm enough to be out on a ladder. The inside list can wait for the cold.\n\n## Before the first freeze\n- [x] Clear the gutters on the north side.\n- [ ] Replace the back door sweep.\n- [ ] Swap the porch light switch.\n- [ ] Wrap the hose bibs.\n\nThe back door’s draft is =={oxblood}probably the sweep, not the frame==. I’ll check it with a candle on the next windy night before I buy anything.\n\nSweep sizes are here: [thisoldhouse.com/door-sweeps](https://www.thisoldhouse.com/door-sweeps)\n\nAsk Dad if he still has =={navy}the longer extension ladder==.\n\n#the-hearth',
      ),
      pinned: 1,
    },
    page(
      'redesign-furnace',
      'Furnace filter sizes',
      'Upstairs is 16×25×1, downstairs 20×20×1.',
    ),
    page(
      'redesign-menu',
      'Menu for Sunday dinner',
      'Pot roast, the green beans Mom likes, something warm.',
    ),
    page(
      'redesign-porch',
      'Back porch light',
      'The fixture is fine. It’s the switch, I think.',
    ),
    page(
      'redesign-christmas',
      'Christmas list, early',
      'Starting now so December’s quieter than last year.',
    ),
    page(
      'redesign-picture',
      'Notes from the shop',
      'The finish looked a little warmer in the afternoon light.\n\n![Original workshop drawing](images/redesign-image.png){right 44}\n\n## The next coat\nLet the oil cure before adding anything else.\n\nA thin coat is enough.\n\n- [ ] Sand the edges\n- [ ] Check the joint',
    ),
    page('redesign-journal', 'Journal · Week 41', 'A week of small beginnings.', 'journal'),
    page(
      'redesign-work',
      'Downtime follow-up',
      'Keep the three open items close for the change review.',
      ST_JOHN_NOTEBOOK,
    ),
    page(
      'redesign-links',
      'Training notes',
      'A few things worth remembering.',
      ST_JOHN_NOTEBOOK,
    ),
    {
      ...page('redesign-trash', 'Old grocery list', 'Milk and bread.', 'hearth'),
      deleted: now - 2 * 86400000,
    },
    page(
      'redesign-plan',
      'Walnut step stool',
      '#project-plan\nProject: Walnut step stool\nVersion: 1\nStatus: active\nNext step: Cut the stretcher mortises.\n\n![Shop drawing](images/redesign-image.png){full}\n\n## Build sequence\n- [x] Measure\n- [x] Select the boards\n- [x] Mark the joints\n- [x] Cut the legs\n- [x] Dry fit\n- [ ] Cut the mortises\n- [ ] Glue up\n- [ ] Sand\n- [ ] Oil',
      'workshop',
    ),
    page(
      'redesign-plan2',
      'Cedar planter',
      '#project-plan\nProject: Cedar planter\nVersion: 1\nStatus: paused\nNext step: Check the outside dimensions.\n\n- [x] Sketch\n- [ ] Cut',
      'workshop',
    ),
    page(
      'redesign-plan3',
      'Picture frame',
      '#project-plan\nProject: Picture frame\nVersion: 1\nStatus: done\n\n- [x] Cut\n- [x] Finish',
      'workshop',
    ),
    page(
      'redesign-plan4',
      'Writing desk',
      '#project-plan\nProject: Writing desk\nVersion: 1\nStatus: active\nNext step: Choose the boards.\n\n- [ ] Measure\n- [ ] Assemble',
      'workshop',
    ),
    page('redesign-tool', 'Block plane', '#owned\nBrand: Stanley\nModel: No. 60½', 'workshop'),
    page(
      'redesign-project',
      'Fall house projects',
      '#project\nStatus: active\n\nCheck the porch before the first cold morning.',
      'hearth',
    ),
  ]
  await db.pages.clear()
  await db.pages.bulkPut(pages)
  const events: FieldEvent[] = [
    {
      id: 'redesign-event',
      title: 'Change review',
      date: today,
      startTime: '09:00',
      endTime: '10:00',
      location: 'St. John, 4th floor',
      created: now,
      updated: now,
    },
    {
      id: 'redesign-lunch',
      title: 'Lunch with Dad',
      date: today,
      startTime: '12:00',
      endTime: '13:00',
      calendarTarget: 'Family',
      created: now,
      updated: now,
    },
    {
      id: 'redesign-student',
      title: 'Student ministry planning',
      date: today,
      startTime: '18:30',
      endTime: '20:00',
      created: now,
      updated: now,
    },
    {
      id: 'redesign-dentist',
      title: 'Dentist',
      date: shiftDate(today, 1),
      startTime: '08:00',
      created: now,
      updated: now,
    },
    {
      id: 'redesign-series',
      title: 'Student ministry',
      date: shiftDate(today, 2),
      startTime: '19:00',
      endTime: '20:30',
      location: 'MBC · Student room',
      note: 'Bring the discussion guide and leave time for questions.',
      calendarTarget: 'Joshua',
      pageId: 'redesign-page',
      recurrence: {
        frequency: 'weekly',
        interval: 1,
        weekdays: [new Date(shiftDate(today, 2) + 'T12:00:00').getDay()],
        until: shiftDate(today, 65),
      },
      created: now,
      updated: now,
    },
  ]
  await db.events.clear()
  await db.events.bulkPut(events)
  const items: SienaItem[] = [
    {
      id: 'redesign-note',
      type: 'note',
      title: 'Thursday’s downtime notes',
      body: 'They’re filed in Field Notes. I pulled the three open items to the top so they’re easy to find before the change review.\n\n1. Confirm the training roster.\n2. Check the remaining handoff.\n3. Keep the quick reference close.',
      created: now,
      updated: now,
      notebook: ST_JOHN_NOTEBOOK,
    },
    {
      id: 'redesign-reminder',
      type: 'reminder',
      title: 'Renew the truck tag',
      body: 'Renew the truck tag.',
      dueAt: at,
      created: now,
      updated: now,
      notebook: ST_JOHN_NOTEBOOK,
    },
    {
      id: 'redesign-oil',
      type: 'reminder',
      title: 'Pick up tung oil',
      body: 'For the stool.',
      dueAt: at + 86400000,
      created: now,
      updated: now,
    },
    {
      id: 'redesign-update',
      type: 'task_update',
      title: 'The plan is ready',
      body: 'The cut list is attached to the stool plan.',
      created: now,
      updated: now,
    },
    {
      id: 'redesign-saved',
      type: 'saved',
      title: 'A reference for later',
      body: 'A useful way to fit a mortise.',
      created: now,
      updated: now,
      seenAt: now,
    },
    {
      id: 'redesign-done',
      type: 'reminder',
      title: 'Check the roster',
      body: 'Original completed reminder.',
      completedAt: now,
      notebook: ST_JOHN_NOTEBOOK,
      created: now,
      updated: now,
    },
  ]
  await db.sienaItems.clear()
  await db.sienaItems.bulkPut(items)
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 450
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#d9ccad'
  ctx.fillRect(0, 0, 800, 450)
  ctx.strokeStyle = '#3A342E'
  ctx.lineWidth = 3
  ctx.strokeRect(100, 90, 600, 220)
  ctx.font = '28px serif'
  ctx.fillStyle = '#3A342E'
  ctx.fillText('Local test drawing · not a user image', 110, 360)
  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/png'),
  )
  await db.images.put({
    id: 'redesign-image',
    page: 'redesign-picture',
    blob,
    type: 'image/png',
    ext: 'png',
    added: now,
  })
  localStorage.setItem('field-notes.weather.unit', 'F')
  localStorage.setItem(
    'field-notes.weather',
    JSON.stringify({
      temp: 78,
      code: 0,
      isDay: true,
      high: 81,
      low: 59,
      unit: 'F',
      at: now,
      daily: Array.from({ length: 7 }, (_, i) => ({
        date: shiftDate(today, i),
        code: [0, 2, 61, 3, 0, 0, 2][i],
        high: [81, 77, 70, 68, 73, 75, 77][i],
        low: 59,
        rainChance: 0,
      })),
    }),
  )
  localStorage.setItem('field-notes.zoom-defaulted', '1')
  setSettings({
    notebook: 'church',
    themeNotebook: 'church',
    stock: 'night',
    pen: 'felt',
    zoom: 1,
    rail: true,
    list: true,
  })
  changed()
}
