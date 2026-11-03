-- Proposed only. No existing archive tables, policies or records change.
-- A date-only snapshot, not delegated access to the vault. No plaintext token
-- is stored server-side. Only the three RPCs below can access this table.
create table public.widget_calendars (
  vault text primary key check (vault ~ '^[a-f0-9]{64}$'),
  read_hash text not null unique check (read_hash ~ '^[a-f0-9]{64}$'),
  snapshot jsonb not null,
  updated_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp() + interval '90 days')
);
alter table public.widget_calendars enable row level security;
revoke all on public.widget_calendars from public, anon, authenticated;

create function public.widget_publish(p_hash text, p_snapshot jsonb, p_create boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare
  owner_vault text := public.vault_of();
  header_key text := coalesce(current_setting('request.headers', true)::json ->> 'x-vault-key', '');
  item jsonb;
  label text;
  begin_date date;
  end_date date;
begin
  if header_key !~ '^[A-Za-z0-9_-]{43}$' or p_hash is null or p_hash !~ '^[a-f0-9]{64}$'
    or p_create is null then raise exception 'Invalid widget request.'; end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' or octet_length(p_snapshot::text) > 20000
    or (p_snapshot - array['version','from','to','timezone','written','events','sources']) <> '{}'::jsonb
    or not (p_snapshot ?& array['version','from','to','timezone','written','events','sources'])
    or p_snapshot->'version' <> '1'::jsonb
    or jsonb_typeof(p_snapshot->'from') <> 'string' or jsonb_typeof(p_snapshot->'to') <> 'string'
    or jsonb_typeof(p_snapshot->'timezone') <> 'string'
    or (p_snapshot->>'timezone') !~ '^[A-Za-z0-9_+/-]{1,80}$'
    or (p_snapshot->>'from') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or (p_snapshot->>'to') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    then raise exception 'Invalid widget snapshot.'; end if;
  begin_date := (p_snapshot->>'from')::date;
  end_date := (p_snapshot->>'to')::date;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_snapshot->>'timezone') then
    raise exception 'Invalid widget timezone.';
  end if;
  if end_date < begin_date or end_date - begin_date > 399 then raise exception 'Invalid widget window.'; end if;
  foreach label in array array['written','events'] loop
    if jsonb_typeof(p_snapshot->label) <> 'array' then raise exception 'Invalid widget dates.'; end if;
    if jsonb_array_length(p_snapshot->label) > 400 then raise exception 'Invalid widget dates.'; end if;
    for item in select value from jsonb_array_elements(p_snapshot->label) loop
      if jsonb_typeof(item) <> 'string' or (item #>> '{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        then raise exception 'Invalid widget date.'; end if;
      if (item #>> '{}')::date not between begin_date and end_date then raise exception 'Invalid widget date.'; end if;
    end loop;
  end loop;
  if jsonb_typeof(p_snapshot->'sources') <> 'object'
    or ((p_snapshot->'sources') - array['davis','apple','work']) <> '{}'::jsonb
    or not (p_snapshot->'sources' ?& array['davis','apple','work']) then raise exception 'Invalid widget sources.'; end if;
  foreach label in array array['davis','apple','work'] loop
    if jsonb_typeof(p_snapshot->'sources'->label) <> 'string'
      or (p_snapshot->'sources'->>label) not in ('ready','setup','disconnected','loading','denied','stale','offline','unavailable','error')
      then raise exception 'Invalid widget source.'; end if;
  end loop;
  if p_create then
    insert into public.widget_calendars(vault,read_hash,snapshot) values(owner_vault,p_hash,p_snapshot)
    on conflict(vault) do update set read_hash = excluded.read_hash, snapshot = excluded.snapshot,
      updated_at = clock_timestamp(), expires_at = case
        when widget_calendars.read_hash = excluded.read_hash and widget_calendars.expires_at > clock_timestamp()
        then widget_calendars.expires_at else clock_timestamp() + interval '90 days' end;
  else
    -- An old device/in-flight refresh cannot rotate or resurrect revoked keys.
    update public.widget_calendars set snapshot = p_snapshot, updated_at = clock_timestamp()
      where vault = owner_vault and read_hash = p_hash and expires_at > clock_timestamp();
    if not found then raise exception 'Reconnect the calendar widget.'; end if;
  end if;
end;
$$;

create function public.widget_read(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return null; end if;
  select jsonb_build_object('snapshot', snapshot, 'updatedAt', updated_at, 'expiresAt', expires_at)
    into result from public.widget_calendars
    where read_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and expires_at > clock_timestamp();
  return result;
end;
$$;

create function public.widget_revoke() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('request.headers', true)::json ->> 'x-vault-key','') !~ '^[A-Za-z0-9_-]{43}$'
    then raise exception 'Invalid widget request.'; end if;
  delete from public.widget_calendars where vault = public.vault_of();
end;
$$;
revoke all on function public.widget_publish(text,jsonb,boolean), public.widget_read(text), public.widget_revoke() from public;
grant execute on function public.widget_publish(text,jsonb,boolean), public.widget_read(text), public.widget_revoke() to anon;
