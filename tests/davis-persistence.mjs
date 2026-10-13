import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
class Storage {
  data = new Map()
  getItem(k) { return this.data.get(k) ?? null }
  setItem(k,v) { this.data.set(k,String(v)) }
  removeItem(k) { this.data.delete(k) }
}
globalThis.window = globalThis
globalThis.sessionStorage = new Storage()
globalThis.localStorage = new Storage()
Object.defineProperty(globalThis.navigator,'onLine',{value:true,configurable:true})
const dir = await mkdtemp(join(tmpdir(),'davis-session-test-'))
try {
  await build({entryPoints:['src/davis/oauth.ts'],outfile:join(dir,'oauth.mjs'),bundle:true,platform:'node',format:'esm',define:{'import.meta.env.VITE_DAVIS_FIELD_NOTES_CLIENT_ID':'"fixture-client"'}})
  const auth = await import(pathToFileURL(join(dir,'oauth.mjs')))
  const clientId='fixture-client', now=Date.parse('2026-10-13T18:00:00Z')
  const resource='https://bsyupmesvqwxboncwgeg.supabase.co/functions/v1/davis-field-notes'
  const encoded=x=>Buffer.from(JSON.stringify(x)).toString('base64url')
  const token=(refresh)=>({access_token:`${encoded({alg:'RS256'})}.${encoded({iss:auth.DAVIS_ISSUER,aud:resource,client_id:clientId,sub:'fixture-user',exp:now/1000+3600,davis_access:'field_notes_read',scope:'email'})}.synthetic`,token_type:'Bearer',expires_in:3600,refresh_token:refresh,scope:'email'})
  const discovery={issuer:auth.DAVIS_ISSUER,authorization_endpoint:auth.DAVIS_ISSUER+'/oauth/authorize',token_endpoint:auth.DAVIS_ISSUER+'/oauth/token',code_challenge_methods_supported:['S256'],response_types_supported:['code'],token_endpoint_auth_methods_supported:['none'],scopes_supported:['email']}
  let latest='refresh-0', renewals=0, ranges=[], failureAt=0, held, release
  const persistent=new Storage()
  let queue=Promise.resolve()
  const lock=run=>{const next=queue.then(run);queue=next.catch(()=>{});return next}
  const fetcher=async(input,options={})=>{
    const url=new URL(input)
    if(url.href===auth.DAVIS_DISCOVERY_URL) return Response.json(discovery)
    if(url.pathname.endsWith('/oauth/token')) {
      const p=new URLSearchParams(options.body)
      if(p.get('grant_type')==='refresh_token') {
        assert.equal(p.get('refresh_token'),latest,'Tabs use the most recent rotating refresh token')
        renewals++
        if(held) await new Promise(r=>{release=r})
      }
      latest='refresh-'+(Number(latest.split('-')[1])+1)
      return Response.json(token(latest))
    }
    assert.equal(url.origin+url.pathname,resource)
    ranges.push({from:url.searchParams.get('from'),to:url.searchParams.get('to')})
    if(failureAt && ranges.length===failureAt) return new Response('',{status:503})
    const range=ranges.at(-1)
    return Response.json({schemaVersion:1,readOnly:true,complete:true,accountId:'fixture-user',householdId:'fixture-household',timezone:'America/Chicago',today:'2026-10-13',fetchedAt:new Date(now).toISOString(),sourceUrl:'https://davis-at-home.netlify.app',...range,events:[],reminders:[{id:'reminder:fixture',source:{provider:'davis-at-home',householdId:'fixture-household',collection:'reminders',id:'fixture',version:1,ownerId:null,audience:'household'},title:'Synthetic overdue reminder',date:'2026-01-01'}]})
  }
  const session=()=>auth.createDavisSession({clientId,callbackUrl:auth.DAVIS_CALLBACK_URL},{storage:new Storage(),persistent,fetcher,now:()=>now,lock})
  const first=session(), start=new URL(await first.begin())
  const connected=await first.callback(new URL(auth.DAVIS_CALLBACK_URL+'?code=synthetic&state='+start.searchParams.get('state')))
  assert(persistent.getItem(auth.DAVIS_SESSION_KEY).includes(latest))
  assert(!persistent.getItem(auth.DAVIS_SESSION_KEY).includes('access_token'))
  const signal=()=>new AbortController().signal
  const full=await connected.read(signal())
  assert.equal(full.status,200)
  assert.equal(full.snapshot.from,'2026-09-13');assert.equal(full.snapshot.to,'2027-10-13')
  assert.equal(ranges.length,5);assert.equal(full.snapshot.entries.length,1,'Duplicate reminders across pages collapse')
  const reloaded=session(), restored=reloaded.restore()
  assert(restored,'Reload restores the saved account without authorization')
  await restored.read(signal());assert.equal(renewals,1)
  const tabA=session().restore(), tabB=session().restore()
  await Promise.all([tabA.read(signal()),tabB.read(signal())]);assert.equal(renewals,3)
  ranges=[];failureAt=3
  const partial=await restored.read(signal());assert.equal(partial.status,503);assert.equal(partial.snapshot,undefined,'Partial year never replaces the complete view')
  failureAt=0;held=true
  const late=session(), lateRead=late.restore().read(signal())
  while(!release) await new Promise(r=>setTimeout(r,1))
  reloaded.clear();release()
  await assert.rejects(lateRead)
  assert.equal(session().restore(),undefined,'Disconnect cannot be undone by a late refresh')
  assert.equal(JSON.parse(persistent.getItem(auth.DAVIS_SESSION_KEY)).disabled,true)
  console.log('PASS persistence across reload, rotating-token tab serialization, 396-day coverage, deduplication, partial failure, disconnect race')
} finally { await rm(dir,{recursive:true,force:true}) }
