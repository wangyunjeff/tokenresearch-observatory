import assert from 'node:assert/strict';
import { extractCandyFinalAnswer, extractResponseText, extractResponsesText, gradeCandy, joinResponsesUrl, nextBoundaryMs } from '../server/lib.mjs';

assert.equal(joinResponsesUrl('https://example.com/v1'),'https://example.com/v1/responses');
assert.equal(joinResponsesUrl('https://example.com/v1/responses/'),'https://example.com/v1/responses');
assert.equal(extractResponseText({output_text:'21'}),'21');
assert.equal(extractResponseText({output:[{type:'message',content:[{type:'output_text',text:'答案为 21'}]}]}),'答案为 21');
assert.equal(extractResponsesText('event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"答案为 "}\n\nevent: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"21"}\n\nevent: response.completed\ndata: {"type":"response.completed","response":{"output":[]}}\n\n'),'答案为 21');
assert.equal(extractCandyFinalAnswer('推导中先考虑 21，但最终答案为 28。'),'28');
assert.equal(extractCandyFinalAnswer('因此最少取出 21 颗。'),'21');
assert.equal(extractCandyFinalAnswer('21'),'21');
assert.equal(extractCandyFinalAnswer('我提到了21，但没有明确结论'),null);
assert.equal(gradeCandy('21'),'ok');
assert.equal(gradeCandy('28'),'wrong');
assert.equal(nextBoundaryMs(Date.parse('2026-09-14T06:21:00Z'),10),Date.parse('2026-09-14T06:30:00Z'));
console.log('PASS server helpers');
