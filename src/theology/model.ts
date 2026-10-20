export interface StudySection {
  id: string
  title: string
  level: number
  from: number // inclusive UTF-8 byte span in the original file
  to: number // exclusive; contiguous sections reconstruct every original byte
  week?: number
  reading?: number
  topic?: string
  sourceLocation?: string // conversion locator, separate from author text
  role: 'aid' | 'front' | 'reading' | 'reference'
}
export interface StudyEdition {
  scope: string
  id: string // source SHA-256, never a mutable title
  title: string
  source: Uint8Array
  bytes: number
  sections: StudySection[]
  anchors: Record<string, { section: string; offset: number }>
  sourceBoundary: number
  imported: number
  filename: string
}
export type HighlightColor = 'brass' | 'forest' | 'oxblood' | 'navy'
export interface StudyAnnotation {
  scope: string
  id: string
  edition: string
  section: string
  start: number // canonical displayed-text offsets; independent of viewport
  end: number
  quote: string
  prefix: string
  suffix: string
  color: HighlightColor
  created: number
  updated: number
  deleted?: number
}
export interface StudyPlace {
  scope: string
  id: string // edition ID
  section: string
  offset: number
  updated: number
}
export const DAILY_DOCTRINE = {
  sha256: 'f35227ef7917f20ef0bf5003653e4174869889fa399cc73968c3ea02311e50d2',
  bytes: 1127695,
  title: 'Daily Doctrine',
  filename: 'Daily Doctrine.md',
} as const
