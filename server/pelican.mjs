import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { PELICAN_PROMPT } from './prompts.mjs';
import { makeId, sanitizePublicError } from './lib.mjs';

function validateHtml(html) {
  const text = String(html || '');
  if (text.length < 200) throw new Error('executor returned an empty or too-small HTML file');
  if (text.length > 250_000) throw new Error('executor HTML exceeds 250 KB public limit');
  return {html:text, review_status:/<svg[\s>]/i.test(text) ? 'unreviewed' : 'flagged'};
}

async function commandExec(config) {
  let command;
  try { command = JSON.parse(config.codexExecCommandJson); } catch { throw new Error('CODEX_EXEC_COMMAND_JSON must be a JSON string array'); }
  if (!Array.isArray(command) || !command.length || command.some(x => typeof x !== 'string' || !x)) throw new Error('CODEX_EXEC_COMMAND_JSON must contain command and arguments');
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(),'pelican-probe-'));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.codexExecTimeoutMs);
  try {
    await new Promise((resolve,reject) => {
      const child = spawn(command[0], command.slice(1), {cwd, stdio:['pipe','pipe','pipe'], signal:controller.signal, env:{...process.env, PWD:cwd}});
      let stderr='';
      child.stderr.on('data', chunk => { if (stderr.length < 20_000) stderr += chunk; });
      child.on('error',reject);
      child.on('close', code => code === 0 ? resolve() : reject(new Error(`Codex Exec exited ${code}: ${stderr.slice(-800)}`)));
      child.stdin.end(PELICAN_PROMPT);
    });
    return validateHtml(await fs.readFile(path.join(cwd,'index.html'),'utf8'));
  } finally {
    clearTimeout(timer);
    await fs.rm(cwd,{recursive:true,force:true});
  }
}

async function httpExec(config, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.codexExecTimeoutMs);
  try {
    const headers={'content-type':'application/json'};
    if (config.codexExecKey) headers.authorization=`Bearer ${config.codexExecKey}`;
    const response = await fetchImpl(config.codexExecUrl,{method:'POST',headers,body:JSON.stringify({prompt:PELICAN_PROMPT,output_file:'index.html'}),signal:controller.signal});
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Codex Exec HTTP ${response.status}`);
    return validateHtml(payload?.html ?? payload?.files?.['index.html']);
  } finally { clearTimeout(timer); }
}

export async function runPelicanProbe(config, store, fetchImpl = fetch) {
  const started=Date.now();
  try {
    const result = config.pelicanExecMode === 'http' ? await httpExec(config,fetchImpl) : await commandExec(config);
    const record={
      id:makeId('pelican',started), trial:store.state.pelicans.length+1,
      account_label:'实时探测', timestamp:new Date(started).toISOString(), date:'',
      model:config.publicModelLabel, reasoning_effort:'executor',
      elapsed_seconds:Math.round((Date.now()-started)/100)/10,
      review_status:result.review_status, retried:false, html:result.html, provenance:'live'
    };
    store.state.pelicans.push(record);
    store.state.health.last_pelican_at=new Date().toISOString();
    store.state.health.last_pelican_status='completed';
    await store.save();
    return record;
  } catch (error) {
    store.state.health.last_pelican_at=new Date().toISOString();
    store.state.health.last_pelican_status='error';
    store.state.health.last_pelican_error=sanitizePublicError(error?.name === 'AbortError' ? new Error('executor timeout') : error);
    await store.save();
    return null;
  }
}
