import Dexie, { type Table } from 'dexie'
import { getVault } from '../sync/vault'
import { changed } from '../lib/db'
import { DAILY_DOCTRINE, type StudyEdition, type StudyAnnotation, type StudyPlace, type HighlightColor } from './model'
import { parseStudySource, sourceHash, verifySpans } from './source'
export class StudyDB extends Dexie {
  editions!:Table<StudyEdition,[string,string]>
  annotations!:Table<StudyAnnotation,[string,string]>
  places!:Table<StudyPlace,[string,string]>
  meta!:Table<{id:string;value:string},string>
  constructor(name='field-notes-study'){
    super(name)
    this.version(1).stores({editions:'[scope+id],scope',annotations:'[scope+id],scope,[scope+edition],[scope+edition+section],updated',places:'[scope+id],scope',meta:'id'})
  }
}
export const studyDB=new StudyDB()
export const studyScope=()=>getVault()?.id??'local-device'
export async function installStudySource(source:Uint8Array,options:{title:string;filename:string;expected?:{sha256:string;bytes:number}},scope=studyScope()){
  const id=await sourceHash(source)
  if(options.expected&&(id!==options.expected.sha256||source.length!==options.expected.bytes))throw new Error('This file does not match the supplied Daily Doctrine edition. The stored book has not changed.')
  const current=await studyDB.editions.get([scope,id]);if(current)return current
  const edition:StudyEdition={scope,id,title:options.title,filename:options.filename,source:source.slice(),bytes:source.length,...parseStudySource(source),imported:Date.now()}
  if(!verifySpans(edition))throw new Error('The source spans do not reconstruct the supplied file.')
  await studyDB.editions.add(edition);changed();return edition
}
export async function importDailyDoctrine(file:File){return installStudySource(new Uint8Array(await file.arrayBuffer()),{...DAILY_DOCTRINE,expected:DAILY_DOCTRINE})}
export async function activeEdition(){return (await studyDB.editions.where('scope').equals(studyScope()).toArray()).sort((a,b)=>b.imported-a.imported)[0]??null}
export async function sectionAnnotations(edition:string,section:string){return (await studyDB.annotations.where('[scope+edition+section]').equals([studyScope(),edition,section]).toArray()).filter(a=>!a.deleted)}
export async function saveHighlight(edition:StudyEdition,section:string,text:string,start:number,end:number,color:HighlightColor){
  if(edition.scope!==studyScope())throw new Error('Return to the currently paired study before highlighting.')
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||end>text.length||end-start>10000)throw new Error('Select a passage inside this reading.')
  const split=(n:number)=>n>0&&n<text.length&&/[\uD800-\uDBFF]/.test(text[n-1])&&/[\uDC00-\uDFFF]/.test(text[n])
  if(split(start)||split(end))throw new Error('Select complete characters inside this reading.')
  let before=Math.max(0,start-40),after=Math.min(text.length,end+40);if(split(before))before++;if(split(after))after--
  const at=Date.now(),annotation:StudyAnnotation={scope:edition.scope,id:crypto.randomUUID(),edition:edition.id,section,start,end,quote:text.slice(start,end),prefix:text.slice(before,start),suffix:text.slice(end,after),color,created:at,updated:at}
  await studyDB.annotations.add(annotation);changed();return annotation
}
export async function removeHighlight(id:string){
  const scope=studyScope()
  const removed=await studyDB.transaction('rw',studyDB.annotations,async()=>{
    const guard=()=>{if(scope!==studyScope())throw Error('The paired vault changed. Open the highlight again in the intended vault.')}
    const a=await studyDB.annotations.get([scope,id]);guard()
    if(!a||a.deleted)return []
    // Repeated highlighting can leave several ids for one visible passage.
    // Delete only coincident anchors; distinct overlapping ranges stay intact.
    const rows=(await studyDB.annotations.where('[scope+edition+section]').equals([scope,a.edition,a.section]).toArray()).filter(row=>!row.deleted&&row.start===a.start&&row.end===a.end&&row.quote===a.quote)
    guard()
    const at=rows.reduce((clock,row)=>Math.max(clock,row.updated+1),Date.now())
    await studyDB.annotations.bulkPut(rows.map(row=>({...row,deleted:at,updated:at})));guard()
    return rows
  })
  changed()
  return removed
}
export async function rememberPlace(edition:string,section:string,offset=0){const scope=studyScope();await studyDB.transaction('rw',studyDB.places,async()=>{const current=await studyDB.places.get([scope,edition]);if(scope===studyScope())await studyDB.places.put({scope,id:edition,section,offset,updated:Math.max(Date.now(),(current?.updated??0)+1)})});changed()}
export async function exportStudyMarks(edition:string){
  const annotations=await studyDB.annotations.where('[scope+edition]').equals([studyScope(),edition]).toArray(),place=await studyDB.places.get([studyScope(),edition])
  return JSON.stringify({format:'field-notes-study-marks',version:1,edition,annotations:annotations.map(({scope:_,...a})=>a),place:place?{section:place.section,offset:place.offset,updated:place.updated}:null},null,2)
}
