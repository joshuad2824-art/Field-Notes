import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
const names=['pdf-adjustments','event-ranges','sync','weather-location','links','home-approved','room-headings']
const out='work/check-results/widgets/regressions';mkdirSync(out,{recursive:true})
const results=[]
async function worker(){while(names.length){const name=names.shift();let output='';const code=await new Promise(resolve=>{const p=spawn(process.execPath,[`tests/${name}.mjs`],{env:process.env});p.stdout.on('data',d=>output+=d);p.stderr.on('data',d=>output+=d);const timer=setTimeout(()=>p.kill('SIGTERM'),300000);p.on('close',code=>{clearTimeout(timer);resolve(code)})});writeFileSync(`${out}/${name}.log`,output);results.push({name,code});console.log((code===0?'PASS ':'FAIL ')+name);if(code!==0)console.error(output.slice(-1800))}}
await Promise.all([worker(),worker()]);writeFileSync(`${out}/report.json`,JSON.stringify(results,null,2));process.exit(results.every(r=>r.code===0)?0:1)
