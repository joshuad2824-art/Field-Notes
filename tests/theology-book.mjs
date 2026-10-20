import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {parseStudySource,sourceHash,sectionSource,verifySpans} from '../src/theology/source.ts'
import {readingFor,searchStudy} from '../src/theology/reading.ts'
import {DAILY_DOCTRINE} from '../src/theology/model.ts'
if(!process.env.STUDY_SOURCE){console.log('SKIP actual private book: provide STUDY_SOURCE outside repository');process.exit(0)}
const source=new Uint8Array(await readFile(process.env.STUDY_SOURCE)),id=await sourceHash(source),text=new TextDecoder().decode(source)
assert.equal(id,DAILY_DOCTRINE.sha256);assert.equal(source.length,DAILY_DOCTRINE.bytes)
const edition={scope:'private-local-check',id,title:DAILY_DOCTRINE.title,filename:DAILY_DOCTRINE.filename,source,bytes:source.length,imported:1,...parseStudySource(source)}
assert.ok(verifySpans(edition));assert.deepEqual(Buffer.concat(edition.sections.map(s=>Buffer.from(source.slice(s.from,s.to)))),Buffer.from(source))
const readings=edition.sections.filter(s=>s.reading),weeks=[...new Set(readings.map(s=>s.week))],topics=[...new Set(readings.map(s=>s.topic))]
assert.deepEqual(readings.map(s=>s.reading),Array.from({length:260},(_,i)=>i+1));assert.deepEqual(weeks,Array.from({length:52},(_,i)=>i+1));assert.equal(topics.length,9)
assert.ok(readings.every(s=>s.title.includes(' · ')&&s.sourceLocation));assert.ok(weeks.every(w=>readings.filter(s=>s.week===w).length===5))
assert.equal(new TextDecoder().decode(source.slice(edition.sourceBoundary)).slice(0,13),'# Source text')
assert.ok(edition.sections.filter(s=>s.role==='aid').every(s=>s.to<=edition.sourceBoundary))
const anchorNames=[...text.matchAll(/<a\s+(?:id|name)=["']([^"']+)["'][^>]*>\s*<\/a>/gi)].map(m=>m[1]),links=[...text.matchAll(/\]\(#([^)]*)\)/g)].map(m=>m[1])
assert.equal(anchorNames.length,675);assert.equal(new Set(anchorNames).size,675);assert.equal(links.length,4523);assert.equal(Object.keys(edition.anchors).length,675)
for(const target of links){const anchor=edition.anchors[target];assert.ok(anchor);const section=edition.sections.find(s=>s.id===anchor.section);assert.ok(section&&anchor.offset>=0&&anchor.offset<section.to-section.from)}
for(let n=1;n<=260;n++){const target=edition.anchors['day-'+String(n).padStart(3,'0')];assert.equal(edition.sections.find(s=>s.id===target.section).reading,n)}
let displayedLinks=0,tableRows=0,noteReadings=0
for(const s of edition.sections){const r=readingFor(edition,s.id);displayedLinks+=r.blocks.flatMap(b=>b.runs).filter(r=>r.href?.startsWith('#')).length;tableRows+=r.blocks.filter(b=>b.kind==='table-row').length;assert.ok(!r.text.includes('<!-- Source:'));assert.ok(r.blocks.every(b=>b.sourceByte>=0&&b.sourceByte<sectionSource(edition,s).length*4));if(s.reading&&r.blocks.some(b=>b.kind==='list'&&/^\d/.test(b.marker??'')))noteReadings++}
assert.equal(displayedLinks,4523);assert.ok(tableRows>=2000)
const searchSections=edition.sections.filter(s=>/^(?:Front matter|Introduction|Appendix|Works Cited|General Index|Scripture Index|Closing publisher)/.test(s.title))
for(const s of searchSections){const r=readingFor(edition,s.id),word=r.blocks.slice(1).flatMap(b=>b.runs).map(r=>r.text).join(' ').match(/\b[A-Za-z]{8,}\b/)?.[0];assert.ok(word);assert.ok(searchStudy(edition,word).some(hit=>hit.section===s.id),'search must reach '+s.title)}
for(const s of [readings[0],readings[259]]){const phrase=readingFor(edition,s.id).blocks.find(b=>b.kind==='paragraph')?.runs.map(r=>r.text).join('').split(/\s+/).slice(0,5).join(' ');assert.ok(searchStudy(edition,phrase).some(hit=>hit.section===s.id))}
const result={sha256:id,bytes:source.length,exactReconstruction:true,sections:edition.sections.length,readings:readings.length,weeks:weeks.length,topics:topics.length,anchors:anchorNames.length,internalLinks:links.length,renderedInternalLinks:displayedLinks,missingTargets:0,tableRows,readingsWithNumberedNotes:noteReadings,referenceSearch:true,sourceBoundary:edition.sourceBoundary,pdfFidelityVerified:false}
await mkdir('work/check-results/theology',{recursive:true});await writeFile('work/check-results/theology/actual-book-checks.json',JSON.stringify(result,null,2));console.log('PASS actual private Markdown:',JSON.stringify(result))
