-- Additive disposition metadata; existing message text and access policies stay intact.
-- Unknown action status is intentionally NULL: legacy messages require explicit resolution.
alter table public.siena_items add column if not exists requires_action boolean;
alter table public.siena_items add column if not exists resolved_at bigint;
alter table public.siena_items add column if not exists retained_at bigint;
alter table public.siena_items add column if not exists state_at bigint;

-- Linked assistants may describe action status, but resolution and restoration
-- remain user actions through the existing vault-scoped device policy.
drop policy if exists siena_items_linked_create on public.siena_items;
create policy siena_items_linked_create on public.siena_items for insert to authenticated
  with check (seen_at is null and completed_at is null and resolved_at is null and retained_at is null and state_at is null and exists (
    select 1 from public.vault_links l
    where l.user_id = (select auth.uid()) and l.vault = siena_items.vault
  ));
