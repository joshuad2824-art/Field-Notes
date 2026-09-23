-- One pinned Reminders page per notebook. The page is a view of reminder rows;
-- completion lives on the row, so the dashboard and page use the same state.
alter table public.pages add column if not exists purpose text;
alter table public.pages drop constraint if exists pages_purpose_check;
alter table public.pages add constraint pages_purpose_check
  check (purpose is null or purpose = 'reminders');
create unique index if not exists pages_one_reminders_page_per_notebook
  on public.pages (vault, notebook)
  where purpose = 'reminders' and deleted is null;

alter table public.siena_items add column if not exists notebook text;
alter table public.siena_items add column if not exists completed_at bigint;
create index if not exists siena_items_notebook_reminders
  on public.siena_items (vault, notebook, due_at)
  where kind = 'reminder' and completed_at is null;

-- Assistant publication may create a reminder, but completion is a user action.
drop policy if exists siena_items_linked_create on public.siena_items;
create policy siena_items_linked_create on public.siena_items for insert to authenticated
  with check (seen_at is null and completed_at is null and exists (
    select 1 from public.vault_links l
    where l.user_id = (select auth.uid()) and l.vault = siena_items.vault
  ));
