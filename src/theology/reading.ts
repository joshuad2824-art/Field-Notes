import { safeReadingUrl } from '../lib/reading.ts'
import type { StudyEdition } from './model.ts'
import { sectionSource } from './source.ts'
export type TextStyle='strong'|'em'|'code'|'sup'
export interface StudyRun {text:string;from:number;to:number;styles:TextStyle[];href?:string}
export interface StudyBlock {kind:'heading'|'paragraph'|'quote'|'list'|'code'|'rule'|'table-row';level?:number;marker?:string;cells?:StudyRun[][];columns?:string[];head?:boolean;runs:StudyRun[];from:number;to:number;sourceByte:number}
export interface StudyReading {text:string;blocks:StudyBlock[]}
const enc=new TextEncoder()
// Formatting is a view. Source bytes, punctuation and source spans are never edited.
export function studyReading(source:string):StudyReading {
  let text='',cursor=0
  const blocks:StudyBlock[]=[]
  function inline(raw:string,styles:TextStyle[]=[],href?:string):StudyRun[]{
    const runs:StudyRun[]=[]
    const pattern=/<a\s+(?:id|name)=["'][^"']+["'][^>]*>\s*<\/a>|\[([^\]]+)\]\(([^\s)]+)(?:\s+"[^"]*")?\)|\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|\*([^*\n]+)\*|_([^_\n]+)_|`([^`]+)`|<sup>([\s\S]*?)<\/sup>/g
    const emit=(value:string)=>{if(!value)return;const from=cursor;cursor+=value.length;text+=value;runs.push({text:value,from,to:cursor,styles,...(href?{href}:{})})}
    let at=0
    for(const m of raw.matchAll(pattern)){
      emit(raw.slice(at,m.index));at=m.index!+m[0].length
      if(m[0].startsWith('<a '))continue
      if(m[1])runs.push(...inline(m[1],styles,safeReadingUrl(m[2])??undefined))
      else if(m[3]||m[4])runs.push(...inline(m[3]||m[4],[...styles,'strong'],href))
      else if(m[5]||m[6])runs.push(...inline(m[5]||m[6],[...styles,'em'],href))
      else if(m[7])runs.push(...inline(m[7],[...styles,'code'],href))
      else if(m[8])runs.push(...inline(m[8],[...styles,'sup'],href))
    }
    emit(raw.slice(at));return runs
  }
  const lines=Array.from(source.matchAll(/[^\n]*\n|[^\n]+$/g))
  const lineBytes=new Map<number,number>();let byteAt=0
  for(const line of lines){lineBytes.set(line.index!,byteAt);byteAt+=enc.encode(line[0]).length}
  let paragraph:string[]=[],paragraphAt=0,fenced=false,code:string[]=[],codeAt=0,comment=false,columns:string[]|null=null
  const add=(kind:StudyBlock['kind'],raw:string,at:number,extra:Partial<StudyBlock>={})=>{
    if(blocks.length){text+='\n\n';cursor+=2}
    const from=cursor,runs=kind==='code'?[{text:raw,from,to:from+raw.length,styles:['code'] as TextStyle[]}]:inline(raw)
    if(kind==='code'){text+=raw;cursor+=raw.length}
    blocks.push({kind,runs,from,to:cursor,sourceByte:lineBytes.get(at)??0,...extra})
  }
  const flush=()=>{if(paragraph.length){add('paragraph',paragraph.join('\n'),paragraphAt);paragraph=[]}}
  const cells=(line:string)=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split(/(?<!\\)\|/).map(c=>c.trim().replace(/\\\|/g,'|'))
  for(let index=0;index<lines.length;index++){const l=lines[index],line=l[0].replace(/\r?\n$/,''),at=l.index!
    if(comment){if(line.includes('-->'))comment=false;continue}
    if(/^\s*<!--/.test(line)){flush();comment=!line.includes('-->');continue}
    if(/^\s*```/.test(line)){flush();if(fenced){add('code',code.join('\n'),codeAt);code=[]}else codeAt=at;fenced=!fenced;continue}
    if(fenced){code.push(line);continue}
    if(!line.trim()){flush();columns=null;continue}
    const next=lines[index+1]?.[0]??'',tableHead=line.includes('|')&&next.includes('|')&&cells(next).every(c=>/^:?-{3,}:?$/.test(c))
    if(tableHead||columns&&line.trim().startsWith('|')){
      flush();const values=cells(line);if(tableHead)columns=values
      if(blocks.length){text+='\n\n';cursor+=2}
      const from=cursor,row=values.map((cell,i)=>{if(i){text+='\t';cursor++}return inline(cell)})
      blocks.push({kind:'table-row',runs:row.flat(),cells:row,columns:columns??[],head:tableHead,from,to:cursor,sourceByte:lineBytes.get(at)??0})
      if(tableHead)index++;continue
    }
    columns=null
    if(/^\s*<a\s+(?:id|name)=['"][^'"]+['"][^>]*>\s*<\/a>\s*$/.test(line)){flush();continue}
    const h=line.match(/^\s{0,3}(#{1,6})\s+(.+?)(?:\s+#+)?$/),q=line.match(/^\s*>\s?(.*)$/),li=line.match(/^\s*([-+*]|\d+[.)])\s+(.*)$/)
    if(h){flush();add('heading',h[2],at,{level:h[1].length})}
    else if(/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)){flush();add('rule','',at)}
    else if(q){flush();add('quote',q[1],at)}
    else if(li){flush();add('list',li[2],at,{marker:li[1]})}
    else{if(!paragraph.length)paragraphAt=at;paragraph.push(line)}
  }
  flush();if(fenced&&code.length)add('code',code.join('\n'),codeAt)
  return {text,blocks}
}
export interface StudyHit {section:string;title:string;from:number;to:number;excerpt:string;role:string}
const cache=new WeakMap<StudyEdition,Map<string,StudyReading>>()
export function readingFor(edition:StudyEdition,section:string){
  let entries=cache.get(edition);if(!entries){entries=new Map();cache.set(edition,entries)}
  let reading=entries.get(section)
  if(!reading){const s=edition.sections.find(s=>s.id===section);if(!s)throw new Error('Reading not found.');reading=studyReading(sectionSource(edition,s));entries.set(section,reading)}
  return reading
}
export function searchStudy(edition:StudyEdition,query:string):StudyHit[]{
  const words=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);if(!words.length)return []
  const hits:StudyHit[]=[]
  for(const section of edition.sections){const reading=readingFor(edition,section.id)
    for(const b of reading.blocks){const body=reading.text.slice(b.from,b.to),lower=body.toLocaleLowerCase();if(!words.every(w=>lower.includes(w)))continue
      const at=Math.min(...words.map(w=>lower.indexOf(w))),from=b.from+at
      hits.push({section:section.id,title:section.title,from,to:from+words[0].length,excerpt:(at>65?'…':'')+body.slice(Math.max(0,at-65),at+150)+(at+150<body.length?'…':''),role:section.role})
    }
  }
  return hits
}
