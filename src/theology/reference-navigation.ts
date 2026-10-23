import type { ReferenceBlock, ReferenceKey } from './references'

export interface ReferenceSection {id:string;title:string;titleBlock?:string;code?:string;group?:string;blocks:ReferenceBlock[]}
export interface ReferenceGroup {id:string;title:string;parent?:string}
// Navigation boundaries in the verified manual. These are source paragraph
// anchors, not copies of governing text. The immutable package stays untouched.
const manualParts=[
  ['word-document-xml-p1','Opening pages','opening'],
  ['word-document-xml-p105','Constitution & confession','foundations'],
  ['word-document-xml-p201','Bylaws','bylaws'],
  ['word-document-xml-p345','Deacon ministry','deacons'],
  ['word-document-xml-p478','Staffing','staffing'],
  ['word-header2-xml-p1','Policies & procedures','policies'],
  ['word-document-xml-p2342','Appendix & history','appendix'],
]
const bylawStarts=new Set(['word-document-xml-p203','word-document-xml-p224','word-document-xml-p286','word-document-xml-p313','word-document-xml-p333','word-document-xml-p336','word-document-xml-p339'])
const allBlocks=(blocks:ReferenceBlock[]):ReferenceBlock[]=>blocks.flatMap(b=>[b,...(b.rows??[]).flatMap(r=>r.cells.flatMap(c=>allBlocks(c.blocks)))])
export function referenceNavigation(key:ReferenceKey,blocks:ReferenceBlock[]){
  const sections:ReferenceSection[]=[],groups:ReferenceGroup[]=[]
  const add=(from:number,to:number,group?:string,fallback='Introduction')=>{
    if(from>=to)return
    const body=blocks.slice(from,to),first=body[0]
    const code=first.role==='source-header'?first.text.match(/\b[A-Z]\d{3}\b/)?.[0]:undefined
    const policyTitle=code?body.find(b=>b.id!==first.id&&b.role==='source-header'&&b.origin.part===first.origin.part&&b.text.trim()):undefined
    let title=policyTitle?.text??(first.kind==='heading'?first.text:fallback)
    if(/performance\s+standards/i.test(title)){
      const position=body.slice(1).find(b=>b.text.trim()&&!b.role)
      if(position&&position.text.length<100)title=position.text
    }
    sections.push({id:first.id,title,titleBlock:policyTitle?.id,code,group,blocks:body})
  }
  const mapped=key==='mbc'&&manualParts.every(([id])=>blocks.some(b=>b.id===id))
  if(mapped){
    for(let p=0;p<manualParts.length;p++){
      const [id,title,slug]=manualParts[p],group='part-'+slug
      groups.push({id:group,title})
      const from=blocks.findIndex(b=>b.id===id),to=p+1<manualParts.length?blocks.findIndex(b=>b.id===manualParts[p+1][0]):blocks.length
      const starts=[from]
      const policyParts=new Set<string>()
      for(let i=from+1;i<to;i++){
        const b=blocks[i]
        if(slug==='policies'){
          if(b.role==='source-header'&&/\b[A-Z]\d{3}\b/.test(b.text)&&!policyParts.has(b.origin.part)){starts.push(i);policyParts.add(b.origin.part)}
        }else if(slug==='bylaws'?bylawStarts.has(b.id):b.kind==='heading'&&!b.role&&(b.level===2||/performance\s+standards/i.test(b.text)))starts.push(i)
      }
      for(let i=0;i<starts.length;i++){
        const at=starts[i],code=blocks[at].role==='source-header'?blocks[at].text.match(/\b[A-Z]\d{3}\b/)?.[0]:undefined
        let owner=group
        if(slug==='policies'&&code){
          owner='policies-'+code[0]
          if(!groups.some(g=>g.id===owner)){
            // Prefer the source index's own category heading when present.
            const index=allBlocks(blocks.slice(from,starts[1]??to)),codeAt=index.findIndex(b=>b.text.includes(code))
            const category=codeAt<0?undefined:index.slice(0,codeAt).reverse().find(b=>b.text.trim().length>3&&b.text.trim().length<65&&!/\b[A-Z]\d{3}\b/.test(b.text))
            groups.push({id:owner,title:category?.text??`${code[0]} policies`,parent:group})
          }
        }
        add(at,starts[i+1]??to,owner,title)
      }
    }
  }else{
    let starts=blocks.flatMap((b,i)=>b.kind==='heading'&&(!b.role)&&(/^article-/i.test(b.id)||key==='mbc')?[i]:[])
    if(!starts.length)starts=blocks.flatMap((b,i)=>b.kind==='heading'&&!b.role?[i]:[])
    if(starts[0]!==0)starts.unshift(0)
    starts.forEach((at,i)=>add(at,starts[i+1]??blocks.length))
  }
  const owner=new Map<string,ReferenceSection>()
  for(const s of sections)for(const b of allBlocks(s.blocks))owner.set(b.id,s)
  return {sections,groups,owner}
}
