import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {generateChallenges} from './modeltrace/challenge-browser.js';
import {analyzeGlobalOutputs} from './modeltrace/fingerprint-core.js';
import {readResponsesBody,extractResponsesText,joinResponsesUrl,makeId,sanitizePublicError} from './lib.mjs';

const bankText=await fs.readFile(new URL('./modeltrace/unified_bank.json',import.meta.url),'utf8');
const bank=JSON.parse(bankText);
export const method={name:'ModelTrace',revision:'55a2e4a55170423b484d701e9a82ab62b268c811',bank_sha256:createHash('sha256').update(bankText).digest('hex'),candidates:bank.models.length,source:'https://github.com/xqy2006/ModelTrace'};

export async function runAttribution(config,store,model,fetchImpl=fetch){
  const started=Date.now();
  const row={id:makeId('attribution',started),model,timestamp:new Date(started).toISOString(),status:'running',method,protocol:'responses',reasoning_effort:'provider_default',samples:[]};
  store.state.attribution??=[];store.state.attribution.push(row);await store.save();
  try{
    for(const challenge of generateChallenges(3)){
      const sample={...challenge,status:'running'};row.samples.push(sample);
      try{
        const response=await fetchImpl(joinResponsesUrl(config.openaiBaseUrl),{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${config.openaiApiKey}`},body:JSON.stringify({model,input:[{role:'user',content:[{type:'input_text',text:challenge.prompt}]}],stream:true,store:false,max_output_tokens:4096}),signal:AbortSignal.timeout(config.attributionTimeoutMs||180000)});
        sample.http_status=response.status;
        const raw=await readResponsesBody(response);
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        let json;try{json=JSON.parse(raw);}catch{}
        if(json?.error||['failed','incomplete'].includes(json?.status))throw new Error(`Upstream ${json.status||'error'}: ${json.error?.code||json.incomplete_details?.reason||'invalid_response'}`);
        for(const line of raw.split(/\r?\n/)){
          if(!line.startsWith('data:'))continue;
          let event;try{event=JSON.parse(line.slice(5));}catch{continue;}
          if(['response.failed','response.incomplete','error'].includes(event.type))throw new Error(`${event.type}: ${event.response?.error?.code||event.error?.code||event.code||event.response?.incomplete_details?.reason||'upstream_failure'}`);
        }
        sample.text=extractResponsesText(raw);
        if(!sample.text)throw new Error('No output text');
        sample.status='completed';
      }catch(error){sample.status='error';sample.error=sanitizePublicError(error);}
      await store.save();
    }
    const result=analyzeGlobalOutputs(row.samples,bank);
    row.diagnostics=result.diagnostics;
    if(result.used_outputs!==3)throw new Error(`Insufficient valid samples: ${result.used_outputs}/3`);
    row.result=result;row.status='completed';
  }catch(error){row.status='error';row.error=sanitizePublicError(error);}
  row.elapsed_seconds=Math.round((Date.now()-started)/100)/10;
  await store.save();return row;
}

export async function runLimited(items,fn,concurrency=2){
  let next=0;
  await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{while(next<items.length){const item=items[next++];await fn(item);}}));
}
