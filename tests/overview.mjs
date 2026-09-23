import assert from 'node:assert/strict'
import { summarizeOverview } from '../src/lib/overview.ts'

const page = (id, body, extra = {}) => ({
  id,
  notebook: 'field-notes',
  body,
  created: 1,
  updated: 1,
  pinned: 0,
  ...extra,
})

const summary = summarizeOverview([
  page('one', '# Plan\n- [ ] Call the team\n- [x] Finished\n```md\n- [ ] Example only\n```\n1. [ ] Send **draft**', { updated: 10, pinned: 1 }),
  page('two', '# Later\n* [ ] Review notes', { updated: 20, notebook: 'church' }),
  page('three', '# Removed\n- [ ] Should disappear', { deleted: 30 }),
  page('four', '# Journal\n- [ ] Keep this too', { notebook: 'journal', updated: 15 }),
])

assert.equal(summary.pageCount, 3)
assert.equal(summary.taskCount, 4)
assert.deepEqual(summary.tasks.map((task) => task.text), ['Review notes', 'Keep this too', 'Call the team', 'Send draft'])
assert.deepEqual(summary.recent.map((entry) => entry.id), ['two', 'four', 'one'])
assert.deepEqual(summary.pinned.map((entry) => entry.id), ['one'])
assert.deepEqual(summary.notebookCounts, { 'field-notes': 1, church: 1, journal: 1 })

console.log('PASS  overview summary ignores deleted pages and code examples, and orders live work')
