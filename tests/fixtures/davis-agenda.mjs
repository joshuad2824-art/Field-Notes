// Synthetic contract fixture. Never written to a Davis household.
export const fixtureAccount = '00000000-0000-4000-8000-000000000001'
export const fixtureHousehold = '00000000-0000-4000-8000-000000000002'
export function agendaFixture(from = '2026-10-02', to = '2026-10-08', today = '2026-10-02') {
  const source = (collection, id, version) => ({ provider: 'davis-at-home', householdId: fixtureHousehold, collection, id, version, ownerId: null, audience: 'household' })
  return {
    schemaVersion: 1, readOnly: true, complete: true, accountId: fixtureAccount, householdId: fixtureHousehold,
    timezone: 'America/Chicago', today, from, to, fetchedAt: '2026-10-02T17:00:00.000Z', sourceUrl: 'https://davis-at-home.netlify.app',
    events: [
      { id: JSON.stringify(['davis-at-home', fixtureHousehold, 'events', 'fixture-weekly', '2026-10-02']), source: source('events', 'fixture-weekly', 3), series: { date: '2026-09-25', endDate: null, repeat: 'Weekly', weekdays: '', repeatUntil: '2026-12-31' }, title: 'Fixture weekly event', date: '2026-10-02', endDate: '2026-10-02', time: '16:30', person: 'Everyone', location: 'Fixture location', note: 'Synthetic demonstration data.', kind: 'event' },
      { id: JSON.stringify(['davis-at-home', fixtureHousehold, 'events', 'fixture-multiday', '2026-10-03']), source: source('events', 'fixture-multiday', 1), series: { date: '2026-10-03', endDate: '2026-10-05', repeat: 'Once', weekdays: '', repeatUntil: null }, title: 'Fixture multi-day event', date: '2026-10-03', endDate: '2026-10-05', time: null, person: 'Everyone', location: '', note: '', kind: 'event' },
    ],
    reminders: [{ id: JSON.stringify(['davis-at-home', fixtureHousehold, 'reminders', 'fixture-overdue']), source: source('reminders', 'fixture-overdue', 2), title: 'Fixture overdue reminder', date: '2026-10-01', person: 'Everyone' }],
  }
}
