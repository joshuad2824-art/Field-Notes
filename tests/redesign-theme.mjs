import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const { chromium } = await import(
  `${execSync('npm root -g', { encoding: 'utf8' }).trim()}/playwright/index.mjs`
)
const b = await chromium.launch(),
  p = await b.newPage()
try {
  await p.goto((process.env.BASE ?? 'http://127.0.0.1:5188') + '/')
  const ramps = await p.evaluate(async () => {
    const { themeRamp, coverColor } = await import('/src/lib/theme.ts')
    const { COVER_COLORS } = await import('/src/lib/model.ts')
    return {
      ramps: COVER_COLORS.map(themeRamp),
      legacy: ['#082744', '#3a342e', '#530a28', '#123737', '#24332a', '#1b261f'].map(
        coverColor,
      ),
    }
  })
  const luminance = (hex) =>
    hex
      .slice(1)
      .match(/../g)
      .map((c) => parseInt(c, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0)
  const contrast = (a, b) =>
    (Math.max(luminance(a), luminance(b)) + 0.05) /
    (Math.min(luminance(a), luminance(b)) + 0.05)
  assert.equal(ramps.ramps.length, 16)
  for (const r of ramps.ramps) {
    assert.ok(contrast(r.wash, '#F6F3EC') >= 4.5, `${r.wash} cream text`)
    assert.ok(contrast(r.wash, r.soft) >= 4.5, `${r.wash} soft text`)
  }
  assert.equal(ramps.ramps[8].soft, '#F6F3EC')
  assert.deepEqual(ramps.legacy, [
    '#1B2A5E',
    '#5A5046',
    '#5A0B25',
    '#1D4842',
    '#0E4A33',
    '#0E4A33',
  ])
  console.log(
    'PASS 16 theme ramps, AA text contrast, Goldenrod cream, legacy cover presentation',
  )
  // The editor highlighter stylesheet stays byte-for-byte as it was before the redesign.
  const original = execSync('git show HEAD:src/styles/leaf.css', { encoding: 'utf8' })
  assert.equal(readFileSync('src/styles/leaf.css', 'utf8'), original)
  console.log('PASS existing highlighter and editing stylesheet unchanged')
} finally {
  await b.close()
}
