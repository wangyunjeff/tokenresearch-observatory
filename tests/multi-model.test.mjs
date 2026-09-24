import http from 'node:http';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'obs-multi-'));
const requests=[];
let active=0,maxActive=0;
const api=http.createServer((req,res)=>{let raw='';req.on('data',x=>raw+=x);req.on('end',()=>{
  const body=JSON.parse(raw);requests.push({...body,authorization:req.headers.authorization});
  active++;maxActive=Math.max(maxActive,active);
  const pelican=Boolean(body.output_file);
  const candy=!pelican&&body.input[0].content[0].text.includes('final_answer');
  const text=candy?''+JSON.stringify({final_answer:body.model==='model-b'?20:21}):Array.from({length:310},(_,i)=>(i*53+19)%355+1).join(',');
  setTimeout(()=>{
    active--;
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify(pelican?{html:'<!doctype html><html><body><svg></svg>'+('sample '.repeat(40))+'</body></html>'}:{output_text:text}));
  },candy?6500:pelican?1000:80);
});});
await new Promise(r=>api.listen(0,'127.0.0.1',r));
const child=spawn(process.execPath,['server/main.mjs'],{env:{...process.env,HOST:'127.0.0.1',PORT:'19334',STATE_FILE:path.join(temp,'state.json'),OPENAI_BASE_URL:`http://127.0.0.1:${api.address().port}/v1`,OPENAI_API_KEY:'mock-secret',PROBE_GROUP_ID:'58',PROBE_GROUP_NAME:'Main group',ATTRIBUTION_EXTRA_GROUPS_JSON:JSON.stringify([{id:'64',name:'Temporary group',apiKeyEnv:'TEST_TEMP_KEY'}]),TEST_TEMP_KEY:'mock-temp-secret',CANDY_MODEL:'model-a',PROBE_MODELS:'model-a,model-b',ATTRIBUTION_ENABLED:'true',RUN_ON_START:'true',PELICAN_EXEC_MODE:'http',CODEX_EXEC_COMMAND_JSON:'',CODEX_EXEC_URL:`http://127.0.0.1:${api.address().port}/pelican`,CODEX_EXEC_KEY:'mock-executor-key'},stdio:'ignore'});
try{
  let data;const deadline=Date.now()+35000;
  while(Date.now()<deadline){try{data=await(await fetch('http://127.0.0.1:19334/api/status')).json();if(data.attribution?.length===4&&data.attribution.every(x=>x.status==='completed'))break;}catch{}await new Promise(r=>setTimeout(r,150));}
  assert.equal(data.candy.length,2);assert.equal(data.attribution.length,4);
  assert.deepEqual(data.models,['model-a','model-b']);
  assert.equal(data.candy.find(x=>x.model_id==='model-a').final_answer,'21');
  assert.equal(data.candy.find(x=>x.model_id==='model-b').final_answer,'20');
  assert.equal(data.attribution.every(x=>x.status==='completed'&&x.samples.length===3),true);
  assert.equal(requests.length,15);assert.equal(data.pelicans.length,1);
  assert.equal(maxActive,1,'Candy, attribution and pelican must never overlap');
  assert.deepEqual(data.attribution_groups.map(g=>g.id),['58','64']);
  assert.equal(data.attribution.filter(r=>r.group_id==='64').length,2);
  assert.equal(requests.filter(r=>r.authorization==='Bearer mock-temp-secret').length,6);
  assert.equal(requests.filter(r=>r.authorization==='Bearer mock-temp-secret').every(r=>!r.input[0].content[0].text.includes('final_answer')),true);
  assert.equal(JSON.stringify(data).includes('mock-secret'),false);
  assert.equal(JSON.stringify(data).includes('mock-temp-secret'),false);
  assert.equal(data.monitor.probe_queue.concurrency,1);
  assert.equal(data.monitor.probe_queue.active,null);
  assert.equal(data.monitor.probe_queue.pending.length,0);
  assert.equal((await fetch('http://127.0.0.1:19334/server/modeltrace/unified_bank.json')).status,404);
  console.log('PASS multi-group integration: attribution-only secondary group, isolated keys/results, global request concurrency=1 including pelican');
}finally{
  const closed=new Promise(r=>child.once('exit',r));child.kill();await closed;await new Promise(r=>api.close(r));await fs.rm(temp,{recursive:true,force:true});
}
