import test from 'node:test';
import assert from 'node:assert/strict';
import {checkFirebaseConfiguration} from '../js/config-check.js';
const config = {apiKey:'a', authDomain:'d', projectId:'p', appId:'id'};
test('빈 설정은 명시적으로 데모 모드', () => {
  assert.equal(checkFirebaseConfiguration({}, '').mode, 'demo');
});
test('일부만 입력한 설정을 데모로 오인하지 않음', () => {
  const result = checkFirebaseConfiguration({apiKey:'a', projectId:'p'}, 'uid');
  assert.equal(result.mode, 'invalid');
  assert.match(result.message, /authDomain/);
});
test('교사 UID 없는 구성은 명확히 오류', () => {
  assert.equal(checkFirebaseConfiguration(config, '').mode, 'invalid');
});
test('설정이 모두 있으면 Firebase 모드', () => {
  assert.equal(checkFirebaseConfiguration(config, 'uid').mode, 'firebase');
});
