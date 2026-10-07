-- Inclusive last day; NULL keeps existing single-day events unchanged.
alter table public.events add column end_date date;
alter table public.events add constraint events_date_range_check
  check (end_date is null or end_date >= date);
