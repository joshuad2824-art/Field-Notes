-- PREPARED ONLY: requires approval before applying live security policies.
-- Existing tables, credentials, policies and linked-assistant grants are untouched.
create table public.study_editions (
  vault text not null,
  id text not null check (id ~ '^[0-9a-f]{64}$'),
  sha256 text not null,
  title text not null check (length(title) between 1 and 240),
  filename text not null,
  source_base64 text not null,
  byte_length integer not null check (byte_length between 1 and 5000000),
  sections jsonb not null check (jsonb_typeof(sections)='array'),
  anchors jsonb not null check (jsonb_typeof(anchors)='object'),
  source_boundary integer not null default 0 check (source_boundary>=0),
  imported bigint not null,
  server_at timestamptz not null default clock_timestamp(),
  primary key(vault,id),
  check (id=sha256),
  check (octet_length(decode(source_base64,'base64'))=byte_length),
  check (encode(extensions.digest(decode(source_base64,'base64'),'sha256'),'hex')=sha256)
);
create table public.study_annotations (
  vault text not null,
  id text not null,
  edition text not null,
  section text not null,
  start_offset integer not null check(start_offset>=0),
  end_offset integer not null check(end_offset>start_offset and end_offset-start_offset<=10000),
  quote text not null check(length(quote)>0 and length(quote)<=10000),
  prefix text not null,
  suffix text not null,
  color text not null check(color in ('brass','forest','oxblood','navy')),
  created bigint not null,
  updated bigint not null check(updated>=created),
  deleted bigint,
  server_at timestamptz not null default clock_timestamp(),
  primary key(vault,id),
  foreign key(vault,edition) references public.study_editions(vault,id)
);
create table public.study_places (
  vault text not null,
  id text not null,
  section text not null,
  "offset" integer not null check("offset">=0),
  updated bigint not null,
  server_at timestamptz not null default clock_timestamp(),
  primary key(vault,id),
  foreign key(vault,id) references public.study_editions(vault,id)
);
alter table public.study_editions enable row level security;
alter table public.study_annotations enable row level security;
alter table public.study_places enable row level security;
revoke all on public.study_editions,public.study_annotations,public.study_places from public,anon,authenticated;
grant select,insert on public.study_editions to anon,authenticated;
grant select,insert,update on public.study_annotations,public.study_places to anon,authenticated;
create policy study_editions_read on public.study_editions for select to anon,authenticated using(vault=public.vault_of());
create policy study_editions_import on public.study_editions for insert to anon,authenticated with check(vault=public.vault_of());
create policy study_annotations_read on public.study_annotations for select to anon,authenticated using(vault=public.vault_of());
create policy study_annotations_add on public.study_annotations for insert to anon,authenticated with check(vault=public.vault_of());
create policy study_annotations_edit on public.study_annotations for update to anon,authenticated using(vault=public.vault_of()) with check(vault=public.vault_of());
create policy study_places_read on public.study_places for select to anon,authenticated using(vault=public.vault_of());
create policy study_places_add on public.study_places for insert to anon,authenticated with check(vault=public.vault_of());
create policy study_places_edit on public.study_places for update to anon,authenticated using(vault=public.vault_of()) with check(vault=public.vault_of());
-- Browser clients may add an edition but cannot UPDATE or DELETE its bytes.
-- Annotation anchors are immutable; removal is a synchronized tombstone.
create function public.study_annotation_guard() returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if (new.vault,new.id,new.edition,new.section,new.start_offset,new.end_offset,new.quote,new.prefix,new.suffix,new.created)
    is distinct from (old.vault,old.id,old.edition,old.section,old.start_offset,old.end_offset,old.quote,old.prefix,old.suffix,old.created) then
    raise exception 'A highlight anchor cannot be rewritten';
  end if;
  if new.updated<old.updated then return old; end if;
  if new.updated=old.updated and row(coalesce(new.deleted,0),new.color)<=row(coalesce(old.deleted,0),old.color) then return old; end if;
  new.server_at:=clock_timestamp();return new;
end $$;
create trigger study_annotation_guard before update on public.study_annotations for each row execute function public.study_annotation_guard();
create function public.study_place_guard() returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.updated<old.updated then return old; end if;
  if new.updated=old.updated and row(new.section collate "C",new."offset")<=row(old.section collate "C",old."offset") then return old; end if;
  new.server_at:=clock_timestamp();return new;
end $$;
create trigger study_place_guard before update on public.study_places for each row execute function public.study_place_guard();
-- No linked-account/assistant access policy, public bucket, security-definer
-- function, service-role key, or change to the existing vault boundary.
-- Reversal: stop the study client and retain these rows; do not DROP source data.
