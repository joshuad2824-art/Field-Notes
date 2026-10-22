import { useEffect, useState } from 'react'
import { getVault, useVault } from '../sync/vault'
import { REFERENCES, REFERENCE_PACKAGE_LIMIT, installPrivateReference, privateReference, validatePrivateReference, type ReferenceIntegrity, type ReferenceKey, type ReferencePackage } from './references'
import { sourceHash } from './source'

export type ReferenceStatus='device'|'syncing'|'synced'|'offline'|'unavailable'|'missing'|'error'
export type ReferenceCatalog=Readonly<Record<ReferenceKey,ReferenceIntegrity>>
type Identity=NonNullable<ReturnType<typeof getVault>>
type ReferenceRow={vault:string;id:string;document_key:ReferenceKey;source_sha256:string;package_base64:string;byte_length:number;created:number}
const same=(a:Identity|null,b:Identity)=>a?.id===b.id&&a.url===b.url&&a.key===b.key&&a.anonKey===b.anonKey
const encode=(bytes:Uint8Array)=>{let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text)}
const decode=(text:string)=>Uint8Array.from(atob(text),c=>c.charCodeAt(0))
const MAX_RESPONSE=Math.ceil(REFERENCE_PACKAGE_LIMIT*4/3)+4096

export function createReferenceSync(catalog:ReferenceCatalog=REFERENCES,fetcher:typeof fetch=fetch,timeout=20000){
  const listeners=new Set<()=>void>(),states=new Map<ReferenceKey,{owner:Identity;status:ReferenceStatus}>()
  type Job={owner:Identity;publish:boolean;promise:Promise<ReferenceStatus>}
  const jobs=new Map<ReferenceKey,Job>()
  const status=(key:ReferenceKey):ReferenceStatus=>{const state=states.get(key);return state&&same(getVault(),state.owner)?state.status:'device'}
  const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}}
  async function sync(key:ReferenceKey,publish=false):Promise<ReferenceStatus>{
    const owner=getVault();if(!owner)return 'device'
    const pending=jobs.get(key)
    if(pending&&same(owner,pending.owner)){pending.publish||=publish;return pending.promise}
    const announce=(next:ReferenceStatus)=>{if(same(getVault(),owner)){states.set(key,{owner,status:next});for(const listener of listeners)listener()}}
    const stillOwn=()=>{if(!same(getVault(),owner))throw Error('Reference pairing changed.')}
    const spec=catalog[key],query=`?vault=eq.${encodeURIComponent(owner.id)}&id=eq.${spec.packageSha256}&document_key=eq.${key}&select=vault,id,document_key,source_sha256,package_base64,byte_length,created&limit=1`
    async function request(path:string,body?:ReferenceRow):Promise<unknown>{
      stillOwn();const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout)
      try{
        const response=await fetcher(owner!.url.replace(/\/+$/,'')+'/rest/v1/study_reference_editions'+path,{method:body?'POST':'GET',body:body?JSON.stringify(body):undefined,signal:controller.signal,cache:'no-store',credentials:'omit',headers:{apikey:owner!.anonKey,Authorization:`Bearer ${owner!.anonKey}`,'x-vault-key':owner!.key,'Content-Type':'application/json',...(body?{Prefer:'resolution=ignore-duplicates,return=minimal'}:{})}})
        stillOwn()
        if(!response.ok){void response.body?.cancel();throw Object.assign(Error('Private reference storage unavailable.'),{status:response.status})}
        if(body){void response.body?.cancel();return null}
        if(Number(response.headers.get('content-length')??0)>MAX_RESPONSE){void response.body?.cancel();throw Error('Reference response too large.')}
        let bytes:Uint8Array
        if(response.body){
          const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0
          for(;;){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>MAX_RESPONSE){await reader.cancel();throw Error('Reference response too large.')}chunks.push(part.value)}
          bytes=new Uint8Array(length);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length}
        }else{bytes=new TextEncoder().encode(await response.text());if(bytes.length>MAX_RESPONSE)throw Error('Reference response too large.')}
        stillOwn();return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
      }finally{clearTimeout(timer)}
    }
    async function incoming(result:unknown):Promise<ReferencePackage|null>{
      if(!Array.isArray(result)||result.length>1)throw Error('Invalid private reference response.')
      if(!result.length)return null
      const row=result[0] as ReferenceRow
      if(row.vault!==owner!.id||row.id!==spec.packageSha256||row.document_key!==key||row.source_sha256!==spec.sha256||row.byte_length!==spec.packageBytes||!Number.isSafeInteger(row.created)||row.created<0||typeof row.package_base64!=='string'||row.package_base64.length>MAX_RESPONSE)throw Error('Invalid private reference edition.')
      const packet=decode(row.package_base64)
      if(packet.length!==spec.packageBytes||await sourceHash(packet)!==spec.packageSha256)throw Error('Private reference package integrity failed.')
      const doc=await validatePrivateReference(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(packet)),spec)
      if(doc.key!==key)throw Error('Private reference identity changed.')
      stillOwn();return doc
    }
    const job:Job={owner,publish,promise:Promise.resolve('device')}
    jobs.set(key,job)
    job.promise=Promise.resolve().then(async()=>{
      do{
        const uploading=job.publish;job.publish=false
        if(!navigator.onLine){announce('offline');return status(key)}
        announce('syncing')
        try{
          let doc=await incoming(await request(query))
          if(!doc&&uploading){
            const local=await privateReference(key);stillOwn()
            if(!local||local.scope!==owner.id)throw Error('Import the verified private package before publishing it.')
            doc=await validatePrivateReference(local.document,spec);stillOwn()
            const packet=new TextEncoder().encode(JSON.stringify(doc))
            await request('?on_conflict=vault,id',{vault:owner.id,id:spec.packageSha256,document_key:key,source_sha256:spec.sha256,package_base64:encode(packet),byte_length:packet.length,created:Date.now()})
            doc=await incoming(await request(query));if(!doc)throw Error('Private import readback was empty.')
          }
          if(doc){await installPrivateReference(doc,stillOwn,spec);stillOwn();announce('synced')}
          else {const local=await privateReference(key);stillOwn();announce(local?'device':'missing')}
        }catch(error){
          if(!same(getVault(),owner))return 'device'
          const code=(error as {status?:number}).status
          announce(!navigator.onLine?'offline':code===404||code===406?'unavailable':'error')
        }
      }while(job.publish&&same(getVault(),owner))
      return status(key)
    }).finally(()=>{if(jobs.get(key)===job)jobs.delete(key)})
    return job.promise
  }
  return {sync,status,subscribe}
}
const referencesSync=createReferenceSync()
export const syncPrivateReference=(key:ReferenceKey,publish=false)=>referencesSync.sync(key,publish)
export function usePrivateReferenceSync(key:ReferenceKey){
  const vault=useVault(),[,refresh]=useState(0)
  useEffect(()=>referencesSync.subscribe(()=>refresh(value=>value+1)),[])
  useEffect(()=>{
    if(!vault)return
    void syncPrivateReference(key)
    const online=()=>void syncPrivateReference(key),timer=setInterval(online,60000)
    window.addEventListener('online',online)
    return()=>{clearInterval(timer);window.removeEventListener('online',online)}
  },[key,vault?.id,vault?.url,vault?.key,vault?.anonKey])
  return referencesSync.status(key)
}
