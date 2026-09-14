import { randomUUID } from 'node:crypto';

export function envBool(value, fallback = false) {
  if (value == null || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(value));
}

export function positiveInt(value, fallback) {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function joinResponsesUrl(base) {
  const raw = String(base || '').trim().replace(/\/+$/, '');
  if (!raw) throw new Error('OPENAI_BASE_URL is not configured');
  return /\/responses$/i.test(raw) ? raw : `${raw}/responses`;
}

export function extractResponseText(body) {
  if (typeof body?.output_text === 'string' && body.output_text.trim()) return body.output_text.trim();
  const parts = [];
  for (const item of Array.isArray(body?.output) ? body.output : []) {
    if (item?.type !== 'message') continue;
    for (const content of Array.isArray(item.content) ? item.content : []) {
      if ((content?.type === 'output_text' || content?.type === 'text') && typeof content.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

export function extractResponsesText(value) {
  if (value && typeof value === 'object') return extractResponseText(value);
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return extractResponseText(JSON.parse(raw));
  } catch {}

  const deltas = [];
  let completed = null;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') continue;
    let event;
    try { event = JSON.parse(data); } catch { continue; }
    if (event?.type === 'response.output_text.delta' && typeof event.delta === 'string') {
      deltas.push(event.delta);
    } else if (event?.type === 'response.completed') {
      completed = event.response || event;
    }
  }
  return deltas.join('') || (completed ? extractResponseText(completed) : '');
}

export async function readResponsesBody(response) {
  if (!response.body?.getReader) return response.text();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks = [];
  let carry = '';
  let completed = false;
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, {stream:true});
      chunks.push(chunk);
      carry += chunk;
      const lines = carry.split(/\r?\n/);
      carry = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          if (JSON.parse(data)?.type === 'response.completed') completed = true;
        } catch {}
      }
      if (completed) {
        await reader.cancel();
        break;
      }
    }
    chunks.push(decoder.decode());
    return chunks.join('');
  } finally {
    reader.releaseLock();
  }
}

function jsonObjectCandidates(value) {
  const candidates = [value.replace(/^```(?:json)?\s*/iu, '').replace(/\s*```$/u, '').trim()];
  for (let start = 0; start < value.length; start += 1) {
    if (value[start] !== '{') continue;
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (let i = start; i < value.length; i += 1) {
      const char = value[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') quoted = false;
        continue;
      }
      if (char === '"') quoted = true;
      else if (char === '{') depth += 1;
      else if (char === '}' && --depth === 0) {
        candidates.push(value.slice(start, i + 1));
        break;
      }
    }
  }
  return [...new Set(candidates)].reverse();
}

function normalizeCandyAnswer(value) {
  if (Number.isInteger(value) && value >= 0) return String(value);
  if (typeof value === 'string' && /^\d{1,4}$/.test(value.trim())) return value.trim();
  return null;
}

export function extractCandyFinalAnswer(text) {
  const value = String(text || '').trim();
  if (!value) return null;

  // New probes return one JSON object. Parse the field, never numbers inside the proof.
  for (const candidate of jsonObjectCandidates(value)) {
    try {
      const parsed = JSON.parse(candidate);
      const answer = normalizeCandyAnswer(parsed && !Array.isArray(parsed) ? parsed.final_answer : null);
      if (answer !== null) return answer;
    } catch {}
  }

  // Legacy records: explicit conclusions and boxed answers take precedence over
  // intermediate arithmetic such as "16 + 5 = 21".
  const tail = value.slice(-2400);
  const boxed = [...tail.matchAll(/\\boxed\s*\{\s*(\d{1,4})\s*(?:\\text\s*\{[^}]*\})?\s*\}/giu)];
  if (boxed.length) return boxed.at(-1)[1];
  const explicit = [];
  for (const pattern of [
    /(?:最终答案|最终结论|答案(?:是|为)?|所以答案(?:是|为)?)[^0-9]{0,24}(\d{1,4})(?!\d)/giu,
    /(?:因此|所以)[^\n。！？]{0,100}(?:答案|最少|至少)[^0-9]{0,24}(\d{1,4})(?!\d)/giu
  ]) {
    for (const match of tail.matchAll(pattern)) explicit.push({index: match.index ?? -1, answer: match[1]});
  }
  if (explicit.length) return explicit.sort((a, b) => a.index - b.index).at(-1).answer;

  const lines = tail.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const last = lines.at(-1) || '';
  const simple = last.match(/^(?:因此|所以|答[:：]?\s*)?\s*(\d{1,4})\s*(?:颗|个)?[。.!！]?$/u);
  return simple ? simple[1] : null;
}

export function gradeCandy(finalAnswer) {
  return String(finalAnswer ?? '').trim() === '21' ? 'ok' : 'wrong';
}

export function nextBoundaryMs(nowMs, everyMinutes) {
  const step = everyMinutes * 60_000;
  return Math.floor(nowMs / step) * step + step;
}

export function makeId(prefix, when = Date.now()) {
  return `${prefix}-${new Date(when).toISOString().replace(/[-:.TZ]/g,'').slice(0,14)}-${randomUUID().slice(0,8)}`;
}

export function sanitizePublicError(error) {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.replace(/Bearer\s+[A-Za-z0-9._~+\-/]+=*/gi, 'Bearer [redacted]').slice(0, 300);
}
