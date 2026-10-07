-- Add narrowly scoped linked-account access. Device pairing policies stay intact.
create policy images_linked_account_read on public.images for select to authenticated
  using (exists (select 1 from public.vault_links l where l.user_id = (select auth.uid()) and l.vault = images.vault));
create policy images_linked_account_create on public.images for insert to authenticated
  with check (exists (select 1 from public.vault_links l where l.user_id = (select auth.uid()) and l.vault = images.vault));
create policy events_linked_account_read on public.events for select to authenticated
  using (exists (select 1 from public.vault_links l where l.user_id = (select auth.uid()) and l.vault = events.vault));
create policy events_linked_account_create on public.events for insert to authenticated
  with check (exists (select 1 from public.vault_links l where l.user_id = (select auth.uid()) and l.vault = events.vault));
create policy events_linked_account_edit on public.events for update to authenticated
  using (exists (select 1 from public.vault_links l where l.user_id = (select auth.uid()) and l.vault = events.vault))
  with check (exists (select 1 from public.vault_links l where l.user_id = (select auth.uid()) and l.vault = events.vault));

-- Both bytes and reference commit together, as the caller, under existing RLS.
-- No SECURITY DEFINER, service-role credential, remote fetch, or new public bucket.
create or replace function public.assistant_attach_page_image(
  p_vault text, p_page text, p_expected_updated bigint, p_id text,
  p_mime text, p_ext text, p_bytes text, p_caption text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  current_page public.pages%rowtype;
  existing_image public.images%rowtype;
  next_updated bigint;
  reference text;
  decoded bytea;
begin
  if not exists (select 1 from public.vault_links l where l.user_id = (select auth.uid()) and l.vault = p_vault) then
    raise exception 'Link an archive first.';
  end if;
  if p_id is null or p_id !~ '^[0-9a-f]{32}$' or p_caption is null or length(btrim(p_caption)) not between 1 and 300 or p_caption ~ E'[\\[\\]\\r\\n]' then
    raise exception 'Invalid image ID or caption.';
  end if;
  if p_mime is null or p_ext is null or not ((p_mime = 'image/png' and p_ext = 'png') or (p_mime = 'image/jpeg' and p_ext = 'jpg') or (p_mime = 'image/webp' and p_ext = 'webp') or (p_mime = 'image/gif' and p_ext = 'gif')) then
    raise exception 'Unsupported image format.';
  end if;
  if p_bytes is null or length(p_bytes) not between 4 and 11184812 or p_bytes !~ '^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$' then raise exception 'Invalid image bytes.'; end if;
  decoded := decode(p_bytes, 'base64');
  if octet_length(decoded) > 8388608 or octet_length(decoded) = 0 then raise exception 'Image must be at most 8 MB.'; end if;
  if not (
    (p_mime = 'image/png' and substring(decoded from 1 for 8) = decode('89504e470d0a1a0a','hex')) or
    (p_mime = 'image/jpeg' and substring(decoded from 1 for 3) = decode('ffd8ff','hex')) or
    (p_mime = 'image/webp' and substring(decoded from 1 for 4) = decode('52494646','hex') and substring(decoded from 9 for 4) = decode('57454250','hex')) or
    (p_mime = 'image/gif' and substring(decoded from 1 for 6) in (decode('474946383761','hex'), decode('474946383961','hex')))
  ) then raise exception 'Image format does not match its bytes.'; end if;
  select * into current_page from public.pages where vault = p_vault and id = p_page and deleted is null for update;
  if not found or current_page.purpose is not null then raise exception 'Page is unavailable or managed.'; end if;
  reference := '![' || p_caption || '](images/' || p_id || '.' || p_ext || '){full}';
  select * into existing_image from public.images where vault = p_vault and id = p_id;
  if found then
    if existing_image.page = p_page and existing_image.bytes = p_bytes and existing_image.mime = p_mime and position(reference in current_page.body) > 0 then
      return jsonb_build_object('id', p_page, 'image_id', p_id, 'updated', current_page.updated, 'already_attached', true);
    end if;
    raise exception 'Request ID already used for different or removed content.';
  end if;
  if p_expected_updated is null or current_page.updated <> p_expected_updated then raise exception 'Page changed. Read it again before attaching.'; end if;
  if length(current_page.body) + length(reference) + 3 > 100000 then raise exception 'Page exceeds the supported length.'; end if;
  next_updated := greatest((extract(epoch from clock_timestamp()) * 1000)::bigint, current_page.updated + 1);
  insert into public.images(vault,id,page,mime,ext,cutout,added,bytes) values(p_vault,p_id,p_page,p_mime,p_ext,false,next_updated,p_bytes);
  update public.pages set body = current_page.body || E'\n\n' || reference || E'\n', updated = next_updated where vault = p_vault and id = p_page;
  return jsonb_build_object('id', p_page, 'image_id', p_id, 'updated', next_updated, 'already_attached', false);
end;
$$;
revoke all on function public.assistant_attach_page_image(text,text,bigint,text,text,text,text,text) from public, anon;
grant execute on function public.assistant_attach_page_image(text,text,bigint,text,text,text,text,text) to authenticated;
