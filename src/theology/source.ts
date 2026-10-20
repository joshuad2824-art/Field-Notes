import type { StudyEdition, StudySection } from './model.ts'
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM:true })
const encoder = new TextEncoder()
export async function sourceHash(bytes: Uint8Array): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.slice().buffer)), b => b.toString(16).padStart(2, '0')).join('')
}
export const sectionSource = (edition: StudyEdition, section: StudySection) => decoder.decode(edition.source.slice(section.from, section.to))
export function parseStudySource(bytes: Uint8Array) {
  const text = decoder.decode(bytes)
  if (encoder.encode(text).length !== bytes.length) throw new Error('The source is not a lossless UTF-8 document.')
  const lines = Array.from(text.matchAll(/[^\n]*\n|[^\n]+$/g))
  const starts: { byte: number; title: string; level: number }[] = [{byte:0,title:'Opening material',level:1}]
  const rawAnchors: {name:string;byte:number}[] = []
  let byte=0, boundary=0
  for (const line of lines) {
    const value=line[0], heading=value.match(/^\s{0,3}(#{1,4})\s+(.+?)\s*\r?\n?$/)
    if (heading) {
      const title=heading[2].replace(/\s+#+$/,'')
      if (byte===0) starts[0]={byte,title,level:heading[1].length}
      else starts.push({byte,title,level:heading[1].length})
      if (/^(?:source text|original (?:book )?text|complete book text)/i.test(title)) boundary=byte
    }
    for (const a of value.matchAll(/<a\s+(?:id|name)=["']([^"']+)["'][^>]*>\s*<\/a>/gi)) rawAnchors.push({name:a[1],byte:byte+encoder.encode(value.slice(0,a.index)).length})
    byte+=encoder.encode(value).length
  }
  let week:number|undefined,topic:string|undefined,inReadings=false
  const sections:StudySection[]=starts.map((s,i)=>{
    if(s.level===1){inReadings=/^daily readings$/i.test(s.title);week=undefined;topic=undefined}
    if(s.level===2&&inReadings)topic=s.title
    const w=s.title.match(/\bweek\s+(\d{1,2})\b/i)
    if(w)week=Number(w[1])
    const reading=s.title.match(/^(?:reading|day)\s*(\d{1,3})\b|^(\d{1,3})[.)]\s/i)
    const reference=/^(?:notes|appendix|works cited|general index|scripture index|bibliography|acknowledg|closing publisher)/i.test(s.title)
    const end=starts[i+1]?.byte??bytes.length,body=decoder.decode(bytes.slice(s.byte,end)),subtitle=reading?body.match(/^#####\s+(.+)$/m)?.[1]:undefined,sourceLocation=body.match(/<!--\s*Source:\s*([^>]+?)\s*-->/)?.[1]
    return {id:'s-'+s.byte.toString(36),title:subtitle?`Day ${Number(reading![1]??reading![2])} · ${subtitle}`:s.title,level:s.level,from:s.byte,to:end,...(week?{week}:{}),...(topic?{topic}:{}),...(sourceLocation?{sourceLocation}:{}),...(reading?{reading:Number(reading[1]??reading[2])}:{}),role:boundary&&s.byte<boundary?'aid':reference?'reference':reading?'reading':'front'}
  })
  const anchors:StudyEdition['anchors']={}
  for(const a of rawAnchors){
    // Markdown conversions commonly put an anchor on the line immediately
    // before its heading. Keep its bytes in their original span, while its
    // navigation target is the heading that follows it.
    const next=sections.find(s=>s.from>a.byte)
    const between=next?decoder.decode(bytes.slice(a.byte,next.from)):''
    const beforeHeading=next&&between.replace(/<a\s+(?:id|name)=["'][^"']+["'][^>]*>\s*<\/a>/gi,'').trim()===''
    const section=beforeHeading?next:[...sections].reverse().find(s=>s.from<=a.byte)
    if(section&&!anchors[a.name])anchors[a.name]={section:section.id,offset:beforeHeading?0:a.byte-section.from}
  }
  return {sections,anchors,sourceBoundary:boundary}
}
export function verifySpans(edition: StudyEdition): boolean {
  let at=0
  for(const s of edition.sections){if(s.from!==at||s.to<s.from||s.to>edition.bytes)return false;at=s.to}
  return at===edition.bytes&&edition.bytes===edition.source.length
}
