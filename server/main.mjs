import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JsonStore } from './store.mjs';
import { envBool, nextBoundaryMs, positiveInt } from './lib.mjs';
import { runCandyProbe } from './candy.mjs';
import { runPelicanProbe } from './pelican.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const env=process.env;
const config={
  host:env.HOST||'0.0.0.0', port:positiveInt(env.PORT,8080), publicOrigin:env.PUBLIC_ORIGIN||'', publicModelLabel:env.PUBLIC_MODEL_LABEL||'ChatGPT',
  stateFile:path.resolve(root,env.STATE_FILE||'runtime/monitor-state.json'), runOnStart:envBool(env.RUN_ON_START,true),
  openaiBaseUrl:env.OPENAI_BASE_URL||'', openaiApiKey:env.OPENAI_API_KEY||'', candyModel:env.CANDY_MODEL||'', candyReasoningEffort:env.CANDY_REASONING_EFFORT||'', candyTimeoutMs:positiveInt(env.CANDY_TIMEOUT_MS,480000), candyMaxOutputTokens:positiveInt(env.CANDY_MAX_OUTPUT_TOKENS,4096),
  pelicanExecMode:(env.PELICAN_EXEC_MODE||'command').toLowerCase(), codexExecCommandJson:env.CODEX_EXEC_COMMAND_JSON||'', codexExecUrl:env.CODEX_EXEC_URL||'', codexExecKey:env.CODEX_EXEC_KEY||'', codexExecTimeoutMs:positiveInt(env.CODEX_EXEC_TIMEOUT_MS,720000),
  candyHistoryLimit:positiveInt(env.CANDY_HISTORY_LIMIT,1000), pelicanHistoryLimit:positiveInt(env.PELICAN_HISTORY_LIMIT,100)
};
config.candyEnabled=Boolean(config.openaiBaseUrl&&config.openaiApiKey&&config.candyModel);
config.pelicanEnabled=config.pelicanExecMode==='http' ? Boolean(config.codexExecUrl) : Boolean(config.codexExecCommandJson);

const store=new JsonStore(config.stateFile,{candy:config.candyHistoryLimit,pelicans:config.pelicanHistoryLimit});
await store.load();
let candyBusy=false,pelicanBusy=false;
async function candyTick(){if(!config.candyEnabled||candyBusy)return;candyBusy=true;try{await runCandyProbe(config,store);}finally{candyBusy=false;}}
async function pelicanTick(){if(!config.pelicanEnabled||pelicanBusy)return;pelicanBusy=true;try{await runPelicanProbe(config,store);}finally{pelicanBusy=false;}}
function scheduleEvery(minutes,fn){
  const arm=()=>{const delay=Math.max(1000,nextBoundaryMs(Date.now(),minutes)-Date.now());setTimeout(async()=>{try{await fn();}catch(e){console.error(e);}arm();},delay).unref();}; arm();
}
scheduleEvery(10,candyTick); scheduleEvery(30,pelicanTick);
if(config.runOnStart){setTimeout(candyTick,1000).unref();setTimeout(pelicanTick,3000).unref();}

function latestTimestamp(){
  const values=[...(store.state.candy||[]),...(store.state.pelicans||[])].map(x=>Date.parse(x.timestamp)).filter(Number.isFinite);
  return values.length?new Date(Math.max(...values)).toISOString():new Date().toISOString();
}
function publicStatus(){
  const livePelicans=(store.state.pelicans||[]).filter(x=>x?.html).slice().reverse().map(x=>({...x,account_label:'实时探测',provenance:'live'}));
  return {schema_version:1,mode:'live',as_of:latestTimestamp(),next_probe_at:new Date(nextBoundaryMs(Date.now(),10)).toISOString(),candy:store.state.candy||[],pelicans:livePelicans,monitor:{candy_minutes:10,pelican_minutes:30}};
}

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.part':'text/plain; charset=us-ascii','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
function send(res,status,body,type='text/plain; charset=utf-8',extra={}){res.writeHead(status,{'content-type':type,'x-content-type-options':'nosniff','referrer-policy':'no-referrer',...extra});res.end(body);}
async function serveStatic(req,res,url){
  let pathname=decodeURIComponent(url.pathname);
  if(pathname==='/') pathname='/index.html';
  if(pathname.startsWith('/server/')||pathname.startsWith('/runtime/')||pathname.startsWith('/tests/')||pathname.startsWith('/.git')||pathname.startsWith('/.env')) return send(res,404,'Not found');
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)) return send(res,403,'Forbidden');
  try{const data=await fs.readFile(file);send(res,200,data,mime[path.extname(file)]||'application/octet-stream',{'cache-control':pathname==='/index.html'?'no-cache':'public, max-age=300'});}catch(error){send(res,error?.code==='ENOENT'?404:500,error?.code==='ENOENT'?'Not found':'Server error');}
}

const server=http.createServer(async(req,res)=>{
  const base=config.publicOrigin||`http://${req.headers.host||'localhost'}`;
  const url=new URL(req.url||'/',base);
  if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,'Method not allowed');
  if(url.pathname==='/api/status')return send(res,200,JSON.stringify(publicStatus()),'application/json; charset=utf-8',{'cache-control':'no-store'});
  if(url.pathname==='/healthz')return send(res,200,JSON.stringify({ok:true,candy_enabled:config.candyEnabled,pelican_enabled:config.pelicanEnabled,candy_busy:candyBusy,pelican_busy:pelicanBusy,last_candy_at:store.state.health?.last_candy_at||null,last_candy_status:store.state.health?.last_candy_status||null,last_pelican_at:store.state.health?.last_pelican_at||null,last_pelican_status:store.state.health?.last_pelican_status||null}),'application/json; charset=utf-8',{'cache-control':'no-store'});
  return serveStatic(req,res,url);
});
server.listen(config.port,config.host,()=>console.log(`Token Research observatory listening on ${config.host}:${config.port}; candy=${config.candyEnabled?'on':'off'}, pelican=${config.pelicanEnabled?'on':'off'}`));
