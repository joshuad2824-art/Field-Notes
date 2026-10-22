create table public.study_reference_editions (
  vault text not null,
  id text not null check (id ~ '^[0-9a-f]{64}$'),
  document_key text not null check (document_key in ('bfm','mbc')),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  package_base64 text not null check (length(package_base64) between 1 and 5333336),
  byte_length integer not null check (byte_length between 1 and 4000000),
  created bigint not null check (created>=0),
  primary key(vault,id),
  check (octet_length(decode(package_base64,'base64'))=byte_length),
  check (encode(extensions.digest(decode(package_base64,'base64'),'sha256'),'hex')=id),
  check (coalesce(convert_from(decode(package_base64,'base64'),'UTF8')::jsonb->>'format'='field-notes-private-reference',false)),
  check (coalesce(convert_from(decode(package_base64,'base64'),'UTF8')::jsonb->>'version'='1',false)),
  check (coalesce(convert_from(decode(package_base64,'base64'),'UTF8')::jsonb->>'key'=document_key,false)),
  check (coalesce(convert_from(decode(package_base64,'base64'),'UTF8')::jsonb#>>'{source,sha256}'=source_sha256,false)),
  check (coalesce(octet_length(decode(convert_from(decode(package_base64,'base64'),'UTF8')::jsonb#>>'{source,base64}','base64'))=(convert_from(decode(package_base64,'base64'),'UTF8')::jsonb#>>'{source,bytes}')::integer,false)),
  check (coalesce(encode(extensions.digest(decode(convert_from(decode(package_base64,'base64'),'UTF8')::jsonb#>>'{source,base64}','base64'),'sha256'),'hex')=source_sha256,false))
);
alter table public.study_reference_editions enable row level security;
revoke all on public.study_reference_editions from public,anon,authenticated;
grant select,insert on public.study_reference_editions to anon,authenticated;
create policy study_reference_editions_read on public.study_reference_editions
  for select to anon,authenticated using(vault=public.vault_of());
create policy study_reference_editions_import on public.study_reference_editions
  for insert to anon,authenticated with check(vault=public.vault_of());
