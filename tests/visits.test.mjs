import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {VisitCounter} from '../server/visits.mjs';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'obs-visits-'));
try{
  const counter=new VisitCounter(path.join(dir,'visits.json'));await counter.load();
  assert.equal(counter.summary().total_visitors,1000);
  const first=await counter.record();assert.equal(first.stats.total_visitors,1001);
  await Promise.all(Array.from({length:10},()=>counter.record(`obs_visitor=${first.cookie}`)));
  assert.equal(counter.summary().views,11);assert.equal(counter.summary().visitors,1);
  await counter.record('obs_visitor=fake');assert.equal(counter.summary().visitors,2);
  const reloaded=new VisitCounter(counter.file);await reloaded.load();
  assert.deepEqual(reloaded.summary(),counter.summary());assert.equal(reloaded.valid(first.cookie),true);
  console.log('PASS visits: baseline, signed cookie, repeat visitor, concurrent writes, persistence');
}finally{await fs.rm(dir,{recursive:true,force:true});}
