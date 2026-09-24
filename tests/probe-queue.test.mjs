import assert from 'node:assert/strict';
import {ProbeQueue} from '../server/probe-queue.mjs';
import {attributionGroups} from '../server/probe-groups.mjs';

const queue=new ProbeQueue(),order=[];
let active=0,max=0;
const work=label=>queue.run(label,async()=>{
  active++;max=Math.max(max,active);order.push(label);
  assert.equal(queue.summary().active,label);
  await new Promise(r=>setTimeout(r,10));
  active--;
  if(label==='failure')throw new Error('expected failure');
  return label;
});
const results=await Promise.allSettled(['candy','failure','pelican','group64'].map(work));
assert.equal(max,1);
assert.deepEqual(order,['candy','failure','pelican','group64']);
assert.equal(results[1].status,'rejected');
assert.equal(results[3].value,'group64');
assert.deepEqual(queue.summary(),{concurrency:1,active:null,pending:[]});
const config={openaiBaseUrl:'https://mock.invalid/v1',openaiApiKey:'main-test-key'};
const env={PROBE_GROUP_ID:'58',ATTRIBUTION_EXTRA_GROUPS_JSON:JSON.stringify([{id:64,name:'Temp',apiKeyEnv:'TEMP_KEY'}]),TEMP_KEY:'secondary-test-key'};
const groups=attributionGroups(env,config,['model-a']);
assert.deepEqual(groups.map(g=>g.groupId),['58','64']);
assert.equal(groups[1].openaiApiKey,'secondary-test-key');
assert.deepEqual(groups[1].models,['model-a']);
assert.throws(()=>attributionGroups({...env,TEMP_KEY:''},config,['model-a']),/configured API key/);
assert.throws(()=>attributionGroups({...env,PROBE_GROUP_ID:'64'},config,['model-a']),/unique id/);
console.log('PASS shared serial queue, error recovery, group validation and credential separation');
