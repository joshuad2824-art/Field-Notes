-- A signed-in account may be linked to one existing Field Notes vault.
-- The link is created only from a paired device that proves possession of
-- the vault key. The MCP server then uses the caller's Auth token and RLS;
-- it never needs the vault key or a service-role credential.

create table if not exists public.vault_links (
  user_id uuid primary key references auth.users (id) on delete cascade,
  vault text not null check (vault ~ '^[0-9a-f]{64}$'),
  linked_at timestamptz not null default now()
);

create index if not exists vault_links_vault_idx on public.vault_links (vault);
alter table public.vault_links enable row level security;

create policy vault_links_read on public.vault_links
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy vault_links_pair on public.vault_links
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and vault = public.vault_of()
  );

create policy vault_links_unpair on public.vault_links
  for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, delete on public.vault_links to authenticated;

create policy pages_linked_account_read on public.pages
  for select to authenticated
  using (
    exists (
      select 1 from public.vault_links l
      where l.user_id = (select auth.uid()) and l.vault = pages.vault
    )
  );

create policy pages_linked_account_create on public.pages
  for insert to authenticated
  with check (
    exists (
      select 1 from public.vault_links l
      where l.user_id = (select auth.uid()) and l.vault = pages.vault
    )
  );

create policy pages_linked_account_edit on public.pages
  for update to authenticated
  using (
    exists (
      select 1 from public.vault_links l
      where l.user_id = (select auth.uid()) and l.vault = pages.vault
    )
  )
  with check (
    exists (
      select 1 from public.vault_links l
      where l.user_id = (select auth.uid()) and l.vault = pages.vault
    )
  );

create policy notebooks_linked_account on public.notebooks
  for select to authenticated
  using (
    exists (
      select 1 from public.vault_links l
      where l.user_id = (select auth.uid()) and l.vault = notebooks.vault
    )
  );
