import { db, changed, markFor } from './db'
import type { FieldEvent } from './model'

export type EventDraft = Pick<FieldEvent, 'title' | 'date'> &
  Partial<Pick<FieldEvent, 'startTime' | 'endTime' | 'location' | 'note' | 'pageId' | 'calendarTarget'>>

export async function liveEvents(): Promise<FieldEvent[]> {
  return (await db.events.toArray())
    .filter((event) => !event.deleted)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.title.localeCompare(b.title))
}

export async function eventsOnDay(date: string): Promise<FieldEvent[]> {
  return (await db.events.where('date').equals(date).toArray())
    .filter((event) => !event.deleted)
    .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.title.localeCompare(b.title))
}

export async function eventsInMonth(month: string): Promise<FieldEvent[]> {
  return (await liveEvents()).filter((event) => event.date.startsWith(month))
}

export async function daysWithEvents(): Promise<Set<string>> {
  return new Set((await liveEvents()).map((event) => event.date))
}

export async function getEvent(id: string): Promise<FieldEvent | undefined> {
  return db.events.get(id)
}

export async function eventsForPage(pageId: string): Promise<FieldEvent[]> {
  return (await liveEvents()).filter((event) => event.pageId === pageId)
}

export async function deletedEvents(): Promise<FieldEvent[]> {
  return (await db.events.toArray())
    .filter((event) => event.deleted)
    .sort((a, b) => (b.deleted ?? 0) - (a.deleted ?? 0))
}

export async function saveEvent(draft: EventDraft, id?: string): Promise<FieldEvent> {
  const previous = id ? await db.events.get(id) : undefined
  if (id && (!previous || previous.deleted)) throw new Error('This event is no longer available.')
  if (draft.pageId) {
    const page = await db.pages.get(draft.pageId)
    if (!page || page.deleted) throw new Error('The linked page is no longer available.')
  }
  const now = Date.now()
  const event: FieldEvent = {
    id: previous?.id ?? crypto.randomUUID(),
    title: draft.title.trim(),
    date: draft.date,
    ...(draft.startTime ? { startTime: draft.startTime } : {}),
    ...(draft.endTime ? { endTime: draft.endTime } : {}),
    ...(draft.location?.trim() ? { location: draft.location.trim() } : {}),
    ...(draft.note?.trim() ? { note: draft.note.trim() } : {}),
    ...(draft.pageId ? { pageId: draft.pageId } : {}),
    ...(draft.calendarTarget ? { calendarTarget: draft.calendarTarget } : {}),
    created: previous?.created ?? now,
    updated: Math.max(now, (previous?.updated ?? 0) + 1),
    ...(previous?.conflictOf ? { conflictOf: previous.conflictOf } : {}),
  }
  await db.events.put(event)
  changed()
  return event
}

export async function deleteEvent(id: string): Promise<void> {
  const event = await db.events.get(id)
  if (!event || event.deleted) return
  const now = Math.max(Date.now(), event.updated + 1)
  await db.events.put({ ...event, deleted: now, updated: now })
  changed()
}

export async function restoreEvent(id: string): Promise<void> {
  const event = await db.events.get(id)
  if (!event?.deleted) return
  const { deleted: _deleted, ...rest } = event
  await db.events.put({ ...rest, updated: Math.max(Date.now(), event.updated + 1) })
  changed()
}

export async function purgeEvent(id: string): Promise<void> {
  await db.events.delete(id)
  await db.synced.delete(markFor.event(id))
  changed()
}

export function eventDetails(draft: EventDraft): string {
  const [year, month, day] = draft.date.split('-').map(Number)
  const date = new Intl.DateTimeFormat([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    .format(new Date(year, month - 1, day, 12))
  return [
    draft.title.trim(),
    `Date: ${date}`,
    draft.startTime ? `Time: ${draft.startTime}${draft.endTime ? `–${draft.endTime}` : ''}` : null,
    draft.location?.trim() ? `Location: ${draft.location.trim()}` : null,
    draft.note?.trim() ? `Notes: ${draft.note.trim()}` : null,
  ].filter(Boolean).join('\n')
}
