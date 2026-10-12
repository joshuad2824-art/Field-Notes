import { COVER_COLORS } from './model'
export const COLOR_NAMES = [
  'Heather',
  'Midnight',
  'Harbor',
  'Deep water',
  'Slate teal',
  'Timber teal',
  'Pine',
  'Moss',
  'Goldenrod',
  'Rust',
  'Workshop',
  'Barn red',
  'Cranberry',
  'Berry',
  'Plum',
  'Graphite',
]
const legacy: Record<string, string> = {
  '#082744': '#1B2A5E',
  '#3a342e': '#5A5046',
  '#530a28': '#5A0B25',
  '#123737': '#1D4842',
  '#24332a': '#0E4A33',
  '#1b261f': '#0E4A33',
}
// Translate old covers at presentation time; never overwrite a synced preference on boot.
export function coverColor(color = '#1D4842') {
  return legacy[color.toLowerCase()] ?? (/^#[0-9a-f]{6}$/i.test(color) ? color : '#1D4842')
}
export function colorName(color: string) {
  return (
    COLOR_NAMES[
      COVER_COLORS.findIndex((c) => c.toLowerCase() === coverColor(color).toLowerCase())
    ] ?? 'Custom cover'
  )
}
function mix(a: string, b: string, amount: number) {
  return (
    '#' +
    [1, 3, 5]
      .map((i) =>
        Math.round(
          parseInt(a.slice(i, i + 2), 16) * (1 - amount) +
            parseInt(b.slice(i, i + 2), 16) * amount,
        )
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  )
}
export function themeRamp(color?: string) {
  const wash = coverColor(color)
  return {
    wash,
    base: mix(wash, '#000000', 0.3),
    deep: mix(wash, '#000000', 0.52),
    raised: mix(wash, '#ffffff', 0.1),
    soft: wash.toUpperCase() === '#876808' ? '#F6F3EC' : mix(wash, '#f6f3ec', 0.8),
  }
}
export function applyTheme(color?: string) {
  for (const [key, value] of Object.entries(themeRamp(color)))
    document.documentElement.style.setProperty(`--th-${key}`, value)
}
