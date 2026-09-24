import http from 'node:http';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'obs-multi-'));
const requests=[];
const api=http.createServer((req,res)=>{let raw='';req.on('data',x=>raw+=x);req.on('end',()=>{
  const body=JSON.parse(raw);requests.push(body);
  const candy=body.input[0].content[0].text.includes('final_answer');
  const text=candy?''+JSON.stringify({final_answer:body.model==='model-b'?20:21}):Array.from({length:310},(_,i)=>(i*53+19)%355+1).join(',');
  res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({output_text:text}));
});});
await new Promise(r=>api.listen(0,'127.0.0.1',r));
const child=spawn(process.execPath,['server/main.mjs'],{env:{...process.env,HOST:'127.0.0.1',PORT:'19334',STATE_FILE:path.join(temp,'state.json'),OPENAI_BASE_URL:`http://127.0.0.1:${api.address().port}/v1`,OPENAI_API_KEY:'mock-secret',CANDY_MODEL:'model-a',PROBE_MODELS:'model-a,model-b',ATTRIBUTION_ENABLED:'true',RUN_ON_START:'true',PELICAN_EXEC_MODE:'command',CODEX_EXEC_COMMAND_JSON:'',CODEX_EXEC_URL:''},stdio:'ignore'});
try{
  let data;const deadline=Date.now()+22000;
  while(Date.now()<deadline){try{data=await(await fetch('http://127.0.0.1:19334/api/status')).json();if(data.attribution?.length===2&&data.attribution.every(x=>x.status==='completed'))break;}catch{}await new Promise(r=>setTimeout(r,150));}
  assert.equal(data.candy.length,2);assert.equal(data.attribution.length,2);
  assert.deepEqual(data.models,['model-a','model-b']);
  assert.equal(data.candy.find(x=>x.model_id==='model-a').final_answer,'21');
  assert.equal(data.candy.find(x=>x.model_id==='model-b').final_answer,'20');
  assert.equal(data.attribution.every(x=>x.status==='completed'&&x.samples.length===3),true);
  assert.equal(requests.length,8);assert.equal(data.pelicans.length,0);
  assert.equal((await fetch('http://127.0.0.1:19334/server/modeltrace/unified_bank.json')).status,404);
  console.log('PASS multi-model integration: independent candy results, three challenges/model, no pelican fanout');
}finally{
  const closed=new Promise(r=>child.once('exit',r));child.kill();await closed;await new Promise(r=>api.close(r));await fs.rm(temp,{recursive:true,force:true});
}
