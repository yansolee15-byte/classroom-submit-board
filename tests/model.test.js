import test from 'node:test';
import assert from 'node:assert/strict';
import { nextStatus, statusLabel, submissionId, getStatus, stats, escapeHTML, orderedStudents } from '../js/model.js';

test('기본 항목은 미완료 ↔ 완료', () => {
  assert.equal(nextStatus('none', false), 'done');
  assert.equal(nextStatus('done', false), 'none');
});
test('진행 중 허용은 미완료 → 진행 중 → 완료 → 미완료', () => {
  assert.equal(nextStatus('none', true), 'progress');
  assert.equal(nextStatus('progress', true), 'done');
  assert.equal(nextStatus('done', true), 'none');
});
test('알 수 없는 상태는 안전한 첫 단계로', () => {
  assert.equal(nextStatus('bad', true), 'none');
});
test('상태 이름은 한국어로 제공', () => {
  assert.equal(statusLabel('progress'), '진행 중');
});
test('학생별 제출 기록 식별자는 안정적', () => {
  assert.equal(submissionId('item1', 'student2'), 'item1__student2');
});
test('미저장 제출 기록은 미완료', () => {
  assert.equal(getStatus({submissions:[]}, 'a', 'b'), 'none');
});
test('항목별 집계에서 미완료도 포함', () => {
  const data={students:[{id:'a'},{id:'b'},{id:'c'}],submissions:[{id:'x__a',status:'done'},{id:'x__b',status:'progress'}]};
  assert.deepEqual(stats(data, 'x'), {none:1,progress:1,done:1});
});
test('HTML 문자열은 화면 삽입 전 이스케이프', () => {
  assert.equal(escapeHTML('<script>"&'), '&lt;script&gt;&quot;&amp;');
});
test('학생 정렬은 출석번호를 숫자로 비교', () => {
  assert.deepEqual(orderedStudents([{id:'b',number:10,name:'나'},{id:'a',number:2,name:'가'}]).map(s=>s.number), [2,10]);
});
