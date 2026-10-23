import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'
import {referenceFixtures} from './fixtures/reference-documents.mjs'
const code=ts.transpileModule(await readFile('src/theology/reference-navigation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const {referenceNavigation}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))
const all=blocks=>blocks.flatMap(b=>[b,...(b.rows??[]).flatMap(row=>row.cells.flatMap(c=>all(c.blocks)))])
for(const doc of referenceFixtures()){
 const before=JSON.stringify(doc),model=referenceNavigation(doc.key,doc.blocks)
 assert.deepEqual(model.sections.flatMap(s=>s.blocks),doc.blocks,'Source order and every complete root block stay exact')
 assert.equal(model.owner.size,all(doc.blocks).length,'Every nested form/table anchor has an owner')
 assert.equal(new Set(model.sections.map(s=>s.id)).size,model.sections.length)
 for(const section of model.sections){assert.equal(section.id,section.blocks[0].id);for(const b of all(section.blocks))assert.equal(model.owner.get(b.id),section);if(section.group)assert.ok(model.groups.some(g=>g.id===section.group))}
 if(doc.key==='bfm'){assert.equal(model.sections.length,19);assert.equal(model.sections.filter(s=>/^article-/.test(s.id)).length,18)}
 else{
  assert.equal(model.groups.filter(g=>!g.parent).length,7);assert.equal(model.groups.filter(g=>g.parent==='part-policies').length,7);assert.deepEqual(model.groups.filter(g=>g.parent==='part-policies').map(g=>g.title),['Ledger care','Lantern fund','Trail crews','Workshop roles','Hall spaces','Wagons','Odds and ends'],'Category labels come from the original index table cells')
  const policies=model.sections.filter(s=>s.code);assert.equal(policies.length,30);assert.equal(new Set(policies.map(s=>s.code)).size,30);assert.ok(!policies.some(s=>['K108','P105'].includes(s.code)))
  for(const policy of policies){assert.equal(policy.title,policy.blocks.find(b=>b.id!==policy.id&&b.role==='source-header'&&b.origin.part===policy.blocks[0].origin.part).text);assert.equal(policy.titleBlock,policy.blocks.find(b=>b.text===policy.title).id);assert.ok(policy.group.startsWith('policies-'))}
  assert.equal(model.owner.get('sample-form-L101-cell-17-5').code,'L101','Last cell of a long form links to its exact policy')
 }
 assert.equal(JSON.stringify(doc),before,'Navigation cannot rewrite the immutable source package')
 console.log('PASS reference navigation',doc.key,model.sections.length,'sections',model.owner.size,'exact anchors')
}
// A missing pinned boundary must fall back to source headings, preserving all text.
const fallback=[{id:'one',kind:'heading',level:2,text:'Sample opening',origin:{part:'fixture'}},{id:'two',kind:'paragraph',text:'Exact punctuation: — Café.',origin:{part:'fixture'}},{id:'three',kind:'heading',level:3,text:'Another sample',origin:{part:'fixture'}}]
assert.deepEqual(referenceNavigation('mbc',fallback).sections.flatMap(s=>s.blocks),fallback)
console.log('PASS source-heading fallback')
