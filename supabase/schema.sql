-- Field Notes — the sync mirror.
--
-- Run this once, whole, in the Supabase SQL editor of a fresh project. Then
-- paste the project URL and the anon key into Settings → Sync on the first
-- device. Every other device gets a pairing code from that one and never sees
-- this file.
--
-- There is no auth here, deliberately. There is no accounts table, no email,
-- no session and nothing that can expire — that is the whole point, and it is
-- the thing that killed Moleskine. A vault is identified by the SHA-256 of a
-- 256-bit key the first device generated and never sent anywhere but in the
-- header of its own requests. The server stores the hash implicitly, as the
-- `vault` column on every row, and compares it against the hash of whatever
-- key the request presented. A request with no key hashes to something no row
-- will ever carry, so it sees an empty database.
--
-- The anon key below is public and is meant to be. It gets a caller as far as
-- the door; the vault key is what opens it.

create extension if not exists pgcrypto with schema extensions;

-- The vault this request is allowed to see. A pure function of the caller's
-- own header, so it can leak nothing it wasn't given.
create or replace function public.vault_of() returns text
language sql stable as $$
  select encode(
    extensions.digest(
      coalesce(current_setting('request.headers', true)::json ->> 'x-vault-key', ''),
      'sha256'
    ),
    'hex'
  )
$$;

-- Every row is stamped on the way in, and the cursor a device pulls against is
-- this column and not any clock the device owns. clock_timestamp() rather than
-- now(): now() is the transaction's time, so a first sync pushing four hundred
-- pages in one request would give all four hundred the same stamp and a cursor
-- would have nothing to advance past.
create or replace function public.stamp_server_at() returns trigger
language plpgsql as $$
begin
  new.server_at := clock_timestamp();
  return new;
end
$$;

-- ── pages ──────────────────────────────────────────────────────────────
-- The envelope the app already has, with the one column the app doesn't.
-- `deleted` is a tombstone here as it is on the device, and it is never
-- cleared: a device purges its own copy after thirty days, the mirror keeps
-- the marker, and so a page deleted on one device cannot walk back in from
-- another that was switched off for a month.

create table if not exists public.pages (
  vault      text        not null,
  id         text        not null,
  notebook   text        not null,
  body       text        not null default '',
  created    bigint      not null,
  updated    bigint      not null,
  pinned     smallint    not null default 0,
  entry_date text,
  pen        text,
  stock      text,
  deleted    bigint,
  server_at  timestamptz not null default clock_timestamp(),
  primary key (vault, id)
);

create index if not exists pages_cursor on public.pages (vault, server_at);

-- ── notebooks ──────────────────────────────────────────────────────────
-- `ord` rather than `order`, which is a reserved word and would need quoting
-- at every call site.

create table if not exists public.notebooks (
  vault     text        not null,
  id        text        not null,
  name      text        not null,
  color     text        not null,
  ord       int         not null default 0,
  updated   bigint      not null,
  deleted   bigint,
  server_at timestamptz not null default clock_timestamp(),
  primary key (vault, id)
);

create index if not exists notebooks_cursor on public.notebooks (vault, server_at);

-- ── pictures ───────────────────────────────────────────────────────────
-- The bytes ride as base64 in the same table rather than in a storage bucket,
-- for one reason: the vault key is checked by a row policy, and a bucket is a
-- second service with a second way of asking that question. One transport, one
-- policy, one thing to get right.
--
-- A picture is never edited, only added and later unreferenced, so there is no
-- last-write-wins here. A device pulls the bytes for a picture its own pages
-- actually mention and ignores the rest, which means an image pruned out of a
-- page on one device is simply never fetched again on another.

create table if not exists public.images (
  vault     text        not null,
  id        text        not null,
  page      text        not null,
  mime      text        not null,
  ext       text        not null,
  cutout    boolean     not null default false,
  added     bigint      not null,
  bytes     text        not null,
  server_at timestamptz not null default clock_timestamp(),
  primary key (vault, id)
);

create index if not exists images_cursor on public.images (vault, server_at);

-- ── stamps ─────────────────────────────────────────────────────────────

drop trigger if exists pages_stamp on public.pages;
create trigger pages_stamp before insert or update on public.pages
  for each row execute function public.stamp_server_at();

drop trigger if exists notebooks_stamp on public.notebooks;
create trigger notebooks_stamp before insert or update on public.notebooks
  for each row execute function public.stamp_server_at();

drop trigger if exists images_stamp on public.images;
create trigger images_stamp before insert or update on public.images
  for each row execute function public.stamp_server_at();

-- ── the one policy, three times ────────────────────────────────────────

alter table public.pages enable row level security;
alter table public.notebooks enable row level security;
alter table public.images enable row level security;

drop policy if exists pages_vault on public.pages;
create policy pages_vault on public.pages for all to anon, authenticated
  using (vault = public.vault_of())
  with check (vault = public.vault_of());

drop policy if exists notebooks_vault on public.notebooks;
create policy notebooks_vault on public.notebooks for all to anon, authenticated
  using (vault = public.vault_of())
  with check (vault = public.vault_of());

drop policy if exists images_vault on public.images;
create policy images_vault on public.images for all to anon, authenticated
  using (vault = public.vault_of())
  with check (vault = public.vault_of());

grant usage on schema extensions to anon, authenticated;
grant execute on function public.vault_of() to anon, authenticated;
grant select, insert, update, delete on public.pages to anon, authenticated;
grant select, insert, update, delete on public.notebooks to anon, authenticated;
grant select, insert, update, delete on public.images to anon, authenticated;
