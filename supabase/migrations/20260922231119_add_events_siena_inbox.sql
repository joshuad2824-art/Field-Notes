-- Apply after schema.sql and assistant-access.sql. Local pages remain untouched.
-- Events are device-authored; Siena items may also be created by the linked
-- OAuth user through the narrow MCP function. Seen state is device-authored.

create table if not exists public.events (
  vault text not null,
  id text not null,
  title text not null check (length(btrim(title)) between 1 and 240),
  date date not null,
  start_time text check (start_time is null or start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text check (end_time is null or end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  location text check (location is null or length(location) <= 500),
  note text check (note is null or length(note) <= 10000),
  created bigint not null,
  updated bigint not null,
  deleted bigint,
  conflict_of text,
  server_at timestamptz not null default clock_timestamp(),
  primary key (vault, id)
);

create index if not exists events_cursor on public.events (vault, server_at);
create index if not exists events_day on public.events (vault, date) where deleted is null;

drop trigger if exists events_stamp on public.events;
create trigger events_stamp before insert or update on public.events
  for each row execute function public.stamp_server_at();

alter table public.events enable row level security;
drop policy if exists events_vault on public.events;
create policy events_vault on public.events for all to anon, authenticated
  using (vault = public.vault_of())
  with check (vault = public.vault_of());

grant select, insert, update on public.events to anon, authenticated;

create table if not exists public.siena_items (
  vault text not null,
  id text not null,
  kind text not null check (kind in ('note', 'reminder', 'task_update', 'saved')),
  title text check (title is null or length(title) <= 240),
  body text not null check (length(btrim(body)) between 1 and 100000),
  source_url text check (source_url is null or length(source_url) <= 2000),
  source_key text check (source_key is null or length(source_key) <= 200),
  due_at bigint,
  seen_at bigint,
  created bigint not null,
  updated bigint not null,
  server_at timestamptz not null default clock_timestamp(),
  primary key (vault, id),
  constraint reminder_has_due_time check (kind <> 'reminder' or due_at is not null)
);

create index if not exists siena_items_cursor on public.siena_items (vault, server_at);
create index if not exists siena_items_created on public.siena_items (vault, created desc);
create unique index if not exists siena_items_source_key on public.siena_items (vault, source_key) where source_key is not null;

drop trigger if exists siena_items_stamp on public.siena_items;
create trigger siena_items_stamp before insert or update on public.siena_items
  for each row execute function public.stamp_server_at();

alter table public.siena_items enable row level security;
drop policy if exists siena_items_vault on public.siena_items;
create policy siena_items_vault on public.siena_items for all to anon, authenticated
  using (vault = public.vault_of())
  with check (vault = public.vault_of());

-- A linked account can publish and inspect its own inbox, but cannot mark
-- messages seen. The latter is an explicit action inside Field Notes.
drop policy if exists siena_items_linked_read on public.siena_items;
create policy siena_items_linked_read on public.siena_items for select to authenticated
  using (exists (
    select 1 from public.vault_links l
    where l.user_id = (select auth.uid()) and l.vault = siena_items.vault
  ));

drop policy if exists siena_items_linked_create on public.siena_items;
create policy siena_items_linked_create on public.siena_items for insert to authenticated
  with check (seen_at is null and exists (
    select 1 from public.vault_links l
    where l.user_id = (select auth.uid()) and l.vault = siena_items.vault
  ));

grant select, insert, update on public.siena_items to anon, authenticated;
