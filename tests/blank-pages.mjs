// Pure checks for which blank pages are cleared away. No browser, no database.
import assert from 'node:assert/strict'
import { sweepableBlanks, BLANK_GRACE_MS } from '../src/lib/model.ts'

const now = Date.parse('2026-10-13T15:00:00Z')
const old = now - BLANK_GRACE_MS - 1
const page = (id, body, extra = {}) => ({ id, body, updated: old, ...extra })
const ids = (pages, open = new Set()) => sweepableBlanks(pages, now, open).map((p) => p.id)

// Empty and whitespace-only pages go; a single full stop stays.
assert.deepEqual(ids([page('empty', ''), page('spaces', '  \n\n '), page('dot', '.')]), ['empty', 'spaces'])
// A page open on this device stays, however long it has sat.
assert.deepEqual(ids([page('open', '')], new Set(['open'])), [])
// Inside the grace period it stays: it may be open elsewhere.
assert.deepEqual(ids([page('fresh', '', { updated: now - 60_000 })]), [])
// Already deleted, reminders pages and journal entries are left alone.
assert.deepEqual(ids([page('gone', '', { deleted: old }), page('rem', '', { purpose: 'reminders' }), page('journal', '', { entryDate: '2026-10-12' })]), [])
// A picture alone is writing.
assert.deepEqual(ids([page('pic', '![](img:abc)')]), [])

console.log('PASS blank pages: empty pages left behind are swept; anything written, open, recent or purposeful stays')
