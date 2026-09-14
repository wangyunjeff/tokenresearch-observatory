/* Pure, tested display logic. A mention of 21 is NOT a final answer. */
(function (root) {
  'use strict';
  const STEP = 600000, HOUR = 3600000;
  function gradeCandy(row) {
    if (row.status === 'error' || Number(row.http_status) >= 400) return 'error';
    if (row.status === 'running') return 'running';
    if (row.status === 'none') return 'none';
    const answer = row.final_answer;
    return answer === 21 || (typeof answer === 'string' && answer.trim() === '21') ? 'ok' : 'wrong';
  }
  function summarize(rows) {
    const totals = {ok: 0, wrong: 0, error: 0, running: 0, none: 0};
    rows.forEach(row => totals[gradeCandy(row)]++);
    totals.valid = totals.ok + totals.wrong;
    totals.rate = totals.valid ? totals.ok / totals.valid : null;
    return totals;
  }
  function bucketize(rows, reference) {
    const ref = new Date(reference).getTime();
    if (!Number.isFinite(ref)) throw new Error('Invalid reference time');
    const end = Math.floor(ref / HOUR) * HOUR + HOUR;
    const start = end - 24 * HOUR;
    const slots = Array.from({length: 144}, (_, i) => ({time: start + i * STEP, rows: [], status: 'none', future: start + i * STEP > ref}));
    rows.forEach(row => {
      const t = Date.parse(row.timestamp);
      if (Number.isFinite(t) && t >= start && t < end && t <= ref) slots[Math.floor((t - start) / STEP)].rows.push(row);
    });
    slots.forEach(slot => {
      const t = summarize(slot.rows);
      slot.status = t.wrong ? 'wrong' : t.error ? 'error' : t.running ? 'running' : t.ok ? 'ok' : 'none';
      slot.counts = t;
    });
    return slots;
  }
  function median(values) {
    const sorted = values.filter(v => Number.isFinite(v) && v >= 0).slice().sort((a,b) => a-b);
    if (!sorted.length) return null;
    const i = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[i] : (sorted[i-1] + sorted[i]) / 2;
  }
  const api = {STEP, gradeCandy, summarize, bucketize, median};
  root.ObservatoryLogic = Object.freeze(api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
