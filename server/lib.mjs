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

export function extractCandyFinalAnswer(text) {
  const value = String(text || '').trim();
  if (/^21[。.!！]?$/u.test(value)) return '21';
  const tail = value.slice(-1600);
  const patterns = [
    /(?:最终答案|答案(?:是|为)?|最终(?:应为|是)|所以答案(?:是|为)?)[^0-9]{0,18}(\d{1,4})(?!\d)/giu,
    /(?:最少|至少)(?:需要)?(?:取出|摸出|拿出)?[^0-9]{0,18}(\d{1,4})(?!\d)/giu
  ];
  const hits = [];
  for (const pattern of patterns) {
    for (const match of tail.matchAll(pattern)) hits.push({index: match.index ?? -1, answer: match[1]});
  }
  if (hits.length) return hits.sort((a,b) => a.index - b.index).at(-1).answer;
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
