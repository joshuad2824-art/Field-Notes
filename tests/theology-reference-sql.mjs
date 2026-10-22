import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite')
const {pgcrypto}=await import(process.env.PGLITE_CRYPTO||'@electric-sql/pglite/contrib/pgcrypto')
const db=new PGlite({extensions:{pgcrypto}}),hash=value=>createHash('sha256').update(value).digest('hex')
const source=Buffer.from('Synthetic original café source.'),document={format:'field-notes-private-reference',version:1,key:'bfm',source:{sha256:hash(source),bytes:source.length,base64:source.toString('base64')},blocks:[],assets:{}},packet=Buffer.from(JSON.stringify(document))
try{
 await db.exec(`create role anon;create role authenticated;create schema extensions;create extension pgcrypto with schema extensions;
 create function public.vault_of() returns text language sql stable as $$ select nullif(current_setting('fixture.vault',true),'') $$;`)
 await db.exec(await readFile(new URL('./fixtures/theology-reference-schema.sql',import.meta.url),'utf8'))
 const put=(vault,{id=hash(packet),key='bfm',sha=hash(source),bytes=packet.length,body=packet,created=1,ignore=false}={})=>db.query(`insert into study_reference_editions(vault,id,document_key,source_sha256,package_base64,byte_length,created) values($1,$2,$3,$4,$5,$6,$7)${ignore?' on conflict(vault,id) do nothing':''}`,[vault,id,key,sha,body.toString('base64'),bytes,created])
 await db.exec(`set role anon;set fixture.vault='one';`);await put('one');assert.equal((await db.query('select * from study_reference_editions')).rows.length,1)
 await put('one',{created:9,ignore:true});assert.equal(Number((await db.query('select created from study_reference_editions')).rows[0].created),1,'idempotent import does not rewrite the immutable record')
 await assert.rejects(put('two'),/row-level security/)
 await assert.rejects(put('one',{id:'0'.repeat(64)}),/check constraint/)
 await assert.rejects(put('one',{bytes:packet.length+1}),/check constraint/)
 await assert.rejects(put('one',{key:'mbc'}),/check constraint/)
 await assert.rejects(put('one',{sha:'0'.repeat(64)}),/check constraint/)
 await assert.rejects(put('one',{bytes:4000001}),/check constraint/)
 const wrongSource=Buffer.from(JSON.stringify({...document,source:{...document.source,base64:Buffer.from('Changed synthetic source').toString('base64')}}))
 await assert.rejects(put('one',{id:hash(wrongSource),body:wrongSource,bytes:wrongSource.length}),/check constraint/)
 await assert.rejects(db.exec('update study_reference_editions set created=2'),/permission denied/);await assert.rejects(db.exec('delete from study_reference_editions'),/permission denied/)
 await db.exec(`set fixture.vault='two';`);assert.equal((await db.query('select * from study_reference_editions')).rows.length,0);await put('two');assert.equal((await db.query('select * from study_reference_editions')).rows.length,1)
 await db.exec(`set fixture.vault='';`);assert.equal((await db.query('select * from study_reference_editions')).rows.length,0);await assert.rejects(put('one'),/row-level security/)
 await db.exec(`reset role;set role authenticated;set fixture.vault='';`);assert.equal((await db.query('select * from study_reference_editions')).rows.length,0)
 await db.exec(`set fixture.vault='one';`);assert.equal((await db.query('select * from study_reference_editions')).rows.length,1);await assert.rejects(db.exec('update study_reference_editions set created=2'),/permission denied/)
 console.log('PASS proposed reference SQL contract: own-vault immutable/idempotent import; absent/cross-vault denial; real package/source digest, size and identity checks; no update/delete; isolated synthetic database only')
}finally{await db.close()}
