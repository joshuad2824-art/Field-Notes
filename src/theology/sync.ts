import { useEffect, useState } from 'react'
import { changed } from '../lib/db'
import { getVault, useVault } from '../sync/vault'
import { studyDB } from './store'
import { parseStudySource, sourceHash, verifySpans } from './source'
import { DAILY_DOCTRINE, type StudyAnnotation, type StudyEdition, type StudyPlace } from './model'
type MarkRow={vault:string;id:string;edition:string;section:string;start_offset:number;end_offset:number;quote:string;prefix:string;suffix:string;color:string;created:number;updated:number;deleted:number|null}
type PlaceRow={vault:string;id:string;section:string;offset:number;updated:number}
type EditionRow={vault:string;id:string;sha256:string;source_base64:string;byte_length:number;imported:number}
export type StudyStatus='device'|'syncing'|'synced'|'offline'|'unavailable'|'error'
let status:StudyStatus='device',running:Promise<void>|null=null,again=false
const listeners=new Set<()=>void>()
const announce=(s:StudyStatus)=>{status=s;for(const l of listeners)l()}
export const studySyncStatus=()=>status
const validColor=(s:string)=>['brass','forest','oxblood','navy'].includes(s)
const clock=(n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0
export function mergeStudyRecord<T extends {id:string;updated:number}>(a:T,b:T):T{
  if(a.updated!==b.updated)return a.updated>b.updated?a:b
  const x=a as T&Partial<StudyAnnotation&StudyPlace>,y=b as T&Partial<StudyAnnotation&StudyPlace>
  if('edition' in x){const ax=x.deleted??0,by=y.deleted??0;return ax!==by?(ax>by?a:b):(x.color??'')>(y.color??'')?a:b}
  if(x.section!==y.section)return (x.section??'')>(y.section??'')?a:b
  return (x.offset??0)>(y.offset??0)?a:b
}
export function annotationToRow(a:StudyAnnotation):MarkRow{return {vault:a.scope,id:a.id,edition:a.edition,section:a.section,start_offset:a.start,end_offset:a.end,quote:a.quote,prefix:a.prefix,suffix:a.suffix,color:a.color,created:a.created,updated:a.updated,deleted:a.deleted??null}}
function rowToAnnotation(r:MarkRow):StudyAnnotation{
  if(typeof r.id!=='string'||!r.id||r.edition!==DAILY_DOCTRINE.sha256||typeof r.section!=='string'||!validColor(r.color)||!Number.isInteger(r.start_offset)||r.start_offset<0||!Number.isInteger(r.end_offset)||r.end_offset<=r.start_offset||r.end_offset-r.start_offset>10000||typeof r.quote!=='string'||r.quote.length!==r.end_offset-r.start_offset||typeof r.prefix!=='string'||typeof r.suffix!=='string'||r.prefix.length>80||r.suffix.length>80||!clock(r.created)||!clock(r.updated)||r.updated<r.created||r.deleted!==null&&!clock(r.deleted))throw Error('Invalid highlight data')
  return {scope:r.vault,id:r.id,edition:r.edition,section:r.section,start:r.start_offset,end:r.end_offset,quote:r.quote,prefix:r.prefix,suffix:r.suffix,color:r.color as StudyAnnotation['color'],created:r.created,updated:r.updated,...(r.deleted?{deleted:r.deleted}:{})}
}
function rowToPlace(r:PlaceRow):StudyPlace{
  if(r.id!==DAILY_DOCTRINE.sha256||typeof r.section!=='string'||!Number.isInteger(r.offset)||r.offset<0||!clock(r.updated))throw Error('Invalid reading location')
  return {scope:r.vault,id:r.id,section:r.section,offset:r.offset,updated:r.updated}
}
function encodeBytes(bytes:Uint8Array){let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s)}
function decodeBytes(value:string){const s=atob(value);return Uint8Array.from(s,c=>c.charCodeAt(0))}
export async function syncStudy(fetcher:typeof fetch=fetch):Promise<void>{
  // An edit during a request needs a fresh pass, not the earlier snapshot.
  if(running){again=true;return running}
  running=(async()=>{do{
    again=false
    const vault=getVault();if(!vault){announce('device');return}
    if(!navigator.onLine){announce('offline');return}
    const scope=vault.id
    const stillOwn=()=>{const current=getVault();if(current?.id!==scope||current.url!==vault.url||current.key!==vault.key)throw Error('The paired vault changed during study sync.')}
    const call=async(table:string,init:RequestInit={}):Promise<unknown>=>{
      stillOwn();const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000)
      try{
        const response=await fetcher(`${vault.url.replace(/\/+$/,'')}/rest/v1/${table}`,{...init,signal:controller.signal,cache:'no-store',credentials:'omit',headers:{apikey:vault.anonKey,Authorization:`Bearer ${vault.anonKey}`,'x-vault-key':vault.key,'Content-Type':'application/json',...init.headers}})
        if(!response.ok)throw Object.assign(Error('Study storage unavailable'),{status:response.status})
        const text=await response.text();stillOwn();return text?JSON.parse(text):null
      }finally{clearTimeout(timer)}
    }
    announce('syncing')
    try{
      const remote=await call(`study_editions?vault=eq.${encodeURIComponent(scope)}&id=eq.${DAILY_DOCTRINE.sha256}&select=*&limit=1`)
      if(!Array.isArray(remote))throw Error('Invalid study response')
      for(const value of remote){
        const row=value as EditionRow
        if(row.vault!==scope||row.id!==DAILY_DOCTRINE.sha256||row.sha256!==row.id||row.byte_length!==DAILY_DOCTRINE.bytes||typeof row.source_base64!=='string'||row.source_base64.length>7000000||!clock(row.imported))throw Error('Invalid study edition')
        if(await studyDB.editions.get([scope,row.id]))continue
        const source=decodeBytes(row.source_base64),hash=await sourceHash(source)
        if(hash!==row.id||source.length!==row.byte_length)throw Error('The book did not pass its source verification.')
        // Re-derive navigation from verified bytes rather than trusting remote metadata.
        const edition:StudyEdition={scope,id:hash,title:DAILY_DOCTRINE.title,filename:DAILY_DOCTRINE.filename,source,bytes:source.length,...parseStudySource(source),imported:row.imported}
        if(!verifySpans(edition))throw Error('Invalid source spans')
        await studyDB.transaction('rw',studyDB.editions,async()=>{stillOwn();if(!await studyDB.editions.get([scope,hash]))await studyDB.editions.add(edition)})
      }
      const edition=await studyDB.editions.get([scope,DAILY_DOCTRINE.sha256])
      if(edition&&!remote.length){
        if(await sourceHash(edition.source)!==edition.id||!verifySpans(edition))throw Error('The local source did not pass verification.')
        const row={vault:scope,id:edition.id,sha256:edition.id,title:edition.title,filename:edition.filename,source_base64:encodeBytes(edition.source),byte_length:edition.bytes,sections:edition.sections,anchors:edition.anchors,source_boundary:edition.sourceBoundary,imported:edition.imported}
        await call('study_editions',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(row)})
      }
      if(edition||remote.length){for(const table of ['study_annotations','study_places'] as const){
        let offset=0
        for(;;){
          const rows=await call(`${table}?vault=eq.${encodeURIComponent(scope)}&${table==='study_annotations'?'edition':'id'}=eq.${DAILY_DOCTRINE.sha256}&select=*&order=id&offset=${offset}&limit=500`)
          if(!Array.isArray(rows))throw Error('Invalid study state response')
          for(const row of rows){
            if(row.vault!==scope)throw Error('Invalid study scope')
            if(table==='study_annotations'){
              const incoming=rowToAnnotation(row as MarkRow)
              await studyDB.transaction('rw',studyDB.annotations,async()=>{stillOwn();const current=await studyDB.annotations.get([scope,incoming.id]);stillOwn();await studyDB.annotations.put(current?mergeStudyRecord(current,incoming):incoming)})
            }else{
              const incoming=rowToPlace(row as PlaceRow)
              await studyDB.transaction('rw',studyDB.places,async()=>{stillOwn();const current=await studyDB.places.get([scope,incoming.id]);stillOwn();await studyDB.places.put(current?mergeStudyRecord(current,incoming):incoming)})
            }
          }
          if(rows.length<500)break;offset+=500
        }
        const local=table==='study_annotations'?studyDB.annotations:studyDB.places
        const ids=(await local.where('scope').equals(scope).toArray()).filter(r=>table==='study_annotations'?(r as StudyAnnotation).edition===DAILY_DOCTRINE.sha256:r.id===DAILY_DOCTRINE.sha256).map(r=>r.id)
        for(let at=0;at<ids.length;at+=100){
          // Pull-time snapshots never replace edits made while the network waited.
          const records=await local.bulkGet(ids.slice(at,at+100).map(id=>[scope,id] as [string,string]));stillOwn()
          const batch=records.filter(r=>!!r).map(r=>table==='study_annotations'?annotationToRow(r as StudyAnnotation):{vault:scope,id:r!.id,section:r!.section,offset:(r as StudyPlace).offset,updated:r!.updated})
          if(batch.length)await call(`${table}?on_conflict=vault,id`,{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(batch)})
        }
      }}
      stillOwn();changed();announce('synced')
    }catch(e){
      if(getVault()?.id!==scope){again=true;continue}
      const code=(e as {status?:number}).status;announce(!navigator.onLine?'offline':code===404||code===406?'unavailable':'error')
    }
  }while(again)})().finally(()=>{running=null})
  return running
}
export function useStudySync(){
  const vault=useVault(),[value,setValue]=useState(status)
  useEffect(()=>{const update=()=>setValue(status);listeners.add(update);void syncStudy();const timer=setInterval(()=>void syncStudy(),60000);const online=()=>void syncStudy();window.addEventListener('online',online);return()=>{listeners.delete(update);clearInterval(timer);window.removeEventListener('online',online)}},[vault?.id])
  return value
}
