// node tests/pixel-compare.mjs <dirA> <dirB> — every same-named PNG, pixel for pixel.
// Exits non-zero when any pair differs; prints the count and bounding box.
import { execSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
const { chromium } = await import(
  `${execSync('npm root -g', { encoding: 'utf8' }).trim()}/playwright/index.mjs`
)
const [a, b] = process.argv.slice(2)
const names = readdirSync(a).filter((n) => n.endsWith('.png'))
const browser = await chromium.launch()
const page = await browser.newPage()
const results = []
for (const name of names) {
  let other
  try {
    other = readFileSync(`${b}/${name}`)
  } catch {
    results.push({ name, missing: true })
    continue
  }
  const mine = readFileSync(`${a}/${name}`)
  if (mine.equals(other)) {
    results.push({ name, diff: 0 })
    continue
  }
  const r = await page.evaluate(
    async ([x, y]) => {
      const load = async (s) => {
        const img = new Image()
        img.src = 'data:image/png;base64,' + s
        await img.decode()
        const c = document.createElement('canvas')
        c.width = img.width
        c.height = img.height
        const g = c.getContext('2d')
        g.drawImage(img, 0, 0)
        return g.getImageData(0, 0, c.width, c.height)
      }
      const [p, q] = [await load(x), await load(y)]
      if (p.width !== q.width || p.height !== q.height)
        return { size: [p.width, p.height, q.width, q.height] }
      let diff = 0,
        box = [1e9, 1e9, -1, -1]
      for (let i = 0; i < p.data.length; i += 4) {
        if (
          p.data[i] !== q.data[i] ||
          p.data[i + 1] !== q.data[i + 1] ||
          p.data[i + 2] !== q.data[i + 2] ||
          p.data[i + 3] !== q.data[i + 3]
        ) {
          diff++
          const px = (i / 4) % p.width,
            py = Math.floor(i / 4 / p.width)
          box = [Math.min(box[0], px), Math.min(box[1], py), Math.max(box[2], px), Math.max(box[3], py)]
        }
      }
      return { diff, box }
    },
    [mine.toString('base64'), other.toString('base64')],
  )
  results.push({ name, ...r })
}
await browser.close()
const bad = results.filter((r) => r.missing || r.size || r.diff)
for (const r of bad) console.log(JSON.stringify(r))
console.log(`${names.length} compared, ${bad.length} differ`)
if (process.env.REPORT) writeFileSync(process.env.REPORT, JSON.stringify(results, null, 2))
process.exit(bad.length ? 1 : 0)
