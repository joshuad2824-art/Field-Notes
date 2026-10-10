import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
// Exercise the actual registered publication handler against a scoped fake store.
// No network, vault key, real archive, or live write is involved.
const source = fs.readFileSync(new URL('../supabase/functions/field-notes-mcp/index.ts',import.meta.url),'utf8')
const tree = ts.createSourceFile('index.ts',source,ts.ScriptTarget.Latest,true)
let body=source
for(const node of [...tree.statements].reverse()) if(ts.isImportDeclaration(node)) body=body.slice(0,node.pos)+body.slice(node.end)
const js=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
const handlers=new Map(), records=[],queries=[]
let app, existing=null, bookExists=true
const chain=new Proxy(()=>{}, {get:()=>chain,apply:()=>chain})
const z=chain
const supabase={from(table){
 const state={table,filters:[],insert:null};queries.push(state)
 const query={select(){return query},eq(key,value){state.filters.push([key,value]);return query},is(key,value){state.filters.push([key,value]);return query},insert(value){state.insert=value;return query},
  async maybeSingle(){
   if(table==='vault_links')return {data:{vault:'fixture-vault'}}
   if(table==='notebooks')return {data:bookExists?{id:'fixture-work'}:null}
   if(table==='siena_items')return {data:existing}
   if(table==='pages')return {data:{id:'fixture-reminders'}}
   throw Error(table)
  },async single(){assert.ok(state.insert);records.push(state.insert);return {data:state.insert}}
 };return query
}}
const deps={Deno:{serve(fn){app=fn}},z,createMcpHandler(factory){factory();return {fetch(){return new Response('ok')}}},McpServer:class {registerTool(name,_meta,fn){handlers.set(name,fn)}},withSupabase(_opts,fn){return req=>fn(req,{supabase})},withOAuthProtectedResource:fn=>fn}
new Function(...Object.keys(deps),js)(...Object.values(deps))
await app(new Request('https://example.invalid/mcp'))
const publish=handlers.get('create_siena_item')
assert.ok(publish)
for(const kind of ['note','saved','task_update','reminder']) {
 const result=await publish({kind,title:'Fixture',body:'Original words',notebook:'fixture-work',...(kind==='reminder'?{due_at:1000}:{})})
 assert.equal(result.isError,undefined);assert.equal(records.at(-1).notebook,'fixture-work');assert.equal(records.at(-1).kind,kind);assert.equal(records.at(-1).seen_at,null);assert.equal(records.at(-1).completed_at,null)
}
await publish({kind:'note',body:'A global note'});assert.equal(records.at(-1).notebook,null)
const count=records.length
bookExists=false
assert.equal((await publish({kind:'note',body:'Must not save',notebook:'absent'})).isError,true)
assert.equal(records.length,count)
bookExists=true;existing={id:'already-saved',kind:'note',created:100,notebook:'fixture-work'}
const retry=await publish({kind:'note',body:'Never replaces original',notebook:'fixture-work',source_key:'existing-key'})
assert.equal(JSON.parse(retry.content[0].text).already_exists,true);assert.equal(records.length,count)
for(const q of queries.filter(q=>q.table==='notebooks')) assert.ok(q.filters.some(([k,v])=>k==='vault'&&v==='fixture-vault'))
assert.ok(records.every(r=>r.vault==='fixture-vault'))
console.log('PASS actual MCP handler: all item kinds retain notebook; global notes supported; missing notebook refused; retries do not duplicate or rewrite; archive scoping and seen/completion state preserved.')
