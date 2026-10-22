import { getVault } from '../sync/vault'
import { changed } from '../lib/db'
import { studyDB } from './store'
import { sourceHash } from './source'

export const REFERENCES={
  bfm:{title:'Baptist Faith and Message',edition:'Adopted June 14, 2000 · Article VI amended June 14, 2023',sha256:'95793da058bcec060f8c5967e76449cead717badfef7a49b92f0be111a69a557',contentSha256:'e7497f2e024b0bb9456f15f19d2c256cddaa74c356ec1e986c7c6e389ef627b9',packageSha256:'e88d0f66fe18f0c0df38340860db86bf714e59cf1de000b17dc76dc7df7e8d4f',packageBytes:108906},
  mbc:{title:'MBC Bylaws, Policies & Procedures',edition:'Saved February 11, 2025 · No later amendment verified',sha256:'7e4491885f76e25f45dcd3d8df409eb3ecc61e4416b540f548c51a746413b4a8',contentSha256:'fc27e0dce2a293686711803e63dfa4b7809df4ba8bf0d35421b0735c52cd657b',packageSha256:'2d0ab3f4c45832d26032efc7086fa4079ff65d84129e4e0c97bfbc97816a74d7',packageBytes:947795},
} as const
export type ReferenceKey=keyof typeof REFERENCES
export const isReferenceKey=(key:string):key is ReferenceKey=>Object.prototype.hasOwnProperty.call(REFERENCES,key)
export interface ReferenceBlock {
  id:string;kind:'heading'|'paragraph'|'table'|'image';text:string;level?:number;marker?:string;role?:string;asset?:string
  origin:{part:string;paragraph?:number;line?:number;page?:number;byte?:number}
  rows?:{header:boolean;cells:{span:number;blocks:ReferenceBlock[]}[]}[]
}
export interface ReferencePackage {
  format:'field-notes-private-reference';version:1;key:ReferenceKey
  source:{filename:string;sha256:string;bytes:number;base64:string}
  blocks:ReferenceBlock[];assets:Record<string,{mime:'image/png';base64:string;origin:string}>
  contentSha256:string;coverage:Record<string,unknown>;synthetic?:boolean
}
export const REFERENCE_PACKAGE_LIMIT=4000000
export interface ReferenceIntegrity {sha256:string;contentSha256:string;packageSha256:string;packageBytes:number}
export interface PrivateReference {scope:string;document:ReferencePackage}
const keyFor=(scope:string,key:ReferenceKey)=>`private-reference:${scope}:${key}`
export function flattenReference(blocks:ReferenceBlock[]):ReferenceBlock[]{
  return blocks.flatMap(block=>block.kind==='table'?(block.rows??[]).flatMap(row=>row.cells.flatMap(cell=>flattenReference(cell.blocks))):[block])
}
export async function validatePrivateReference(input:unknown,specification?:ReferenceIntegrity){
  const doc=input as ReferencePackage
  if(!doc||doc.format!=='field-notes-private-reference'||doc.version!==1||!isReferenceKey(doc.key)||!Array.isArray(doc.blocks)||!doc.blocks.length||!doc.source||typeof doc.source.base64!=='string'||doc.source.base64.length>20000000)throw Error('Choose a prepared private reference package.')
  const synthetic=doc.synthetic===true&&import.meta.env.DEV&&['localhost','127.0.0.1'].includes(location.hostname)
  const expected=specification??REFERENCES[doc.key]
  if((doc.source.sha256!==expected.sha256||doc.contentSha256!==expected.contentSha256)&&(!synthetic||specification))throw Error('The source does not match the verified edition.')
  const packet=new TextEncoder().encode(JSON.stringify(doc))
  if(packet.length>REFERENCE_PACKAGE_LIMIT||(!synthetic||specification)&&(packet.length!==expected.packageBytes||await sourceHash(packet)!==expected.packageSha256))throw Error('The package does not match the verified reference manifest.')
  const bytes=Uint8Array.from(atob(doc.source.base64),c=>c.charCodeAt(0))
  if(bytes.length!==doc.source.bytes||await sourceHash(bytes)!==doc.source.sha256||await sourceHash(new TextEncoder().encode(JSON.stringify(doc.blocks)))!==doc.contentSha256)throw Error('The private reference did not pass its integrity check.')
  const ids=new Set<string>()
  function validate(blocks:ReferenceBlock[],depth=0){
    if(depth>8||blocks.length>10000)throw Error('Unsupported reference structure.')
    for(const b of blocks){
      if(!b||typeof b.id!=='string'||!b.id||b.id.length>200||ids.has(b.id)||typeof b.text!=='string'||b.text.length>100000||!['heading','paragraph','table','image'].includes(b.kind)||!b.origin||typeof b.origin.part!=='string')throw Error('Invalid reference paragraph.')
      ids.add(b.id)
      if(b.kind==='heading'&&(!Number.isInteger(b.level)||b.level!<2||b.level!>6))throw Error('Invalid heading level.')
      if(b.kind==='table'){
        if(!Array.isArray(b.rows)||b.rows.length>2000)throw Error('Invalid source table.')
        for(const row of b.rows){if(!Array.isArray(row.cells)||row.cells.length>40)throw Error('Invalid source table.');for(const cell of row.cells){if(!Number.isInteger(cell.span)||cell.span<1||cell.span>40)throw Error('Invalid source table.');validate(cell.blocks,depth+1)}}
      }
      if(b.kind==='image'&&(!b.asset||!doc.assets?.[b.asset]||doc.assets[b.asset].mime!=='image/png'||!/^[-A-Za-z0-9+/=]+$/.test(doc.assets[b.asset].base64)))throw Error('Invalid private source image.')
    }
  }
  validate(doc.blocks)
  for(const asset of new Set(flattenReference(doc.blocks).filter(b=>b.kind==='image').map(b=>b.asset!))){
    const image=doc.assets[asset]
    if(image.base64.length>5000000||await sourceHash(Uint8Array.from(atob(image.base64),c=>c.charCodeAt(0)))!==asset)throw Error('The source illustration did not pass its integrity check.')
  }
  return doc
}
export async function installPrivateReference(input:unknown,guard?:()=>void,specification?:ReferenceIntegrity){
  const scope=getVault()?.id;if(!scope)throw Error('Pair this device before importing a private reference.')
  const doc=await validatePrivateReference(input,specification)
  await studyDB.transaction('rw',studyDB.meta,async()=>{
    guard?.()
    if(getVault()?.id!==scope)throw Error('The paired vault changed. Import again in the intended vault.')
    await studyDB.meta.put({id:keyFor(scope,doc.key),value:JSON.stringify(doc)})
  });changed()
}
export async function privateReference(key:ReferenceKey):Promise<PrivateReference|null>{
  const scope=getVault()?.id;if(!scope)return null
  const row=await studyDB.meta.get(keyFor(scope,key));if(getVault()?.id!==scope||!row)return null
  try{return {scope,document:JSON.parse(row.value) as ReferencePackage}}catch{return null}
}

// Only the currently opened, paired document is indexed. These offsets map the
// folded index back to the unchanged UTF-16 source text used in exact snippets.
export function foldReference(value:string){
  let folded='',offset=0;const starts:number[]=[],ends:number[]=[]
  for(const character of value){
    const unit=character.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase().replace(/œ/g,'oe').replace(/æ/g,'ae').replace(/ß/g,'ss')
    if(!unit.length&&ends.length)ends[ends.length-1]=offset+character.length
    for(let i=0;i<unit.length;i++){folded+=unit[i];starts.push(offset);ends.push(offset+character.length)}
    offset+=character.length
  }
  return {folded,starts,ends}
}
export interface ReferenceHit {block:ReferenceBlock;heading:string;from:number;to:number;excerptStart:number;excerptEnd:number;score:number}
export function searchReference(blocks:ReferenceBlock[],query:string):ReferenceHit[]{
  const words=foldReference(query.trim()).folded.split(/[\s/]+/).filter(Boolean);if(!words.length)return []
  let heading='';const hits:ReferenceHit[]=[]
  for(const block of flattenReference(blocks)){
    if(block.kind==='heading')heading=block.text
    const index=foldReference(block.text),positions=words.map(word=>index.folded.indexOf(word));if(positions.some(at=>at<0))continue
    const at=Math.min(...positions),word=words[positions.indexOf(at)],from=index.starts[at],to=index.ends[at+word.length-1]
    const exactHeading=block.kind==='heading'&&index.folded.trim()===words.join(' '),code=/^[a-z]\d{3}$/.test(words[0])&&index.folded.includes(words[0])
    hits.push({block,heading,from,to,excerptStart:Math.max(0,from-65),excerptEnd:Math.min(block.text.length,Math.max(to,from+180)),score:(block.kind==='heading'?100:0)+(exactHeading?100:0)+(code?80:0)+(block.role==='source-header'?70:0)})
  }
  return hits.sort((a,b)=>b.score-a.score)
}
