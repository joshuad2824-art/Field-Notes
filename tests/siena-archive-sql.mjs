import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite')
const db=new PGlite()
try {
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create function public.vault_of() returns text language sql stable as $$ select nullif(current_setting('fixture.vault',true),'') $$;
 create function public.stamp_server_at() returns trigger language plpgsql as $$ begin new.server_at=clock_timestamp();return new;end $$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create table vault_links(user_id uuid primary key,vault text);alter table vault_links enable row level security;
 create policy own_link on vault_links for select to authenticated using(user_id=auth.uid());grant select on vault_links to authenticated;
 create table pages(vault text,id text,notebook text,deleted bigint,body text,primary key(vault,id));
 insert into vault_links values('11111111-1111-4111-8111-111111111111','one');`)
 for(const name of ['20260922231119_add_events_siena_inbox.sql','20260923125511_reminder_pages.sql']) await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'))
 await db.exec(`insert into siena_items(vault,id,kind,body,created,updated) values('one','old','note','Original writing',1,1),('two','other','note','Other archive',1,1);`)
 const migration=await readFile(new URL('../supabase/migrations/20261020185836_siena_archive_state.sql',import.meta.url),'utf8')
 await db.exec(migration)
 await db.exec(migration)
 assert.deepEqual((await db.query(`select body,requires_action,resolved_at,retained_at,state_at from siena_items where id='old'`)).rows,[{body:'Original writing',requires_action:null,resolved_at:null,retained_at:null,state_at:null}])
 await db.exec(`set role authenticated;set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';`)
 await db.exec(`insert into siena_items(vault,id,kind,body,created,updated,requires_action) values('one','info','note','Information only',2,2,false);`)
 await assert.rejects(db.exec(`insert into siena_items(vault,id,kind,body,created,updated,resolved_at) values('one','bad','note','Cannot resolve for user',2,2,3);`),/row-level security/)
 await assert.rejects(db.exec(`insert into siena_items(vault,id,kind,body,created,updated,retained_at) values('one','bad2','note','Cannot restore for user',2,2,3);`),/row-level security/)
 await assert.rejects(db.exec(`insert into siena_items(vault,id,kind,body,created,updated,state_at) values('one','bad3','note','Cannot stamp user state',2,2,3);`),/row-level security/)
 assert.equal((await db.query('select * from siena_items')).rows.length,2)
 await db.exec(`reset role;set role anon;set fixture.vault='one';update siena_items set resolved_at=5,retained_at=6 where id='old';`)
 assert.equal((await db.query(`select resolved_at from siena_items where id='old'`)).rows[0].resolved_at,5)
 assert.equal((await db.query(`select * from siena_items where vault='two'`)).rows.length,0)
 await assert.rejects(db.exec(`insert into siena_items(vault,id,kind,body,created,updated) values('two','no','note','Wrong vault',1,1);`),/row-level security/)
 console.log('PASS additive/repeatable migration, text retained, unknown state retained, linked publication, user-only disposition, device updates, cross-vault isolation')
} finally {await db.close()}
