import { CANDY_PROMPT } from './prompts.mjs';
import { extractCandyFinalAnswer, extractResponsesText, gradeCandy, joinResponsesUrl, makeId, sanitizePublicError } from './lib.mjs';

export async function runCandyProbe(config, store, fetchImpl = fetch) {
  const started = Date.now();
  const id = makeId('candy', started);
  const record = {
    id,
    timestamp:new Date(started).toISOString(),
    status:'running',
    final_answer:null,
    answer:'',
    elapsed_seconds:null,
    model:config.publicModelLabel,
    reasoning_effort:config.candyReasoningEffort || 'default',
    http_status:null
  };
  store.state.candy.push(record);
  await store.save();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.candyTimeoutMs);
  try {
    const body = {
      model:config.candyModel,
      input:[{role:'user',content:[{type:'input_text',text:CANDY_PROMPT}]}],
      max_output_tokens:config.candyMaxOutputTokens,
      store:false,
      stream:true
    };
    if (config.candyReasoningEffort) body.reasoning = {effort:config.candyReasoningEffort};
    const response = await fetchImpl(joinResponsesUrl(config.openaiBaseUrl), {
      method:'POST',
      headers:{'content-type':'application/json','authorization':`Bearer ${config.openaiApiKey}`},
      body:JSON.stringify(body),
      signal:controller.signal
    });
    record.http_status = response.status;
    const payload = await response.text();
    if (!response.ok) throw new Error(`Responses API returned HTTP ${response.status}`);
    const answer = extractResponsesText(payload);
    if (!answer) throw new Error('Responses API returned no output text');
    record.answer = answer;
    record.final_answer = extractCandyFinalAnswer(answer);
    record.status = 'completed';
    record.grade = gradeCandy(record.final_answer);
  } catch (error) {
    record.status = 'error';
    record.error = sanitizePublicError(error?.name === 'AbortError' ? new Error('request timeout') : error);
  } finally {
    clearTimeout(timer);
    record.elapsed_seconds = Math.round((Date.now()-started)/100)/10;
    store.state.health.last_candy_at = new Date().toISOString();
    store.state.health.last_candy_status = record.status;
    await store.save();
  }
  return record;
}
