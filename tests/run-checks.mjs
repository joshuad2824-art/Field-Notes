// Local Vite server required: BASE=http://127.0.0.1:5188 npm run check.
// Historical layout-specific checks remain available as check:previous-layout.
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
const names = [
  'overview',
  'editor',
  'format-join',
  'spreadsheet',
  'sync',
  'weather',
  'journal',
  'roundtrip',
  'experience',
  'dashboard-data',
  'event-ranges',
  'event-recurrence',
  'links',
  'tray-dismiss',
  'link-writing',
  'weather-location',
  'open-editor-sync',
  'davis-consumer',
  'workshop-plugin',
  'siena-routing',
  'redesign-theme',
  'redesign',
  'redesign-actions',
  'pdf-adjustments',
]
const out = 'work/check-results'
mkdirSync(out, { recursive: true })
const previous = process.argv.includes('--retry-failed')
  ? JSON.parse(readFileSync(`${out}/report.json`, 'utf8'))
  : []
if (previous.length) {
  const failed = new Set(previous.filter((r) => r.code !== 0).map((r) => r.name))
  names.splice(0, names.length, ...names.filter((n) => failed.has(n)))
}
const results = previous.filter((r) => r.code === 0)
async function worker() {
  while (names.length) {
    const name = names.shift()
    const result = await new Promise((resolve) => {
      let output = ''
      const child = spawn(process.execPath, [`tests/${name}.mjs`], {
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      child.stdout.on('data', (d) => (output += d))
      child.stderr.on('data', (d) => (output += d))
      const timeout = setTimeout(() => child.kill('SIGTERM'), 300000)
      child.on('close', (code) => {
        clearTimeout(timeout)
        writeFileSync(`${out}/${name}.log`, output)
        resolve({ name, code, output })
      })
    })
    results.push({ name: result.name, code: result.code })
    console.log(`${result.code === 0 ? 'PASS' : 'FAIL'} ${name}`)
    if (result.code !== 0) console.error(result.output.slice(-3000))
  }
}
await worker()
writeFileSync(`${out}/report.json`, JSON.stringify(results, null, 2))
process.exit(results.some((r) => r.code !== 0) ? 1 : 0)
