import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const modulePath=process.env.PGLITE_MODULE||'@electric-sql/pglite'
const {PGlite}=await import(modulePath)
const db=new PGlite()
const hash=value=>createHash('sha256').update(value).digest('hex')
const owner='A'.repeat(43),other='B'.repeat(43),token='c'.repeat(64),next='d'.repeat(64)
const snapshot={version:1,from:'2026-11-01',to:'2026-11-30',timezone:'America/Chicago',written:['2026-11-03'],events:['2026-11-04'],sources:{davis:'ready',apple:'setup',work:'ready'}}
const headers=key=>db.query("select set_config('request.headers',$1,false)",[JSON.stringify(key?{'x-vault-key':key}:{})])
const publish=(key=hash(token),data=snapshot,create=true)=>db.query('select widget_publish($1,$2::jsonb,$3)',[key,JSON.stringify(data),create])
const read=async t=>(await db.query('select widget_read($1) as value',[t])).rows[0].value
try {
 await db.exec(`create role anon;create role authenticated;create schema extensions;create function extensions.digest(value text,algorithm text) returns bytea language sql immutable as $$select sha256(convert_to(value,'UTF8'))$$;
 create function public.vault_of() returns text language sql stable as $$select encode(extensions.digest(coalesce(current_setting('request.headers',true)::json->>'x-vault-key',''),'sha256'),'hex')$$;
 create table public.pages(vault text,body text);insert into pages values('sentinel','untouched');`)
 await db.exec('alter default privileges in schema public grant execute on functions to authenticated')
 await db.exec(await readFile(new URL('../supabase/migrations/20261103172316_scriptable_calendar.sql',import.meta.url),'utf8'))
 await db.exec(await readFile(new URL('../supabase/migrations/20261103172425_widget_function_privileges.sql',import.meta.url),'utf8'))
 await db.exec('set role anon'); await headers(null)
 await assert.rejects(publish(),/Invalid widget request/)
 assert.equal(await read(token),null)
 await assert.rejects(db.exec('select * from widget_calendars'),/permission denied/)
 await headers(owner);await publish()
 const own=await read(token);assert.deepEqual(own.snapshot,snapshot);assert.deepEqual(Object.keys(own).sort(),['expiresAt','snapshot','updatedAt'])
 assert.equal(JSON.stringify(own).includes(hash(owner)),false)
 await headers(other);await assert.rejects(publish(hash(token),snapshot,false),/Reconnect/)
 await db.exec('select widget_revoke()');assert.ok(await read(token),'other vault cannot revoke owner')
 await headers(null);await assert.rejects(publish(),/Invalid widget request/)
 await assert.rejects(db.exec('select widget_revoke()'),/Invalid widget request/)
 assert.equal(await read('e'.repeat(64)),null)
 await headers(owner)
 for(const bad of [{...snapshot,title:'private'},{...snapshot,sources:{...snapshot.sources,eventTitle:'private'}},{...snapshot,written:['private']},{...snapshot,written:['2026-02-30']},{...snapshot,to:'2029-01-01'},{...snapshot,written:['2027-01-01']},{...snapshot,events:null},{...snapshot,sources:{davis:'ready'}},{...snapshot,version:null},{...snapshot,timezone:'PrivateEventTitle'}]) await assert.rejects(publish(hash(token),bad))
 await publish(hash(next));assert.equal(await read(token),null,'rotation invalidates old read key');assert.ok(await read(next))
 await assert.rejects(publish(hash(token),snapshot,false),/Reconnect/)
 await db.exec('select widget_revoke()');assert.equal(await read(next),null)
 await assert.rejects(publish(hash(next),snapshot,false),/Reconnect/,'background refresh cannot recreate revoked access')
 await publish(hash(next));await db.exec('reset role');await db.exec("update widget_calendars set expires_at=clock_timestamp()-interval '1 second'");await db.exec('set role anon');assert.equal(await read(next),null,'expiry enforced server side');await assert.rejects(publish(hash(next),snapshot,false),/Reconnect/)
 await db.exec('reset role');assert.deepEqual((await db.query('select * from pages')).rows,[{vault:'sentinel',body:'untouched'}])
 await db.exec('set role authenticated');await assert.rejects(db.exec('select * from widget_calendars'),/permission denied/);await assert.rejects(read(next),/permission denied/)
 console.log('PASS widget SQL: absent/incorrect/read-token write denials; cross-vault isolation; strict date-only payload; no table access; rotation, revocation, expiry; no background re-creation; existing records preserved. Synthetic in-memory Postgres only.')
} finally { await db.close() }
