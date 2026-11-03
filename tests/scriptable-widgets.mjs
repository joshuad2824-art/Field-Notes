import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
const core=readFileSync('widgets/scriptable/core.js','utf8')
mkdirSync('work/check-results/widgets',{recursive:true})
const store=new Map(),keychain=new Map(),queue=[]
let requests=[],widget,complete=0,drawings=[]
const escape=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
class Color {constructor(value,alpha=1){this.value=value;this.alpha=alpha}}
class Font {constructor(name,size){this.name=name;this.size=size}static mediumSystemFont(size){return new Font('Arial',size)}static systemFont(size){return new Font('Arial',size)}}
class Rect {constructor(x,y,width,height){Object.assign(this,{x,y,width,height})}}
class Size {constructor(width,height){Object.assign(this,{width,height})}}
class DrawContext {
 constructor(){this.parts=[];drawings.push(this)}
 setFillColor(c){this.fill=c}setStrokeColor(c){this.stroke=c}setLineWidth(n){this.line=n}setFont(f){this.font=f}setTextColor(c){this.color=c}setTextAlignedCenter(){}
 fillEllipse(r){this.parts.push(`<ellipse cx="${r.x+r.width/2}" cy="${r.y+r.height/2}" rx="${r.width/2}" ry="${r.height/2}" fill="${this.fill.value}" opacity="${this.fill.alpha}"/>`)}
 strokeEllipse(r){this.parts.push(`<ellipse cx="${r.x+r.width/2}" cy="${r.y+r.height/2}" rx="${r.width/2}" ry="${r.height/2}" fill="none" stroke="${this.stroke.value}" stroke-opacity="${this.stroke.alpha}" stroke-width="${this.line}"/>`)}
 drawTextInRect(text,r){this.parts.push(`<text x="${r.x+r.width/2}" y="${r.y+this.font.size}" fill="${this.color.value}" font-family="${this.font.name}" font-size="${this.font.size}" text-anchor="middle">${escape(text)}</text>`)}
 getImage(){return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${this.size.width}" height="${this.size.height}" viewBox="0 0 ${this.size.width} ${this.size.height}"><rect width="100%" height="100%" fill="#14322e"/>${this.parts.join('')}</svg>`,size:this.size}}
}
class Stack {
 constructor(){this.items=[]}
 addText(value){const item={type:'text',value,centerAlignText(){}};this.items.push(item);return item}
 addImage(value){const item={type:'image',value,applyFittingContentMode(){}};this.items.push(item);return item}
 addSpacer(size){this.items.push({type:'space',size})}
 addStack(){const s=new Stack();this.items.push(s);return s}
 centerAlignContent(){}setPadding(){}async presentSmall(){}async presentMedium(){}async presentLarge(){}
}
class Request {constructor(url){this.url=url}async loadString(){requests.push(this);const next=queue.shift();if(next instanceof Error)throw next;if(!next)throw Error('Unexpected request');this.response={statusCode:next.status};return JSON.stringify(next.body)}}
const context=vm.createContext({Date,Intl,JSON,Array,Object,String,Number,Set,Math,Error,Color,Font,Rect,Size,DrawContext,ListWidget:Stack,Request,
 config:{runsInWidget:true,widgetFamily:'large'},
 SFSymbol:{named:()=>({applyFont(){},image:{symbol:true}})},
 Keychain:{contains:k=>keychain.has(k),get:k=>keychain.get(k),set:(k,v)=>keychain.set(k,v),remove:k=>keychain.delete(k)},
 FileManager:{local:()=>({cacheDirectory:()=>'/cache',joinPath:(a,b)=>a+'/'+b,fileExists:p=>store.has(p),readString:p=>store.get(p),writeString:(p,v)=>store.set(p,v),remove:p=>store.delete(p)})},
 Script:{setWidget:w=>widget=w,complete:()=>complete++}})
vm.runInContext(core,context)
const call=(name,...args)=>context[name](...args)
const now=new Date('2026-11-03T12:00:00'),snapshot={version:1,from:'2026-10-01',to:'2026-12-31',timezone:'America/Chicago',written:['2026-11-03'],events:['2026-11-03','2026-11-04'],sources:{davis:'ready',apple:'setup',work:'ready'}}
const body={snapshot,updatedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()}
const setup={version:1,url:'https://fictional.supabase.co',publicKey:'fictional-public-key-for-tests',token:'c'.repeat(64)}
assert.ok(call('decodeSetup',JSON.stringify(setup)))
for(const bad of [{...setup,key:'vault-secret'},{...setup,url:'https://attacker.invalid'},{...setup,token:'bad'}])assert.throws(()=>call('decodeSetup',JSON.stringify(bad)))
for(const bad of [{...body,snapshot:{...snapshot,timezone:'PrivateEventTitle'}},{...body,snapshot:{...snapshot,title:'private'}},{...body,snapshot:{...snapshot,written:['2026-02-30']}},{...body,snapshot:{...snapshot,sources:{work:'private'}}}])assert.throws(()=>call('decodeSnapshot',bad))
for(let year=2024;year<=2028;year++)for(let month=0;month<12;month++){
 const days=call('monthDays',new Date(year,month,15,12));assert.ok([35,42].includes(days.length));assert.equal(new Date(days[0].iso+'T12:00:00').getDay(),0);assert.equal(days.filter(d=>d.inMonth).length,new Date(year,month+1,0).getDate())
}
assert.equal(call('monthDays',new Date(2026,7,15,12)).length,42,'six-week month')
assert.equal(call('monthDays',new Date(2024,1,15,12)).filter(d=>d.inMonth).length,29,'leap year')
keychain.set('field-notes.calendar.v1',JSON.stringify({...setup,cacheId:'fixture'}))
queue.push({status:200,body});let result=await call('readCalendar');assert.ok(result.body)
assert.ok(!requests[0].url.includes(setup.token),'token not in URL');assert.ok(!('x-vault-key' in requests[0].headers))
assert.deepEqual(JSON.parse(requests[0].body),{p_token:setup.token})
queue.push(Error('offline'));result=await call('readCalendar');assert.ok(result.body);assert.match(result.status,/Offline/)
queue.push({status:200,body:null});result=await call('readCalendar');assert.equal(result.body,null)
queue.push(Error('offline'));result=await call('readCalendar');assert.equal(result.body,null,'revocation response clears cache')
keychain.set('field-notes.calendar.v1',JSON.stringify({...setup,cacheId:'different-device'}));queue.push(Error('offline'));assert.equal((await call('readCalendar')).body,null,'new connection never inherits old cache')
queue.push({status:200,body:{...body,expiresAt:new Date(Date.now()-1000).toISOString()}});assert.equal((await call('readCalendar')).body,null,'expired key discarded')
keychain.clear();requests=[]
const weather={current:{temperature_2m:66,weather_code:2,is_day:0},daily:{time:['2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07'],temperature_2m_max:[70,68,64,67,72],temperature_2m_min:[45,44,41,42,46],weather_code:[2,3,61,0,1]}}
for(const family of ['small','medium','large','extraLarge'])for(const [kind,file] of [['calendar','Calendar'],['weather','Weather'],['note','Quick Note'],['date','Date']]) {
 context.config.widgetFamily=family
 if(kind==='weather')queue.push({status:200,body:weather})
 await call('run',kind)
 assert.ok(widget);assert.ok(widget.url.startsWith('https://timber-inkfieldnotes.netlify.app/'))
 assert.ok(complete>0)
 const generated=readFileSync('widgets/scriptable/Field Notes '+file+'.js','utf8')
 assert.ok(generated.includes(core));assert.ok(!generated.includes('fictional-public'))
}
assert.equal(call('condition',0,false).symbol,'moon.stars')
assert.equal(call('condition',95,true).symbol,'cloud.bolt.rain')
assert.throws(()=>call('decodeWeather',{current:{temperature_2m:null}}))
queue.push(Error('offline'));assert.equal((await call('readWeather')).offline,true)
for(const family of ['small','medium','large']) {
 const image=call('calendarImage',now,{body,status:null},family)
 writeFileSync('work/check-results/widgets/calendar-'+family+'.svg',image.svg)
}
const sixweek=call('calendarImage',new Date('2026-08-03T12:00:00'),{body:null,status:'Marks not connected'},'large');writeFileSync('work/check-results/widgets/calendar-six-week.svg',sixweek.svg)
console.log('PASS Scriptable API simulation: four scripts × four families; 60 month grids, leap/six-week months; setup and response validation; secret-free URLs and no vault header; offline cache, revoked/expired key handling, cache isolation; weather errors and night symbols. SVG evidence generated; native rendering unverified.')
