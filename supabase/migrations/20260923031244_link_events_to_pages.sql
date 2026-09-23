-- Events can point to an existing page without taking ownership of it. A page
-- may sync after its event, so no foreign key is imposed across the mirror.
alter table public.events add column if not exists page_id text;

-- The app records which of Joshua's two Apple calendars an exported event is
-- intended for. Import still asks him to choose that calendar in Apple Calendar.
alter table public.events add column if not exists calendar_target text;

create index if not exists events_page on public.events (vault, page_id)
  where page_id is not null and deleted is null;
