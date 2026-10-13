import { dueStamp } from '../lib/format'
export function DueLabel({ at }: { at: number; completed?: boolean }) {
  return <>Due {dueStamp(at)}</>
}
