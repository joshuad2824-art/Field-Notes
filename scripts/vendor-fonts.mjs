/* Re-vendor the type. The app self-hosts its fonts — see CLAUDE.md — and this
   is the script that fills public/fonts from Google Fonts if a face is ever
   added or updated. Run it from the repo root:

     node scripts/vendor-fonts.mjs

   It fetches the css2 stylesheet with a woff2-capable user agent, keeps the
   latin and latin-ext subsets, downloads the files, and writes fonts.css.

   One thing it adds that Google doesn't: Playfair Display gets ascent and
   descent overrides. Its natural metrics run to ~1.36em, which at the quote's
   22px is a 30px box on a 28px line — the line box tips to 29 and the dot
   grid walks out from under the writing. 100%/25% keeps the font's own ~80/20
   ascent share and caps the box at 1.25em, so 22px type fits the pitch. */
import { writeFileSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'

const CSS2 =
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..700;1,400..600&family=Spectral:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Archivo:wght@400;500;600&family=Oswald:wght@300;400;500;600&family=Courier+Prime:wght@400;700&family=Grape+Nuts&family=Caveat:wght@400..600&display=swap'
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const OVERRIDES = {
  'Playfair Display': ['ascent-override: 100%;', 'descent-override: 25%;', 'line-gap-override: 0%;'],
}

const outDir = new URL('../public/fonts/', import.meta.url).pathname
mkdirSync(outDir, { recursive: true })

const css = execSync(`curl -sS -A "${UA}" "${CSS2}"`, { encoding: 'utf8' })

const lines = [
  '/* The type, vendored. An app whose editor has zero awareness a network',
  '   exists should not get its feel from a CDN: first paint on a fresh device',
  '   with no network must not fall back to Georgia and Arial. Latin and',
  '   latin-ext subsets of exactly what index.html used to pull from',
  '   fonts.googleapis.com. Regenerate with scripts/vendor-fonts.mjs. */',
  '',
]
let count = 0
for (const m of css.matchAll(/\/\* ([a-z-]+) \*\/\s*@font-face \{([^}]+)\}/g)) {
  const subset = m[1]
  if (subset !== 'latin' && subset !== 'latin-ext') continue
  const body = m[2]
  const get = (prop) => body.match(new RegExp(prop + ':\\s*([^;]+);'))?.[1].trim()
  const family = get('font-family').replace(/'/g, '')
  const style = get('font-style')
  const weight = get('font-weight')
  const stretch = get('font-stretch')
  const range = get('unicode-range')
  const url = body.match(/url\((https:[^)]+\.woff2)\)/)?.[1]
  const name = `${family.toLowerCase().replace(/\s+/g, '-')}-${
    style === 'italic' ? 'italic-' : ''
  }${weight.replace(' ', '-')}-${subset}.woff2`
  execSync(`curl -sS -o "${outDir}${name}" "${url}"`)
  lines.push(
    `/* ${subset} */`,
    '@font-face {',
    `  font-family: '${family}';`,
    `  font-style: ${style};`,
    `  font-weight: ${weight};`,
    ...(stretch ? [`  font-stretch: ${stretch};`] : []),
    ...(OVERRIDES[family] ?? []).map((l) => `  ${l}`),
    '  font-display: swap;',
    `  src: url(/fonts/${name}) format('woff2');`,
    `  unicode-range: ${range};`,
    '}',
  )
  count++
}
writeFileSync(`${outDir}fonts.css`, lines.join('\n') + '\n')
console.log(`${count} faces vendored into public/fonts`)
