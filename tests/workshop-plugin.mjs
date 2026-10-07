import assert from 'node:assert/strict'
import { workshopBody, hasMark, detail, imageReferences, validateImage, validateEvent, dateValid } from '../supabase/functions/field-notes-mcp/workshop.ts'
const body = '# Case\n\nKeep this.  \n\n![Original](images/abc-123.png){full}\n\n```md\n#project-plan\nProject: Example\n```'
assert.equal(hasMark(body,'project-plan'),false)
const changed = workshopBody(body,'plan',{Project:'Travel case',Version:'2'},false)
assert.ok(changed.startsWith(body)); assert.equal(detail(changed,'Project'),'Travel case'); assert.equal(hasMark(changed,'project-plan'),true)
assert.deepEqual(imageReferences(changed),['abc-123'])
assert.equal(workshopBody(changed,'plan',{Project:'Travel case',Version:'2'},false),changed)
assert.throws(()=>workshopBody(body,'equipment',{},false),/confirmation/)
assert.equal(hasMark(workshopBody(body,'equipment',{Brand:'Makita'},true),'owned'),true)
assert.ok(dateValid('2028-02-29')); assert.equal(dateValid('2026-02-29'),false)
validateEvent({date:'2026-10-07',start_time:'09:00',end_time:'10:00'})
validateEvent({date:'2026-10-07',end_date:'2026-10-09'})
for (const event of [{date:'2026-02-30'},{date:'2026-10-07',end_date:'2026-10-06'},{date:'2026-10-07',start_time:'25:00'},{date:'2026-10-07',end_time:'10:00'},{date:'2026-10-07',start_time:'10:00',end_time:'09:00'},{date:'2026-10-07',end_date:'2026-10-08',start_time:'10:00'}]) assert.throws(()=>validateEvent(event))
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='
assert.equal(validateImage(png,'image/png').ext,'png')
assert.throws(()=>validateImage(png,'image/jpeg'),/do not match/)
assert.throws(()=>validateImage('data:image/png;base64,'+png,'image/png'),/plain base64/)
assert.throws(()=>validateImage(btoa('<svg></svg>'),'image/svg+xml'))
const maxImage=Buffer.alloc(8*1024*1024); Buffer.from('89504e470d0a1a0a','hex').copy(maxImage)
assert.equal(validateImage(maxImage.toString('base64'),'image/png').byteLength,maxImage.length)
assert.throws(()=>validateImage(Buffer.concat([maxImage,Buffer.from([0])]).toString('base64'),'image/png'),/8 MB/)
console.log('PASS plugin validation: source preservation, fenced metadata, ownership, image type/size, and valid calendar ranges')
