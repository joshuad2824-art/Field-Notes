/* The table, on a desk, a tablet and a phone.

   `tests/editor.mjs` proves a table goes ON the page — three by three, a row
   added, a column taken away, a grip dragged. What it never did was look at
   the table *afterwards*: whether what the eye sees still agrees with what the
   file says once a row has been taken out from under a caret. It doesn't, and
   didn't, and every glitch reported in August 2026 was in that gap. So the
   question this file asks over and over is the same one: **does the drawing
   agree with the file** — after a row goes, after a column goes, after a
   merge, after a paste, on a phone, and after something that moves a cell
   without changing a word.

   The rule underneath it is the one the diagnostic harness already suggested:
   a test that only ever builds something up will not find the bugs in taking
   it apart.

   Run a server first, then this:

     npm run build && npm run preview &
     node tests/spreadsheet.mjs

   Needs Playwright available (npm i -g playwright, or npx playwright). */

const BASE = process.env.BASE ?? 'http://localhost:4173'

async function loadPlaywright() {
  try {
    return await import('playwright')
  } catch {
    /* fall through to a global install */
  }
  try {
    const { execSync } = await import('node:child_process')
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim()
    return await import(`${root}/playwright/index.mjs`)
  } catch {
    console.error('Playwright not found. Try: npm i -g playwright && playwright install chromium')
    process.exit(2)
  }
}

const { chromium } = await loadPlaywright()
const browser = await chromium.launch()
const problems = []
let failures = 0
const ok = (name, pass, detail = '') => {
  if (!pass) failures++
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

const settledZoom = () => {
  try {
    localStorage.setItem('field-notes.zoom-defaulted', '1')
  } catch {
    /* about:blank denies storage */
  }
}

async function desk(width, height, run) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  await ctx.addInitScript(settledZoom)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => problems.push('page error: ' + e.message))
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  try {
    await run(page)
  } finally {
    await ctx.close()
  }
}

/* The markdown the device actually stored, which is the only thing that
   survives a reload — and therefore the only thing the drawn table can be
   wrong about. */
const stored = (page) =>
  page.evaluate(async () => {
    const request = indexedDB.open('field-notes')
    const db = await new Promise((r) => {
      request.onsuccess = () => r(request.result)
    })
    const rows = await new Promise((r) => {
      const q = db.transaction('pages').objectStore('pages').getAll()
      q.onsuccess = () => r(q.result)
    })
    return rows.sort((a, b) => b.updated - a.updated)[0]?.body ?? ''
  })

/* What the eye sees, cell by cell, row by row — read back in the same shape
   the file writes, so a merged cell drawn once as a `colspan` is compared
   against the `<` the file puts in the column it swallowed. */
const drawn = (page) =>
  page.locator('.md-table').evaluate((host) => {
    const rows = [...host.querySelectorAll('tr')]
    const columns = host.querySelectorAll('colgroup col').length
    const grid = rows.map(() => Array(columns).fill(null))
    rows.forEach((tr, r) => {
      let c = 0
      for (const td of tr.querySelectorAll('td')) {
        while (c < columns && grid[r][c] !== null) c++
        const span = Number(td.getAttribute('colspan') ?? 1)
        const down = Number(td.getAttribute('rowspan') ?? 1)
        for (let dr = 0; dr < down; dr++) {
          for (let dc = 0; dc < span; dc++) {
            if (!grid[r + dr]) continue
            grid[r + dr][c + dc] = dr > 0 ? '^' : dc > 0 ? '<' : td.textContent.trim()
          }
        }
        c += span
      }
    })
    return grid.map((row) => row.map((cell) => cell ?? '').join('|'))
  })

/* And what the file says, read back the same shape, so the two can be
   compared without either being trusted. */
const inFile = async (page) => {
  const body = await stored(page)
  return body
    .split('\n')
    .filter((l) => /^\s*\|/.test(l) && !/^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/.test(l))
    .map((l) =>
      l
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim())
        .join('|'),
    )
}

const newTable = async (page) => {
  await page.locator('.plate-button', { hasText: 'New page' }).first().click()
  await page.waitForTimeout(600)
  await page.locator('.cm-content').click()
  await page.keyboard.type('# Stock', { delay: 5 })
  await page.keyboard.press('Enter')
  await page.locator('.mark-button[aria-label="Style"]').click()
  await page.waitForTimeout(250)
  await page.locator('.tray-word', { hasText: 'Table' }).click()
  await page.waitForTimeout(500)
  await page.locator('.mark-button[aria-label="Style"]').click()
  await page.waitForTimeout(250)
}

/* Fill the nine cells with something each one can be told apart by. */
const fill = async (page, words) => {
  const cells = page.locator('.md-table td')
  for (let i = 0; i < words.length; i++) {
    await cells.nth(i).click()
    await page.keyboard.type(words[i], { delay: 4 })
  }
  await page.waitForTimeout(400)
}

const control = (page, label) => page.locator(`.md-table-control[aria-label^="${label}"]`)

await desk(1440, 900, async (page) => {
  console.log('\n— what the eye sees against what the file says —\n')

  await newTable(page)
  await fill(page, ['A1', 'B1', 'C1', 'A2', 'B2', 'C2', 'A3', 'B3', 'C3'])

  ok('a filled table draws what it stored', JSON.stringify(await drawn(page)) === JSON.stringify(await inFile(page)),
    JSON.stringify(await drawn(page)))

  /* 1. A row taken out from under the caret. The button holds the focus
        deliberately, so the cell being deleted is `document.activeElement`
        when the table redraws — and `render` refuses to write over the
        active cell. */
  await page.locator('.md-table td').nth(3).click()
  await page.waitForTimeout(120)
  await control(page, 'Remove these rows').click()
  await page.waitForTimeout(400)
  ok('a row removed leaves the drawing agreeing with the file',
    JSON.stringify(await drawn(page)) === JSON.stringify(await inFile(page)),
    `drawn ${JSON.stringify(await drawn(page))} vs file ${JSON.stringify(await inFile(page))}`)

  /* 2. And the same for a column. */
  await newTable(page)
  await fill(page, ['A1', 'B1', 'C1', 'A2', 'B2', 'C2', 'A3', 'B3', 'C3'])
  await page.locator('.md-table td').nth(4).click()
  await page.waitForTimeout(120)
  await control(page, 'Remove these columns').click()
  await page.waitForTimeout(400)
  ok('a column removed leaves the drawing agreeing with the file',
    JSON.stringify(await drawn(page)) === JSON.stringify(await inFile(page)),
    `drawn ${JSON.stringify(await drawn(page))} vs file ${JSON.stringify(await inFile(page))}`)

  /* 3. A merge, from the cell that is doing the taking. */
  await newTable(page)
  await fill(page, ['A1', 'B1', 'C1', 'A2', 'B2', 'C2', 'A3', 'B3', 'C3'])
  await page.locator('.md-table td').nth(3).click()
  await page.waitForTimeout(120)
  await control(page, 'Merge the picked cells, or join this one to its right').click()
  await page.waitForTimeout(400)
  ok('a merge leaves the drawing agreeing with the file',
    JSON.stringify(await drawn(page)) === JSON.stringify(await inFile(page)),
    `drawn ${JSON.stringify(await drawn(page))} vs file ${JSON.stringify(await inFile(page))}`)

  /* 4. A row added above the caret's row shifts everything below it. */
  await newTable(page)
  await fill(page, ['A1', 'B1', 'C1', 'A2', 'B2', 'C2', 'A3', 'B3', 'C3'])
  await page.locator('.md-table td').nth(3).click()
  await page.waitForTimeout(120)
  await control(page, 'Add a row').click()
  await page.waitForTimeout(400)
  ok('a row added leaves the drawing agreeing with the file',
    JSON.stringify(await drawn(page)) === JSON.stringify(await inFile(page)),
    `drawn ${JSON.stringify(await drawn(page))} vs file ${JSON.stringify(await inFile(page))}`)

  console.log('\n— merging —\n')

  /* 5. Right to left. Standing in the right-hand cell of a pair and asking to
        join it to its neighbour: there is no command for it at all. */
  ok('a cell can be joined to the one on its LEFT',
    (await page.locator('.md-table-control[aria-label*="left"]').count()) > 0)

  /* 6. Down the way. */
  ok('a cell can be joined to the one ABOVE or BELOW it',
    (await page.locator('.md-table-control[aria-label*="above"], .md-table-control[aria-label*="below"]').count()) > 0)

  /* 7. Picking cells with the mouse. */
  await newTable(page)
  await fill(page, ['A1', 'B1', 'C1', 'A2', 'B2', 'C2', 'A3', 'B3', 'C3'])
  const a2 = await page.locator('.md-table td').nth(3).boundingBox()
  const c2 = await page.locator('.md-table td').nth(5).boundingBox()
  await page.mouse.move(a2.x + 8, a2.y + a2.height / 2)
  await page.mouse.down()
  await page.mouse.move(c2.x + c2.width - 8, c2.y + c2.height / 2, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(250)
  ok('dragging across cells picks a range of them',
    (await page.locator('.md-table td.picked, .md-table td[aria-selected="true"]').count()) === 3,
    `${await page.locator('.md-table td.picked, .md-table td[aria-selected="true"]').count()} picked`)

  console.log('\n— selecting text with a mouse —\n')

  /* 8. Inside a cell. A drag across the words in one cell should select them,
        the way it does anywhere else. */
  await newTable(page)
  await page.locator('.md-table td').nth(3).click()
  await page.keyboard.type('white oak eight quarter', { delay: 4 })
  await page.waitForTimeout(250)
  const cell = await page.locator('.md-table td').nth(3).boundingBox()
  await page.mouse.move(cell.x + 6, cell.y + 12)
  await page.mouse.down()
  await page.mouse.move(cell.x + 70, cell.y + 12, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(200)
  ok('a drag inside a cell selects its words',
    (await page.evaluate(() => window.getSelection().toString().length)) > 2,
    JSON.stringify(await page.evaluate(() => window.getSelection().toString())))

  /* 8b. And the caret must not move while that is happening. `render` writes
         over the cell the caret is in now, which it used to refuse to do —
         so the one thing that could have broken is typing into the middle of
         a word. */
  await newTable(page)
  await page.locator('.md-table td').nth(3).click()
  await page.keyboard.type('whiteoak', { delay: 5 })
  await page.waitForTimeout(300)
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft')
  await page.keyboard.type(' ', { delay: 5 })
  await page.waitForTimeout(300)
  ok('typing into the middle of a cell leaves the caret there',
    (await drawn(page))[1].startsWith('white oak'), JSON.stringify((await drawn(page))[1]))

  /* 9. And out on the page, which is the other half of what was reported. */
  await page.locator('.plate-button', { hasText: 'New page' }).first().click()
  await page.waitForTimeout(600)
  await page.locator('.cm-content').click()
  await page.keyboard.type('The tent held through the night and the rope stayed tight.', { delay: 4 })
  await page.waitForTimeout(250)
  const line = await page.locator('.cm-line').first().boundingBox()
  await page.mouse.move(line.x + 10, line.y + line.height / 2)
  await page.mouse.down()
  await page.mouse.move(line.x + 160, line.y + line.height / 2, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(200)
  ok('a drag across a plain line selects it',
    (await page.evaluate(() => window.getSelection().toString().length)) > 5,
    JSON.stringify(await page.evaluate(() => window.getSelection().toString())))

  /* 9b. The reported one: pick a phrase, then start a second drag inside it.
         Every browser reads that as the start of a drag of the selected text
         and holds the selection still — so the second pick used to do nothing
         at all, which is exactly "the mouse refuses to highlight text". */
  const wide = await page.locator('.cm-line').first().boundingBox()
  await page.mouse.move(wide.x + 10, wide.y + wide.height / 2)
  await page.mouse.down()
  await page.mouse.move(wide.x + 300, wide.y + wide.height / 2, { steps: 14 })
  await page.mouse.up()
  await page.waitForTimeout(200)
  const firstPick = await page.evaluate(() => window.getSelection().toString())
  await page.mouse.move(wide.x + 60, wide.y + wide.height / 2)
  await page.mouse.down()
  await page.mouse.move(wide.x + 130, wide.y + wide.height / 2, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(200)
  const secondPick = await page.evaluate(() => window.getSelection().toString())
  ok('a second drag inside the first selection picks something new',
    secondPick.length > 2 && secondPick !== firstPick,
    `${JSON.stringify(firstPick).slice(0, 30)} then ${JSON.stringify(secondPick)}`)
  ok('and it moved no writing',
    (await page.evaluate(() => document.querySelector('.cm-content').textContent)).startsWith(
      'The tent held through the night',
    ))

  /* 9c. The other half of it, and the one that needed no press inside
         anything. CodeMirror asks whether a press landed in the selection by
         measuring the *browser's* selection rectangles, and when the browser
         has no selection at all it answers "yes" rather than "no" — so every
         press on the page reads as the start of a text drag and no drag
         anywhere picks anything. That state is ordinary on Windows, where
         Chrome and Edge drop the selection when the editor loses the focus.
         Headless Chromium keeps it, so it is made here deliberately: this is
         a real branch of the code either way, and the only one a Mac never
         reaches. */
  /* A few more lines, so a press can land on one the caret was never on. */
  await page.locator('.cm-content').click()
  await page.keyboard.press('ControlOrMeta+End')
  for (const line of [
    'Rope and canvas and rain across the whole ridge line at dawn together.',
    'Third line of writing here, long enough to drag a good way across it.',
  ]) {
    await page.keyboard.press('Enter')
    await page.keyboard.type(line, { delay: 2 })
  }
  await page.waitForTimeout(300)

  const forget = async () => {
    await page.evaluate(() => {
      const view = document.querySelector('.cm-content').cmTile.view
      view.dispatch({ selection: { anchor: 4, head: 20 } })
      view.contentDOM.blur()
      window.getSelection().removeAllRanges()
    })
    await page.waitForTimeout(200)
  }

  await forget()
  ok('the browser can hold no selection while the editor holds one',
    await page.evaluate(() => {
      const view = document.querySelector('.cm-content').cmTile.view
      return !view.state.selection.main.empty && window.getSelection().rangeCount === 0
    }))
  const other = await page.locator('.cm-line').nth(1).boundingBox()
  await page.mouse.move(other.x + 20, other.y + other.height / 2)
  await page.mouse.down()
  await page.mouse.move(other.x + 240, other.y + other.height / 2, { steps: 14 })
  await page.mouse.up()
  await page.waitForTimeout(200)
  ok('a drag still picks writing with a selection the browser has forgotten',
    (await page.evaluate(() => window.getSelection().toString())).length > 5,
    JSON.stringify(await page.evaluate(() => window.getSelection().toString())))

  /* And a press must not need a click on that line first, which was the
     shape the report took. */
  await forget()
  const far = await page.locator('.cm-line').nth(2).boundingBox()
  await page.mouse.move(far.x + 15, far.y + far.height / 2)
  await page.mouse.down()
  await page.mouse.move(far.x + 200, far.y + far.height / 2, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(200)
  ok('on a line the caret was never on, without clicking it first',
    (await page.evaluate(() => window.getSelection().toString())).length > 5,
    JSON.stringify(await page.evaluate(() => window.getSelection().toString())))

  /* A right press must be left alone — it opens a menu about the selection,
     and collapsing first would empty the thing the menu is about. */
  await page.mouse.move(wide.x + 10, wide.y + wide.height / 2)
  await page.mouse.down()
  await page.mouse.move(wide.x + 240, wide.y + wide.height / 2, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(200)
  const held = await page.evaluate(() => window.getSelection().toString())
  await page.mouse.click(wide.x + 100, wide.y + wide.height / 2, { button: 'right' })
  await page.waitForTimeout(200)
  ok('a right press leaves the selection alone',
    (await page.evaluate(() => window.getSelection().toString())) === held,
    JSON.stringify(await page.evaluate(() => window.getSelection().toString())))

  /* And shift-click must still extend a selection rather than start one. */
  await page.mouse.click(wide.x + 10, wide.y + wide.height / 2)
  await page.waitForTimeout(120)
  await page.keyboard.down('Shift')
  await page.mouse.click(wide.x + 200, wide.y + wide.height / 2)
  await page.keyboard.up('Shift')
  await page.waitForTimeout(200)
  ok('shift-click still extends a selection',
    (await page.evaluate(() => window.getSelection().toString())).length > 8,
    JSON.stringify(await page.evaluate(() => window.getSelection().toString())))

  /* 10. A drag that starts on a marked word — the markers are hidden and
         atomic, which is where a selection can refuse to start. */
  await page.keyboard.press('Enter')
  await page.keyboard.type('Rope and **canvas** and rain across the ridge.', { delay: 4 })
  await page.waitForTimeout(250)
  const marked = await page.locator('.cm-line').nth(1).boundingBox()
  await page.mouse.move(marked.x + 2, marked.y + marked.height / 2)
  await page.mouse.down()
  await page.mouse.move(marked.x + 180, marked.y + marked.height / 2, { steps: 14 })
  await page.mouse.up()
  await page.waitForTimeout(200)
  ok('a drag from the very start of a marked line selects it',
    (await page.evaluate(() => window.getSelection().toString().length)) > 5,
    JSON.stringify(await page.evaluate(() => window.getSelection().toString())))

  console.log('\n— the keyboard inside a table —\n')

  await newTable(page)
  await fill(page, ['A1', 'B1', 'C1', 'A2', 'B2', 'C2', 'A3', 'B3', 'C3'])

  /* 11. Arrows between cells, the way every spreadsheet moves. */
  await page.locator('.md-table td').nth(4).click()
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(150)
  ok('ArrowDown moves to the cell below',
    (await page.evaluate(() => document.activeElement?.dataset?.row)) === '2',
    `row ${await page.evaluate(() => document.activeElement?.dataset?.row ?? 'none')}`)

  await page.locator('.md-table td').nth(4).click()
  await page.keyboard.press('ArrowUp')
  await page.waitForTimeout(150)
  ok('ArrowUp moves to the cell above',
    (await page.evaluate(() => document.activeElement?.dataset?.row)) === '0',
    `row ${await page.evaluate(() => document.activeElement?.dataset?.row ?? 'none')}`)

  /* 12. Undo. CodeMirror's history owns the table's markdown, so ⌘Z in a cell
         should walk it back. */
  const before = await stored(page)
  await page.locator('.md-table td').nth(4).click()
  await page.keyboard.type(' twenty', { delay: 5 })
  await page.waitForTimeout(400)
  await page.keyboard.press('ControlOrMeta+z')
  await page.waitForTimeout(400)
  ok('undo in a cell walks the table back', (await stored(page)) === before,
    JSON.stringify((await stored(page)).split('\n').find((l) => l.includes('B2'))))

  /* 13. Tab off the last cell. */
  const cells = page.locator('.md-table td')
  const last = (await cells.count()) - 1
  await cells.nth(last).click()
  await page.keyboard.press('Tab')
  await page.waitForTimeout(200)
  ok('Tab off the last cell adds a row rather than trapping the caret',
    (await page.locator('.md-table tr').count()) === 4,
    `${await page.locator('.md-table tr').count()} rows`)

  console.log('\n— what a spreadsheet has that this has not —\n')

  /* 14. Alignment. GFM says it with colons in the delimiter row, and this
         reader used to throw them away — so a table written in any other
         editor arrived here having quietly lost something the file said. The
         markdown goes in through the document rather than the keyboard,
         because the widget takes the lines over the moment the delimiter row
         is finished and the third line would be typed into a cell. */
  await page.locator('.plate-button', { hasText: 'New page' }).first().click()
  await page.waitForTimeout(600)
  await page.locator('.cm-content').click()
  await page.evaluate(() => {
    const view = document.querySelector('.cm-content').cmTile.view
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: '| Item | Cost |\n| --- | ---: |\n| Oak | 40 |\n',
      },
    })
  })
  await page.waitForTimeout(600)
  ok('a right-aligned column stays right-aligned',
    (await stored(page)).includes('---:'),
    JSON.stringify((await stored(page)).split('\n').filter((l) => l.includes('-'))))
  ok('and the drawing says so too',
    (await page.locator('.md-table td[style*="right"], .md-table .md-col-right').count()) > 0)

  /* 15. Pasting a block out of Excel or Sheets — tabs between cells, newlines
         between rows. Today it lands as one string in one cell. */
  await newTable(page)
  await page.locator('.md-table td').nth(0).click()
  await page.evaluate(() => {
    const data = new DataTransfer()
    data.setData('text/plain', 'Item\tCost\nOak\t40\nAsh\t28')
    document.activeElement.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    )
  })
  await page.waitForTimeout(500)
  ok('a block pasted from a spreadsheet fills the cells it came from',
    JSON.stringify(await drawn(page)).includes('Oak|40'),
    JSON.stringify(await drawn(page)))

  /* 16. Getting rid of a table at all. */
  ok('a table can be deleted from its own controls',
    (await page.locator('.md-table-control[aria-label*="Delete"], .md-table-control[aria-label*="Remove this table"]').count()) > 0)
})

/* ── the desk, once more, for the things a merge changes ────────────── */

await desk(1440, 900, async (page) => {
  console.log('\n— a table that has been merged both ways —\n')

  await newTable(page)
  await fill(page, ['A1', 'B1', 'C1', 'A2', 'B2', 'C2', 'A3', 'B3', 'C3'])

  /* Pick A2 through B3 with the mouse and merge the block. */
  const a2 = await page.locator('.md-table td').nth(3).boundingBox()
  const b3 = await page.locator('.md-table td').nth(7).boundingBox()
  await page.mouse.move(a2.x + 8, a2.y + a2.height / 2)
  await page.mouse.down()
  await page.mouse.move(b3.x + b3.width / 2, b3.y + b3.height / 2, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(200)
  await control(page, 'Merge the picked cells, or join this one to its right').click()
  await page.waitForTimeout(400)

  const body = await stored(page)
  ok('a block merged with the mouse is one cell', /A2 B2 A3 B3/.test(body),
    JSON.stringify(body.split('\n').filter((l) => l.startsWith('|'))))
  ok('and the file says so with both marks', body.includes('| <') || body.includes('< |'),
    JSON.stringify(body.split('\n').filter((l) => l.includes('<') || l.includes('^'))))
  ok('the merged cell covers two rows',
    (await page.locator('.md-table td[rowspan="2"]').count()) === 1)
  ok('the drawing still agrees with the file',
    JSON.stringify(await drawn(page)) === JSON.stringify(await inFile(page)),
    `drawn ${JSON.stringify(await drawn(page))} vs file ${JSON.stringify(await inFile(page))}`)

  /* Every row is still a whole number of 28px lines. Break this and the dot
     grid walks out from under the writing, which is the one rule the leaf is
     not allowed to break. */
  const heights = await page.locator('.md-table tr').evaluateAll((rows) =>
    rows.map((tr) => Math.round(tr.getBoundingClientRect().height)),
  )
  ok('every row is still a whole number of 28px lines', heights.every((h) => h % 28 === 0),
    heights.join(', '))

  /* No rule is drawn across the middle of a merged cell. */
  const crossing = await page.evaluate(() => {
    const host = document.querySelector('.md-table')
    const table = host.querySelector('table')
    const box = table.getBoundingClientRect()
    const merged = [...host.querySelectorAll('td[rowspan="2"], td[colspan="2"]')]
    const lines = [...host.querySelectorAll('.md-table-rules .md-hand-ink')].map((p) => {
      const d = p.getAttribute('d')
      const m = d.match(/M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)/)
      return m ? m.slice(1).map(Number) : null
    })
    let bad = 0
    for (const td of merged) {
      const r = td.getBoundingClientRect()
      const top = r.top - box.top
      const bottom = r.bottom - box.top
      const left = r.left - box.left
      const right = r.right - box.left
      for (const line of lines) {
        if (!line) continue
        const [x1, y1, x2, y2] = line
        /* A horizontal rule strictly inside the cell's own height. */
        if (y1 === y2 && y1 > top + 2 && y1 < bottom - 2 && x1 < right - 2 && x2 > left + 2) bad++
        /* Or a vertical one strictly inside its width. */
        if (x1 === x2 && x1 > left + 2 && x1 < right - 2 && y1 < bottom - 2 && y2 > top + 2) bad++
      }
    }
    return bad
  })
  ok('no rule is drawn through a merged cell', crossing === 0, `${crossing} crossings`)

  /* A grip still hangs on the seam, even though the head row no longer
     breaks at it. */
  ok('the columns can still be resized past a merge',
    (await page.locator('.md-table-grip:not(.edge)').count()) === 2,
    `${await page.locator('.md-table-grip:not(.edge)').count()} grips`)

  /* Split it again, from the range. */
  await page.locator('.md-table td[rowspan="2"]').click()
  await page.waitForTimeout(150)
  await control(page, 'Give the merged cells back').click()
  await page.waitForTimeout(400)
  ok('a block merge splits back into single cells',
    (await page.locator('.md-table td').count()) === 9,
    `${await page.locator('.md-table td').count()} cells`)

  console.log('\n— things that move a cell without changing the file —\n')

  await newTable(page)
  await fill(page, ['Item', 'Cost', 'Note', 'White oak, eight quarter, kiln dried', '40', 'dry'])
  const ruleHeight = () =>
    page.locator('.md-table-rules').evaluate((el) => Number(el.getAttribute('height')))
  const tableHeight = () =>
    page.locator('.md-table table').evaluate((el) => el.offsetHeight)
  ok('the rules are the height of the table', (await ruleHeight()) === (await tableHeight()),
    `${await ruleHeight()} vs ${await tableHeight()}`)

  /* Fold the page list away, which makes the leaf wider and every row
     shorter. Nothing about the document changes, so nothing used to redraw
     the rules and they stayed the height the table used to be. */
  await page.keyboard.press('ControlOrMeta+\\')
  await page.waitForTimeout(500)
  ok('and still are after a column is folded away',
    (await ruleHeight()) === (await tableHeight()),
    `${await ruleHeight()} vs ${await tableHeight()}`)
  await page.keyboard.press('ControlOrMeta+\\')
  await page.waitForTimeout(400)

  /* And after the zoom dial moves, which changes the pitch and the type
     together. */
  await page.locator('.mark-button[aria-label="Style"]').click()
  await page.waitForTimeout(250)
  await page.locator('.tray [aria-label="Larger"], .tray [aria-label="Zoom in"]').first().click()
  await page.waitForTimeout(500)
  ok('and after the writing is made larger',
    (await ruleHeight()) === (await tableHeight()),
    `${await ruleHeight()} vs ${await tableHeight()}`)

  console.log('\n— a range on the clipboard —\n')

  await newTable(page)
  await fill(page, ['A1', 'B1', 'C1', 'A2', 'B2', 'C2', 'A3', 'B3', 'C3'])
  const from = await page.locator('.md-table td').nth(3).boundingBox()
  const to = await page.locator('.md-table td').nth(7).boundingBox()
  await page.mouse.move(from.x + 8, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(200)
  const copied = await page.evaluate(() => {
    const data = new DataTransfer()
    document.activeElement.dispatchEvent(
      new ClipboardEvent('copy', { clipboardData: data, bubbles: true, cancelable: true }),
    )
    return data.getData('text/plain')
  })
  ok('a picked range copies as a spreadsheet block', copied === 'A2\tB2\nA3\tB3',
    JSON.stringify(copied))

  console.log('\n— adding on the other side —\n')

  await newTable(page)
  await fill(page, ['A1', 'B1', 'C1'])
  await page.locator('.md-table td').nth(0).click()
  await page.waitForTimeout(120)
  await page.locator('.md-table-control[aria-label^="Add a column"]').click({ modifiers: ['Alt'] })
  await page.waitForTimeout(400)
  ok('Alt puts a new column before the first one',
    (await drawn(page))[0] === '|A1|B1|C1', JSON.stringify((await drawn(page))[0]))

  await newTable(page)
  await fill(page, ['A1', 'B1', 'C1', 'A2', 'B2', 'C2'])
  await page.locator('.md-table td').nth(3).click()
  await page.waitForTimeout(120)
  await page.locator('.md-table-control[aria-label^="Add a row"]').click({ modifiers: ['Alt'] })
  await page.waitForTimeout(400)
  ok('Alt puts a new row above this one',
    (await drawn(page))[1] === '||', JSON.stringify(await drawn(page)))
})

/* ── a tablet, and then a phone ──────────────────────────────────────────
   Neither has a modifier key or a mouse, so everything a range does is out of
   reach there by design. What must not be out of reach is merging at all —
   which is what the two merge controls are for, and why they were kept as
   controls rather than folded into the drag. */

for (const [name, w, h] of [
  ['tablet', 834, 1112],
  ['phone', 393, 852],
]) {
  await desk(w, h, async (page) => {
    console.log(`\n— ${name} (${w}×${h}) —\n`)

    await newTable(page)
    ok('a table goes on the page', (await page.locator('.md-table').count()) === 1)
    ok('and does not push the leaf sideways',
      await page.evaluate(() => document.scrollingElement.scrollWidth <= window.innerWidth + 1),
      `${await page.evaluate(() => document.scrollingElement.scrollWidth)} vs ${w}`)

    await fill(page, ['A1', 'B1', 'C1', 'A2', 'B2', 'C2'])
    ok('cells take writing', JSON.stringify(await drawn(page)).includes('A2|B2|C2'),
      JSON.stringify(await drawn(page)))

    /* The controls have to be reachable — the bar scrolls sideways rather
       than becoming a second row. */
    const bar = await page.locator('.md-table-controls').boundingBox()
    ok('the control bar fits the leaf', bar.width <= w, `${Math.round(bar.width)}px of ${w}`)
    const scrolls = await page
      .locator('.md-table-controls')
      .evaluate((el) => el.scrollWidth > el.clientWidth + 1)
    ok('and scrolls sideways when it does not fit', bar.width < w || scrolls, `${scrolls}`)

    /* Merging with no mouse and no modifier: two taps of two controls. */
    await page.locator('.md-table td').nth(3).click()
    await page.waitForTimeout(150)
    await control(page, 'Merge the picked cells, or join this one to its right').click()
    await page.waitForTimeout(400)
    ok('a cell merges to its right with one tap',
      (await page.locator('.md-table td[colspan="2"]').count()) === 1)

    await page.locator('.md-table td').nth(0).click()
    await page.waitForTimeout(150)
    await control(page, 'Merge the picked cells, or join this one to the one below').click()
    await page.waitForTimeout(400)
    ok('and downward with one tap',
      (await page.locator('.md-table td[rowspan="2"]').count()) === 1)
    ok('the drawing agrees with the file',
      JSON.stringify(await drawn(page)) === JSON.stringify(await inFile(page)),
      `drawn ${JSON.stringify(await drawn(page))} vs file ${JSON.stringify(await inFile(page))}`)

    const heights = await page.locator('.md-table tr').evaluateAll((rows) =>
      rows.map((tr) => Math.round(tr.getBoundingClientRect().height)),
    )
    /* The pitch as the cells themselves are set to, which is the thing the
       row heights have to be a multiple of. */
    const pitch = await page.evaluate(() =>
      Math.round(parseFloat(getComputedStyle(document.querySelector('.md-table td')).lineHeight)),
    )
    ok('every row is a whole number of lines', heights.every((r) => r % pitch === 0),
      `${heights.join(', ')} against ${pitch}`)
  })
}

await browser.close()

for (const p of problems) console.log('!!  ' + p)
if (failures || problems.length) {
  console.log(`\n${failures} failed`)
  process.exit(1)
}
console.log('\nall good')
