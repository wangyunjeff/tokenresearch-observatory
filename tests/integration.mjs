import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tempRoot=await fs.mkdtemp(path.join(os.tmpdir(),'tokenresearch-observatory-test-'));
const stateFile=path.join(tempRoot,'integration-state.json');
const priorPelican={id:'pelican-prior',trial:1,account_label:'实时探测',timestamp:'2026-09-14T05:30:00.000Z',date:'',model:'mock-model',reasoning_effort:'executor',elapsed_seconds:12.3,review_status:'unreviewed',retried:false,provenance:'live',html:'<!doctype html><html><body><svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg><p>prior live pelican animation</p></body></html>'};
await fs.writeFile(stateFile,JSON.stringify({schema_version:1,candy:[],pelicans:[priorPelican],health:{}}));

function listen(handler){return new Promise(resolve=>{const s=http.createServer(handler);s.listen(0,'127.0.0.1',()=>resolve(s));});}
const api=await listen((req,res)=>{if(req.url==='/v1/responses'){let b='';req.on('data',c=>b+=c);req.on('end',()=>{const body=JSON.parse(b);const inputText=Array.isArray(body.input)?body.input.flatMap(x=>x.content||[]).map(x=>x.text||'').join(''):body.input;assert.equal(body.store,false);assert.equal(body.stream,true);assert.match(inputText,/五角星形/);assert.match(inputText,/final_answer/);res.writeHead(200,{'content-type':'text/event-stream'});res.end(['event: response.output_text.delta\ndata: '+JSON.stringify({type:'response.output_text.delta',delta:'{"final_answer":21,"reason":"20 颗仍可能失败；第 21 颗一定成功。"}'})+'\n\n','event: response.completed\ndata: '+JSON.stringify({type:'response.completed',response:{output:[]}})+'\n\n'].join(''));});}else{res.writeHead(404);res.end();}});
const exec=await listen((req,res)=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>{const body=JSON.parse(b);assert.match(body.prompt,/鹈鹕骑自行车/);res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({html:'<!doctype html><html><body><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="10"/><circle cx="30" cy="70" r="20"/><circle cx="70" cy="70" r="20"/><path d="M30 70 L50 40 L70 70 Z"/></svg><style>svg{width:100%;height:100%;animation:ride 1s linear infinite}@keyframes ride{to{transform:translateX(2px)}}</style><script>document.body.dataset.animated="1"</script></body></html>'}));});});
const apiPort=api.address().port, execPort=exec.address().port, appPort=19333;
const child=spawn(process.execPath,['server/main.mjs'],{cwd:root,env:{...process.env,HOST:'127.0.0.1',PORT:String(appPort),STATE_FILE:stateFile,RUN_ON_START:'true',OPENAI_BASE_URL:`http://127.0.0.1:${apiPort}/v1`,OPENAI_API_KEY:'test-secret',CANDY_MODEL:'mock-model',PUBLIC_MODEL_LABEL:'ChatGPT',PELICAN_EXEC_MODE:'http',CODEX_EXEC_URL:`http://127.0.0.1:${execPort}/run`,CODEX_EXEC_KEY:'test-exec-key'},stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x);
try{
  const deadline=Date.now()+10000;let status;
  while(Date.now()<deadline){try{const r=await fetch(`http://127.0.0.1:${appPort}/api/status`);if(r.ok){status=await r.json();if(status.candy.length===1&&status.candy[0]?.status==='completed'&&status.candy[0]?.final_answer==='21'&&status.pelicans.length===2)break;}}catch{}await new Promise(r=>setTimeout(r,350));}
  assert.ok(status,'status unavailable');
  assert.equal(status.mode,'live');
  assert.equal(status.candy.length,1);
  assert.equal(status.candy[0].final_answer,'21');
  assert.equal(status.candy[0].status,'completed');
  assert.equal(status.pelicans.length,2);
  assert.equal(status.pelicans[0].account_label,'实时探测');
  assert.equal(status.pelicans[0].provenance,'live');
  assert.equal(status.pelicans[1].id,'pelican-prior');
  assert.ok(Date.parse(status.pelicans[0].timestamp)>Date.parse(status.pelicans[1].timestamp));
  const health=await (await fetch(`http://127.0.0.1:${appPort}/healthz`)).json();
  assert.equal(health.candy_enabled,true);assert.equal(health.pelican_enabled,true);
  console.log('PASS integration: one candy request, one pelican request, public real pelican history newest first');
}finally{child.kill('SIGTERM');api.close();exec.close();await fs.rm(tempRoot,{recursive:true,force:true});}
