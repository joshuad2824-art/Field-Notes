/* The diagnostic run. Not a gate — a list of open questions with the answers
   filled in by a real browser.

   `tests/editor.mjs` proves a mark goes ON. What it never does is go back to
   one that is already there, or press Enter through the middle of it. Both are
   ordinary things to do while writing, and both are where the app is currently
   glitchy. This file asks those questions and nothing else, so the list it
   prints is the list of things to fix.

   Run a server first, then this:

     npm run build && npm run preview &
     npm run diagnose

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
const ctx = await browser.newContext({ viewport: { width: 1240, height: 900 } })
const page = await ctx.newPage()
const problems = []
page.on('pageerror', (e) => problems.push('page error: ' + e.message))

let open = 0
const ok = (name, pass, detail = '') => {
  if (!pass) open++
  console.log(`${pass ? 'ok  ' : 'OPEN'}  ${name}${detail ? '  — ' + detail : ''}`)
}

const type = async (text) => {
  await page.keyboard.type(text, { delay: 6 })
  await page.waitForTimeout(110)
}

/* The editor, straight out of the DOM. CodeMirror hangs the view off the
   content element, which is the only way in from outside the bundle. */
const call = (fn, arg) =>
  page.evaluate(
    ([src, arg]) =>
      new Function('view', 'arg', 'return (' + src + ')(view, arg)')(
        document.querySelector('.cm-content').cmTile.view,
        arg,
      ),
    [fn.toString(), arg ?? null],
  )
const doc = () => call((v) => v.state.doc.toString())
/* What the eye actually sees. The syntax is never shown, so anything in here
   that still looks like markdown is a bug by decision 5. */
const seen = () => page.locator('.cm-line').evaluateAll((els) => els.map((e) => e.textContent))
const SYNTAX = /\*|~~|==|<u>|<\/u>|\{(center|right|brass|forest|navy|oxblood|driftwood)\}|`/
const showing = async () => (await seen()).filter((line) => SYNTAX.test(line))

const blank = async (text) => {
  await call((v) => v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: '' } }))
  await call((v) => v.focus())
  await page.waitForTimeout(80)
  if (text) await type(text)
}
const at = async (from, to) => {
  await call((v, r) => {
    v.dispatch({ selection: { anchor: r[0], head: r[1] } })
    v.focus()
  }, [from, to ?? from])
  await page.waitForTimeout(60)
}
const openTray = async () => {
  if (!(await page.locator('.tray').count())) {
    await page.locator('.mark-button[aria-label="Style"]').first().click()
    await page.waitForTimeout(250)
  }
}
const tray = async (label) => {
  await openTray()
  await page.locator(`.tray [aria-label="${label}"]`).first().click()
  await page.waitForTimeout(220)
}

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(800)
await page.getByText('New page', { exact: true }).first().click()
await page.waitForTimeout(700)
await page.locator('.cm-content').click()

/* ── 1. going back to a highlight that is already there ──────────────── */

console.log('\n— the highlighter, revisited —\n')

/* Six ways of pointing at a highlighted word before reaching for the tray.
   Only one of them can currently be the one you happened to use. */
const WAYS = [
  ['the caret inside the word', (d) => [d.indexOf('bravo') + 2]],
  ['the word selected exactly', (d) => [d.indexOf('bravo'), d.indexOf('bravo') + 5]],
  ['the word and a trailing space', (d) => [d.indexOf('bravo'), d.indexOf('bravo') + 6]],
  ['the whole line selected', (d) => [0, d.length]],
  ['the caret at the front of the word', (d) => [d.indexOf('bravo')]],
  ['the caret at the back of the word', (d) => [d.indexOf('bravo') + 5]],
]

const highlighted = async () => {
  await blank('alpha bravo charlie')
  await at(6, 11)
  await tray('brass')
  return doc()
}

for (const [where, find] of WAYS) {
  const before = await highlighted()
  await at(...find(before))
  await tray('Remove highlight')
  const after = await doc()
  ok(`a highlight comes off with ${where}`, after === 'alpha bravo charlie', JSON.stringify(after))
}

for (const [where, find] of WAYS) {
  const before = await highlighted()
  await at(...find(before))
  await tray('navy')
  const after = await doc()
  ok(
    `a highlight changes colour with ${where}`,
    after === 'alpha =={navy}bravo== charlie',
    JSON.stringify(after),
  )
}

/* The failure that costs a page rather than a tap: a second opener nested
   inside the first, which the grammar cannot hide. */
{
  const before = await highlighted()
  await at(before.indexOf('bravo') + 2)
  await tray('navy')
  ok('and never leaves its syntax on the page', (await showing()).length === 0, (await seen()).join(' / '))
}

/* Part of a highlighted phrase given a colour of its own. */
{
  await blank('alpha bravo charlie delta')
  await at(6, 19)
  await tray('brass')
  const d = await doc()
  await at(d.indexOf('charlie'), d.indexOf('charlie') + 7)
  await tray('navy')
  ok('part of a highlighted phrase can be recoloured', !(await doc()).includes('===='), await doc())
}

/* The other marks are asked the same question, and pass it — the word under
   the caret lands exactly on their markers, which is the fix the highlighter
   is missing. */
for (const [name, key, open_, close] of [
  ['bold', 'Control+b', '**', '**'],
  ['italic', 'Control+i', '*', '*'],
  ['underline', 'Control+u', '<u>', '</u>'],
]) {
  await blank('alpha bravo charlie')
  await at(6, 11)
  await page.keyboard.press(key)
  await page.waitForTimeout(150)
  const d = await doc()
  ok(`${name} goes on`, d === `alpha ${open_}bravo${close} charlie`, JSON.stringify(d))
  await at(d.indexOf('bravo') + 2)
  await page.keyboard.press(key)
  await page.waitForTimeout(150)
  ok(`${name} comes off from inside the word`, (await doc()) === 'alpha bravo charlie', await doc())
}

/* ── 2. Enter through the middle of something formatted ──────────────── */

console.log('\n— Enter, mid-mark —\n')

/* A mark is read one line at a time, so a run split across a line break can
   never be hidden. Every paired mark has this, and what it looks like from the
   chair is markdown appearing on the page as you press Enter. */
const splitting = async (name, apply) => {
  await blank('alpha bravo')
  await at(6, 11)
  await apply()
  const before = await doc()
  await at(before.indexOf('bravo') + 2)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  ok(
    `Enter through the middle of ${name} leaves no syntax showing`,
    (await showing()).length === 0,
    `${JSON.stringify(before)} → ${JSON.stringify(await seen())}`,
  )
}

const press = (key) => async () => {
  await page.keyboard.press(key)
  await page.waitForTimeout(150)
}

await splitting('a bold word', press('Control+b'))
await splitting('an italic word', press('Control+i'))
await splitting('an underlined word', press('Control+u'))
await splitting('a struck word', () => tray('Strike'))
await splitting('a code span', () => tray('Code'))
await splitting('a highlight', () => tray('brass'))

/* Enter at the end of a formatted line is the common case and is already
   right. It is here so a fix for the above can't quietly break it. */
for (const [name, setup] of [
  ['a heading', async () => type('## A heading')],
  ['a bold line', async () => {
    await type('alpha bravo')
    await at(6, 11)
    await page.keyboard.press('Control+b')
  }],
  ['a highlighted line', async () => {
    await type('alpha bravo')
    await at(6, 11)
    await tray('brass')
  }],
  ['a centred line', async () => {
    await type('centred')
    await tray('Centre the line')
  }],
  ['a quote', async () => type('> a quote')],
]) {
  await blank()
  await setup()
  await page.waitForTimeout(150)
  await page.keyboard.press('Control+End')
  await page.keyboard.press('Enter')
  await type('and then')
  ok(`Enter at the end of ${name} leaves no syntax showing`, (await showing()).length === 0, (await seen()).join(' / '))
}

/* ── 3. a marker deleted out from under its pair ─────────────────────── */

console.log('\n— a marker left on its own —\n')

/* Markers are atomic, so backspace takes a whole `**` in one press. What it
   does not do is take the other one with it, and the survivor has nothing to
   pair with, so it shows. */
{
  await blank('alpha bravo charlie')
  await at(6, 11)
  await page.keyboard.press('Control+b')
  await page.waitForTimeout(150)
  const d = await doc()
  await at(d.indexOf('bravo'))
  await page.keyboard.press('Backspace')
  await page.waitForTimeout(200)
  ok('deleting the opener takes the closer with it', (await showing()).length === 0, `${await doc()} → ${(await seen()).join(' / ')}`)
}
{
  await blank('alpha bravo charlie')
  await at(6, 11)
  await page.keyboard.press('Control+b')
  await page.waitForTimeout(150)
  const d = await doc()
  await at(d.indexOf('bravo') + 5)
  await page.keyboard.press('Delete')
  await page.waitForTimeout(200)
  ok('deleting the closer takes the opener with it', (await showing()).length === 0, `${await doc()} → ${(await seen()).join(' / ')}`)
}
/* An empty pair has no content between it, so `[^=]+` cannot match and the
   colour tag itself lands on the page as text. */
{
  await blank('alpha bravo charlie')
  await at(6, 11)
  await tray('brass')
  const d = await doc()
  await at(d.indexOf('bravo'), d.indexOf('bravo') + 5)
  await page.keyboard.press('Backspace')
  await page.waitForTimeout(200)
  ok('emptying a highlight leaves no bare markers', (await showing()).length === 0, `${await doc()} → ${(await seen()).join(' / ')}`)
}

/* ── 4. two marks on the same run ────────────────────────────────────── */

console.log('\n— one mark inside another —\n')

/* Both orders are two taps away in the tray, and neither draws. This one is
   written down in CLAUDE.md for the highlight-outside order; it turns out to
   go the other way too. */
{
  await blank('alpha bravo charlie')
  await at(6, 11)
  await tray('brass')
  const d = await doc()
  await at(d.indexOf('bravo'), d.indexOf('bravo') + 5)
  await page.keyboard.press('Control+b')
  await page.waitForTimeout(200)
  ok('bold inside a highlight draws', (await showing()).length === 0, `${await doc()} → ${(await seen()).join(' / ')}`)
}
{
  await blank('alpha bravo charlie')
  await at(6, 11)
  await page.keyboard.press('Control+b')
  await page.waitForTimeout(150)
  const d = await doc()
  await at(d.indexOf('bravo'), d.indexOf('bravo') + 5)
  await tray('brass')
  ok('a highlight over a bold word draws', (await showing()).length === 0, `${await doc()} → ${(await seen()).join(' / ')}`)
}

/* ── 5. marks inside a table cell ────────────────────────────────────── */

console.log('\n— inside a table —\n')

await blank('a page with a table')
await page.keyboard.press('Control+End')
await page.keyboard.press('Enter')
await openTray()
await page.locator('.tray-word', { hasText: /^Table$/ }).first().click()
await page.waitForTimeout(600)

const cellMark = async (index, word, apply, wanted, where) => {
  const cell = page.locator('.md-table td').nth(index)
  await cell.click()
  await page.waitForTimeout(200)
  await type(word)
  await page.keyboard.down('Shift')
  for (let i = 0; i < word.length; i++) await page.keyboard.press('ArrowLeft')
  await page.keyboard.up('Shift')
  await apply()
  await page.waitForTimeout(350)
  ok(`${wanted.replace(/[*~`={}]|<\/?u>/g, '')} in ${where} reaches the file`, (await doc()).includes(wanted), await cell.evaluate((e) => e.innerHTML))
}

/* The head row is already set in a heavier weight, so the browser's own bold
   command reads the cell as bold and turns it off. What lands in the DOM is a
   span asking for normal weight, which the file has no word for — so the mark
   is dropped and the head cell un-bolds until the table next redraws. */
await cellMark(0, 'abc', press('Control+b'), '**abc**', 'a head cell')
await cellMark(3, 'abc', press('Control+b'), '**abc**', 'a body cell')
await cellMark(4, 'xyz', () => tray('Italic — ⌘I'), '*xyz*', 'a body cell')
await cellMark(5, 'pq', () => tray('Strike'), '~~pq~~', 'a body cell')
await cellMark(6, 'lit', () => tray('brass'), '=={brass}lit==', 'a body cell')

console.log('\n' + (problems.length ? problems.join('\n') : 'no page errors'))
console.log(`\n${open} open item${open === 1 ? '' : 's'}.`)

await browser.close()
process.exit(open ? 1 : 0)
