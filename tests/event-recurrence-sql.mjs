import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const {PGlite}=await import(process.env.PGLITE_MODULE)
const db=new PGlite()
await db.exec(`create table events(id text primary key,date text,title text);alter table events enable row level security;insert into events values('legacy','2026-10-07','Existing event');`)
await db.exec(await readFile(new URL('../supabase/migrations/20261007194356_event_recurrence.sql',import.meta.url),'utf8'))
assert.equal((await db.query('select recurrence from events')).rows[0].recurrence,null)
assert.equal((await db.query("select relrowsecurity from pg_class where oid='events'::regclass")).rows[0].relrowsecurity,true)
for(const rule of [{frequency:'monthly',interval:1,monthWeek:2,weekday:0},{frequency:'weekly',interval:2,weekdays:[0,3]},{frequency:'daily',interval:99}])await db.query('update events set recurrence=$1',[rule])
for(const rule of [{},[],{frequency:null,interval:1},{frequency:'daily',interval:null},{frequency:'daily',interval:0},{frequency:'daily',interval:100},{frequency:'daily',interval:1.5},{frequency:'bad',interval:1}])await assert.rejects(db.query('update events set recurrence=$1',[rule]),/check constraint/)
console.log('PASS additive recurrence migration: valid JSON rules, invalid shapes refused, original row and RLS preserved')
await db.close()
