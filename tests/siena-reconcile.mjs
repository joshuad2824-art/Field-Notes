import assert from 'node:assert/strict'
import { mergeSienaItems } from '../src/sync/siena-reconcile.ts'
const base={id:'fixture',type:'reminder',body:'Original content',created:10,updated:10,notebook:'church'}
const done={...base,completedAt:20,seenAt:20,updated:20,stateAt:20}
const restored={...base,seenAt:20,updated:30,stateAt:30}
// A later read of an old completion cannot cancel an explicit restore.
const oldRead={...done,seenAt:40,updated:40}
for(const pair of [[restored,oldRead],[oldRead,restored]]){
 const merged=mergeSienaItems(...pair)
 assert.equal(merged.completedAt,undefined);assert.equal(merged.stateAt,30)
 assert.equal(merged.seenAt,40);assert.equal(merged.body,base.body)
}
assert.equal(mergeSienaItems(restored,{...done,completedAt:50,updated:50}).completedAt,50,'a later old-client completion is still a real edit')
const action={...base,type:'note',requiresAction:true,resolvedAt:20,stateAt:20,updated:20}
const retained={...action,retainedAt:30,stateAt:30,updated:30}
assert.equal(mergeSienaItems(retained,{...action,seenAt:40,updated:40}).retainedAt,30)
const reopened={...retained,resolvedAt:undefined,requiresAction:true,stateAt:50,updated:50}
assert.equal(mergeSienaItems(reopened,retained).resolvedAt,undefined)
const released={...retained,retainedAt:undefined,stateAt:60,updated:60}
assert.equal(mergeSienaItems(retained,released).retainedAt,undefined)
const filed={...action,notebook:'new-notebook',stateAt:70,updated:70}
assert.equal(mergeSienaItems(filed,action).notebook,'new-notebook')
const unfiled={...filed,notebook:undefined,stateAt:80,updated:80}
assert.equal(mergeSienaItems(filed,unfiled).notebook,undefined)
const x={...base,notebook:'one',stateAt:100,updated:100},y={...base,notebook:'two',stateAt:100,updated:100}
assert.deepEqual(mergeSienaItems(x,y),mergeSienaItems(y,x),'equal-clock choices converge')
assert.deepEqual(mergeSienaItems(base,base),base,'unchanged legacy rows stay unchanged')
console.log('PASS reversible Siena state: restore/read race, old-client completion, resolution, reopen, release, filing and deterministic convergence')
