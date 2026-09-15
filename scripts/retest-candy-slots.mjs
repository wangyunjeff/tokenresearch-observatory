import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JsonStore } from '../server/store.mjs';
import { positiveInt } from '../server/lib.mjs';
import { runCandyProbe } from '../server/candy.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const args = process.argv.slice(2);
const value = name => {
  const prefix = `${name}=`;
  const arg = args.find(item => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : '';
};
const from = value('--from');
const to = value('--to');
if (!Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to)) || Date.parse(to) <= Date.parse(from)) {
  throw new Error('Usage: node scripts/retest-candy-slots.mjs --from=<ISO> --to=<ISO>');
}

const env = process.env;
const config = {
  stateFile: path.resolve(root, env.STATE_FILE || 'runtime/monitor-state.json'),
  openaiBaseUrl: env.OPENAI_BASE_URL || '',
  openaiApiKey: env.OPENAI_API_KEY || '',
  candyModel: env.CANDY_MODEL || '',
  candyReasoningEffort: env.CANDY_REASONING_EFFORT || '',
  candyTimeoutMs: positiveInt(env.CANDY_TIMEOUT_MS, 480000),
  candyMaxOutputTokens: positiveInt(env.CANDY_MAX_OUTPUT_TOKENS, 4096),
  candyHistoryLimit: positiveInt(env.CANDY_HISTORY_LIMIT, 1000),
  pelicanHistoryLimit: positiveInt(env.PELICAN_HISTORY_LIMIT, 100)
};
if (!config.openaiBaseUrl || !config.openaiApiKey || !config.candyModel) throw new Error('Candy probe credentials are not configured');

const store = new JsonStore(config.stateFile, {candy: config.candyHistoryLimit, pelicans: config.pelicanHistoryLimit});
await store.load();
const targets = store.state.candy.filter(row => {
  const timestamp = Date.parse(row?.timestamp);
  return row?.status === 'error'
    && Number.isFinite(timestamp)
    && timestamp >= Date.parse(from)
    && timestamp < Date.parse(to)
    && /HTTP 502/u.test(String(row.error || ''));
});
const alreadyRetested = new Set(store.state.candy
  .filter(row => row?.source === 'recovery_retest' && row?.status === 'completed')
  .flatMap(row => Array.isArray(row.replaces) ? row.replaces : []));
const pending = targets.filter(row => !alreadyRetested.has(row.id));
if (!pending.length) throw new Error('No unretested HTTP 502 records found in the requested interval');

const results = [];
for (const original of pending) {
  const retest = await runCandyProbe(config, store, {
    displayTimestamp: original.timestamp,
    recoveryReason: 'server_incident',
    replaces: [original.id]
  });
  results.push({
    replaced_id: original.id,
    display_timestamp: original.timestamp,
    retest_id: retest.id,
    status: retest.status,
    final_answer: retest.final_answer,
    grade: retest.grade || null,
    elapsed_seconds: retest.elapsed_seconds
  });
}
const completed = results.filter(row => row.status === 'completed').length;
console.log(JSON.stringify({
  requested_interval: {from: new Date(from).toISOString(), to: new Date(to).toISOString()},
  attempted: results.length,
  completed,
  failed: results.length - completed,
  results
}, null, 2));
if (completed !== results.length) process.exitCode = 1;
