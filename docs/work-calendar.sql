-- Applied through Supabase migration work_calendar_snapshots, October 13, 2026.
create table public.work_calendar_snapshots (
  vault text primary key,
  source_calendar text not null check (source_calendar = 'joshua.davis5@ascension.org'),
  fetched_at timestamptz not null,
  from_date date not null,
  to_date date not null,
  timezone text not null check (timezone = 'America/Chicago'),
  events jsonb not null check (jsonb_typeof(events) = 'array' and jsonb_array_length(events) <= 3000),
  check (to_date >= from_date and to_date - from_date <= 366)
);
alter table public.work_calendar_snapshots enable row level security;
revoke all on public.work_calendar_snapshots from anon, authenticated;
grant select on public.work_calendar_snapshots to anon, authenticated;
create policy work_calendar_vault_read on public.work_calendar_snapshots
  for select to anon, authenticated using (vault = public.vault_of());
create policy work_calendar_linked_read on public.work_calendar_snapshots
  for select to authenticated using (exists (
    select 1 from public.vault_links l
    where l.user_id = (select auth.uid()) and l.vault = work_calendar_snapshots.vault
  ));
-- Trusted scheduled administration replaces the whole snapshot after a complete
-- Google read. Browser roles cannot insert/update/delete snapshots.
