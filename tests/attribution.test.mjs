import assert from 'node:assert/strict';
import {runAttribution,runLimited,method} from '../server/attribution.mjs';
const config={openaiBaseUrl:'https://mock.invalid/v1',openaiApiKey:'test-only',attributionTimeoutMs:1000};
let saves=0,calls=0;
const store={state:{attribution:[]},save:async()=>{saves++;}};
// Synthetic sequences are for unit tests only and are never published as probes.
const sequence=Array.from({length:310},(_,i)=>(i*53+19)%355+1).join(',');
const mock=async(url,options)=>{
  calls++;const body=JSON.parse(options.body);assert.equal(body.model,'gpt-6-astra');assert.equal(body.tools,undefined);assert.equal(body.store,false);
  return new Response(JSON.stringify({output_text:sequence}),{status:200});
};
const row=await runAttribution(config,store,'gpt-6-astra',mock);
assert.equal(row.status,'completed');assert.equal(calls,3);assert.equal(row.result.used_outputs,3);
assert.equal(row.result.results.length,16);assert.ok(Math.abs(row.result.results.reduce((n,x)=>n+x.probability,0)-1)<1e-10);
assert.equal(row.method.bank_sha256.length,64);assert.ok(saves>=5);
let n=0;
const failed=await runAttribution(config,store,'gpt-6-astra',async()=>++n===2?new Response('data: '+JSON.stringify({type:'response.failed',response:{error:{code:'gateway_concurrency_limit'}}})+'\n\n'):new Response(JSON.stringify({output_text:sequence})));
assert.equal(failed.status,'error');assert.equal(failed.result,undefined);assert.match(failed.samples[1].error,/gateway_concurrency_limit/);
let active=0,max=0,finished=0;
await runLimited([1,2,3,4,5],async()=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,5));active--;finished++;});
assert.equal(max,2);assert.equal(finished,5);
console.log('PASS attribution: three valid outputs, calibrated distribution, streamed failure, bounded concurrency');
