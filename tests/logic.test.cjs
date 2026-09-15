const assert = require('node:assert/strict');
require('../logic.js');
const {gradeCandy,summarize,activeCandyRows,bucketize,median} = globalThis.ObservatoryLogic;
const cases = [
  [{status:'completed',final_answer:21},'ok'],
  [{status:'completed',final_answer:' 21 '},'ok'],
  [{status:'completed',final_answer:28,answer:'推理中出现21，最终答案28'},'wrong'],
  [{status:'completed',final_answer:'121'},'wrong'],
  [{status:'completed',final_answer:'21.5'},'wrong'],
  [{status:'completed',final_answer:null,answer:'并不是21'},'wrong'],
  [{status:'completed',final_answer:'不是21'},'wrong'],
  [{status:'completed',final_answer:'21或28'},'wrong'],
  [{status:'completed',final_answer:''},'wrong'],
  [{status:'error',final_answer:21},'error'],
  [{status:'completed',http_status:500,final_answer:21},'error'],
  [{status:'running'},'running'],
  [{status:'none'},'none']
];
for(const [row,expect] of cases) assert.equal(gradeCandy(row),expect);
const rows=[{status:'completed',final_answer:21},{status:'completed',final_answer:28},{status:'error'},{status:'running'}];
const summary=summarize(rows); assert.equal(summary.rate,.5);assert.equal(summary.valid,2);assert.equal(summary.error,1);
assert.equal(summarize([{status:'error'}]).rate,null);
const ref='2026-09-14T06:16:32Z';
let slots=bucketize([{id:'a',timestamp:'2026-09-14T06:12:00Z',status:'completed',final_answer:21},{id:'b',timestamp:'2026-09-14T06:15:00Z',status:'completed',final_answer:21}],ref);
assert.equal(slots.length,144);assert.equal(slots.filter(s=>s.status==='ok').length,1);assert.equal(slots.filter(s=>s.status==='none').length,143);assert.equal(slots.flatMap(s=>s.rows).length,2);
slots=bucketize([{timestamp:'2026-09-14T06:12:00Z',status:'completed',final_answer:21},{timestamp:'2026-09-14T06:12:30Z',status:'error'}],ref);
assert.equal(slots.filter(s=>s.status==='error').length,1);
slots=bucketize([{timestamp:'2026-09-14T06:12:00Z',status:'completed',final_answer:21},{timestamp:'2026-09-14T06:12:30Z',status:'completed',final_answer:16}],ref);
assert.equal(slots.filter(s=>s.status==='mixed').length,1);
slots=bucketize([{timestamp:'2026-09-14T06:12:00Z',status:'completed',final_answer:28},{timestamp:'2026-09-14T06:12:30Z',status:'error'}],ref);
assert.equal(slots.filter(s=>s.status==='wrong').length,1);
slots=bucketize([{timestamp:'invalid',status:'completed',final_answer:21},{timestamp:'2026-09-15T06:12:00Z',status:'completed',final_answer:21}],ref);assert.equal(slots.flatMap(s=>s.rows).length,0);
const originalError={id:'server-502',timestamp:'2026-09-14T06:10:00Z',status:'error'};
const recovery={id:'retest-1',timestamp:'2026-09-15T02:00:00Z',display_timestamp:'2026-09-14T06:10:00Z',source:'recovery_retest',replaces:['server-502'],status:'completed',final_answer:21};
assert.deepEqual(activeCandyRows([originalError,recovery]).map(row=>row.id),['retest-1']);
slots=bucketize([originalError,recovery],ref);
const recoveredSlot=slots.find(slot=>slot.rows.some(row=>row.id==='retest-1'));
assert.equal(recoveredSlot.rows.length,2);assert.equal(recoveredSlot.status,'ok');assert.equal(recoveredSlot.counts.error,0);assert.equal(recoveredSlot.counts.ok,1);
assert.equal(median([4,2,3,1]),2.5);assert.equal(median([4,2,1]),2);assert.equal(median([]),null);
console.log('PASS: strict final-answer scoring, failures excluded, 144 slots, real-time aggregation, mixed states, invalid/future records, median.');
