import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tempRoot=await fs.mkdtemp(path.join(os.tmpdir(),'tokenresearch-observatory-test-'));
const stateFile=path.join(tempRoot,'integration-state.json');
const dataDir=path.join(tempRoot,'archive');
await fs.mkdir(dataDir,{recursive:true});
const referenceHtml='<!doctype html><html><body><svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg><p>reference pelican animation sample</p></body></html>';
const encoded=gzipSync(Buffer.from(JSON.stringify({pelicans:[7,10,15,17].map(n=>({trial:n,id:`pelican-${n}`,html:referenceHtml}))}))).toString('base64');
const chunk=Math.ceil(encoded.length/8);
for(let i=0;i<8;i++) await fs.writeFile(path.join(dataDir,`archive-${String(i+1).padStart(2,'0')}.part`),encoded.slice(i*chunk,(i+1)*chunk));

function listen(handler){return new Promise(resolve=>{const s=http.createServer(handler);s.listen(0,'127.0.0.1',()=>resolve(s));});}
const api=await listen((req,res)=>{if(req.url==='/v1/responses'){let b='';req.on('data',c=>b+=c);req.on('end',()=>{const body=JSON.parse(b);assert.equal(body.store,false);assert.match(body.input,/黑色的袋子/);res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:'经过分析，最终答案为 21。'}]}]}));});}else{res.writeHead(404);res.end();}});
const exec=await listen((req,res)=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>{const body=JSON.parse(b);assert.match(body.prompt,/鹈鹕骑自行车/);res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({html:'<!doctype html><html><body><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="10"/><circle cx="30" cy="70" r="20"/><circle cx="70" cy="70" r="20"/><path d="M30 70 L50 40 L70 70 Z"/></svg><style>svg{width:100%;height:100%;animation:ride 1s linear infinite}@keyframes ride{to{transform:translateX(2px)}}</style><script>document.body.dataset.animated="1"</script></body></html>'}));});});
const apiPort=api.address().port, execPort=exec.address().port, appPort=19333;
const child=spawn(process.execPath,['server/main.mjs'],{cwd:root,env:{...process.env,HOST:'127.0.0.1',PORT:String(appPort),STATE_FILE:stateFile,RUN_ON_START:'true',OPENAI_BASE_URL:`http://127.0.0.1:${apiPort}/v1`,OPENAI_API_KEY:'test-secret',CANDY_MODEL:'mock-model',PUBLIC_MODEL_LABEL:'ChatGPT',PELICAN_EXEC_MODE:'http',CODEX_EXEC_URL:`http://127.0.0.1:${execPort}/run`,CODEX_EXEC_KEY:'test-exec-key',REFERENCE_ARCHIVE_DIR:dataDir},stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x);
try{
  const deadline=Date.now()+10000;let status;
  while(Date.now()<deadline){try{const r=await fetch(`http://127.0.0.1:${appPort}/api/status`);if(r.ok){status=await r.json();if(status.candy.length===1&&status.pelicans.length===5)break;}}catch{}await new Promise(r=>setTimeout(r,350));}
  assert.ok(status,'status unavailable');
  assert.equal(status.mode,'live');
  assert.equal(status.candy.length,1);
  assert.equal(status.candy[0].final_answer,'21');
  assert.equal(status.candy[0].status,'completed');
  assert.equal(status.pelicans.length,5);
  assert.equal(status.pelicans[0].account_label,'实时探测');
  assert.equal(status.pelicans.filter(x=>x.account_label==='参考样例').length,4);
  const health=await (await fetch(`http://127.0.0.1:${appPort}/healthz`)).json();
  assert.equal(health.candy_enabled,true);assert.equal(health.pelican_enabled,true);
  console.log('PASS integration: one candy request, one pelican request, public 1 live + 4 labeled references');
}finally{child.kill('SIGTERM');api.close();exec.close();await fs.rm(tempRoot,{recursive:true,force:true});}
