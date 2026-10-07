// Run with PGLITE_MODULE pointing to an installed @electric-sql/pglite entrypoint.
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const db = new PGlite()
await db.exec(`create role anon; create role authenticated;
create schema auth; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
create table vault_links(user_id uuid primary key, vault text); alter table vault_links enable row level security;
create policy own_link on vault_links for select to authenticated using(user_id=auth.uid()); grant select on vault_links to authenticated;
create table pages(vault text, id text, body text, updated bigint, purpose text, deleted bigint, primary key(vault,id)); alter table pages enable row level security;
create policy own_page on pages for all to authenticated using(exists(select 1 from vault_links l where l.user_id=auth.uid() and l.vault=pages.vault)) with check(exists(select 1 from vault_links l where l.user_id=auth.uid() and l.vault=pages.vault));
grant select,insert,update on pages to authenticated;
create table images(vault text,id text,page text,mime text,ext text,cutout boolean,added bigint,bytes text, primary key(vault,id)); alter table images enable row level security; grant select,insert on images to authenticated;
create table events(vault text,id text,title text,primary key(vault,id)); alter table events enable row level security; grant select,insert,update on events to authenticated;
insert into vault_links values('11111111-1111-4111-8111-111111111111','one'),('22222222-2222-4222-8222-222222222222','two');
insert into pages values('one','p','# Plan',1,null,null),('two','q','# Private',1,null,null),('one','managed','# Reminders',1,'reminders',null);
`)
await db.exec(await readFile(new URL('../supabase/migrations/20261007163146_workshop_images_calendar.sql', import.meta.url),'utf8'))
await db.exec(`set role authenticated; set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';`)
const bytes='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='
const args=['one','p',1,'a'.repeat(32),'image/png','png',bytes,'Sample']
const attach=(a=args)=>db.query('select public.assistant_attach_page_image($1,$2,$3,$4,$5,$6,$7,$8) as result',a)
const result=(await attach()).rows[0].result
assert.equal(result.already_attached,false)
assert.equal((await attach()).rows[0].result.already_attached,true)
assert.equal((await db.query('select * from images')).rows.length,1)
assert.equal((await db.query('select body from pages where id=\'p\'')).rows[0].body.split('![Sample]').length,2)
await assert.rejects(attach(['one','p',1,'b'.repeat(32),'image/png','png',bytes,'Stale']),/Page changed/)
assert.equal((await db.query('select * from images')).rows.length,1,'stale write left no orphan')
await assert.rejects(attach(['two','q',1,'c'.repeat(32),'image/png','png',bytes,'Other']),/Link an archive/)
await assert.rejects(attach(['one','managed',1,'d'.repeat(32),'image/png','png',bytes,'Other']),/managed/)
await assert.rejects(attach([...args.slice(0,7),'different']),/Request ID already used/)
await assert.rejects(attach(['one','p',result.updated,'e'.repeat(32),'image/jpeg','jpg',bytes,'Bad format']),/format does not match/)
await assert.rejects(attach(['one','p',result.updated,'e'.repeat(32),'image/png','png',bytes,'Bad\ncaption']),/caption/)
await db.query(`insert into events values('one','event','Mine')`)
await assert.rejects(db.query(`insert into events values('two','event','Other')`),/row-level security/)
await db.query(`update events set title='Edited' where id='event'`)
assert.equal((await db.query('select title from events')).rows[0].title,'Edited')
await db.exec(`reset role; set role anon;`)
await assert.rejects(attach(),/permission denied/)
await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';`)
assert.equal((await db.query('select * from images')).rows.length,0)
assert.equal((await db.query('select * from events')).rows.length,0)
console.log('PASS SQL: atomic attachment, identical retry, stale rollback, caption/MIME validation, managed-page refusal, cross-vault and anonymous denial, native event RLS')
await db.close()
