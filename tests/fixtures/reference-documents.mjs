// Invented documents with the same navigation depth; no private source excerpts.
import {createHash} from 'node:crypto'
const hash=value=>createHash('sha256').update(value).digest('hex')
const roman=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII']
const articleTitles=['Attentive reading','A shared question','Words in context','The whole passage','Listening carefully','A clear connection','Learning together','Time to reflect','Ideas and practice','A useful distinction','Returning to the text','Making room','A considered response','Steady attention','A wider perspective','The next conversation','What remains','Reading again']
const bylawIds=[203,224,286,313,333,336,339]
// Invented codes and labels: the same counts per category and two numbering gaps
// (K108, P105), so the shape is exercised without the source's own index.
const policyCodes=['K101','K102','K103','K104','K105','K106','K107','K109','L101','N101','N102','P101','P102','P103','P104','P106',...Array.from({length:12},(_,i)=>'R'+String(101+i)),'T101','W101']
const categories={K:'Ledger care',L:'Lantern fund',N:'Trail crews',P:'Workshop roles',R:'Hall spaces',T:'Wagons',W:'Odds and ends'}
export function referenceFixture(key){
 let serial=0;const blocks=[],origin=(part='synthetic')=>({part,paragraph:++serial})
 const p=(text,id='sample-'+key+'-'+serial,extra={})=>blocks.push({id,kind:'paragraph',text,origin:origin(),...extra})
 const h=(text,id,level=2)=>blocks.push({id,kind:'heading',text,level,origin:origin()})
 const prose=(n,label)=>{for(let i=0;i<n;i++)p(`${label} · sample paragraph ${i+1}. This fictional passage is used to check reading rhythm, exact search snippets, and navigation. ${i%4===0?'October sample: Café, œ and ﬃ stay exactly as written.':''}`)}
 const table=(id,wide=false)=>{
  const labels=wide?['Request','Date','Prepared by','Category','Review','Record']:['Field','Entry']
  blocks.push({id,kind:'heading',level:3,text:'Synthetic request form',origin:origin()})
  blocks.push({id:id+'-table',kind:'table',text:'',origin:origin(),rows:[{header:true,cells:labels.map((text,i)=>({span:1,blocks:[{id:id+'-label-'+i,kind:'paragraph',text,origin:origin()}]}))},...Array.from({length:wide?18:3},(_,r)=>({header:false,cells:labels.map((_,c)=>({span:1,blocks:[{id:id+`-cell-${r}-${c}`,kind:'paragraph',text:c===0?'Sample field '+(r+1):'________________',origin:origin()}]}))}))]})
 }
 if(key==='bfm'){
  p('Opening pages for a fictional reading collection. These samples demonstrate structure without reproducing the private reference.','sample-bfm-opening')
  roman.forEach((number,i)=>{h(`${number}. ${articleTitles[i]}`,'article-'+number.toLowerCase());prose(6,'Article '+number);if(i===5)p('A fictional lantern, harbor and compass appear only as exact search query tokens.','sample-officers')})
 }else{
  h('Synthetic manual','word-document-xml-p1');prose(8,'Opening pages')
  h('Constitution & confession','word-document-xml-p105');prose(14,'Foundations');p('This synthetic embedded confession uses its own distinct sample wording.','sample-older-confession')
  h('Bylaws','word-document-xml-p201');roman.slice(0,7).forEach((n,i)=>{h('Article '+n+' · Sample bylaw '+(i+1),'word-document-xml-p'+bylawIds[i],3);prose(10,'Bylaw '+n)})
  h('Deacon ministry','word-document-xml-p345');prose(14,'Ministry');table('sample-deacon-form')
  h('Staffing','word-document-xml-p478');prose(12,'Staffing');for(let i=0;i<14;i++){h('Sample role '+(i+1),'sample-role-'+i);prose(28,'Role '+(i+1))}
  h('Policies & procedures','word-header2-xml-p1')
  // Some source index labels live inside table cells, not root paragraphs.
  blocks.push({id:'sample-policy-index',kind:'table',text:'',origin:origin(),rows:Object.entries(categories).map(([letter,label])=>({header:false,cells:[{span:1,blocks:[{id:'category-'+letter,kind:'paragraph',text:label,origin:origin()}]},{span:1,blocks:policyCodes.filter(c=>c[0]===letter).map(code=>({id:'index-'+code,kind:'paragraph',text:code+' · Synthetic policy index',origin:origin()}))}]}))})
  policyCodes.forEach((code,i)=>{
   const part='word/header'+(i+4)+'.xml',title=code==='L101'?'Synthetic Lantern Fund request':code==='R101'?'Synthetic hall use':'Sample '+categories[code[0]].toLowerCase()+' policy '+code
   p(code+' · Synthetic manual','policy-'+code,{kind:'heading',level:3,role:'source-header',origin:origin(part)})
   p(title,'policy-title-'+code,{role:'source-header',origin:origin(part)})
   prose(code==='L101'?100:40,title)
   if(['L101','R101','R102'].includes(code))table('sample-form-'+code,code==='L101')
  })
  h('Appendix & history','word-document-xml-p2342');prose(16,'Appendix')
 }
 const raw=Buffer.from('Original fictional '+key+' document. A synthetic package for local design checks only.')
 return {format:'field-notes-private-reference',version:1,key,source:{filename:key+'-synthetic.txt',sha256:hash(raw),bytes:raw.length,base64:raw.toString('base64')},blocks,assets:{},contentSha256:hash(JSON.stringify(blocks)),coverage:{synthetic:true},synthetic:true}
}
export const referenceFixtures=()=>['bfm','mbc'].map(referenceFixture)
