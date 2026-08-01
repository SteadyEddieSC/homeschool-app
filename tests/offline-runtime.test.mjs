import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLH_OFFLINE_RUNTIME_POLICY,
  BLH_OFFLINE_RUNTIME_SCHEMA,
  BLHOfflineRuntimeError,
  classifyOfflineRequest,
  createOfflineRuntimeLedger,
  recordOfflineRequest,
  snapshotOfflineRuntimeLedger
} from '../modules/offline-runtime.mjs';

const options = { baseHref:'http://127.0.0.1:4173/index.html', origin:'http://127.0.0.1:4173' };

test('classifies same-origin and embedded resources without external network access', () => {
  assert.deepEqual(classifyOfflineRequest('/assets/local.json', options), {
    allowed:true,
    category:'same-origin',
    reason:'same-origin',
    url:'http://127.0.0.1:4173/assets/local.json'
  });
  assert.equal(classifyOfflineRequest('data:text/plain,hello', options).category, 'embedded');
  assert.equal(classifyOfflineRequest('blob:http://127.0.0.1:4173/demo', options).category, 'embedded');
});

test('classifies cross-origin http and websocket-like URLs as external', () => {
  const decision = classifyOfflineRequest('https://example.invalid/collect', options);
  assert.equal(decision.allowed, false);
  assert.equal(decision.category, 'external');
  assert.equal(decision.reason, 'external-network');
});

test('request-like objects are normalized deterministically', () => {
  const first = classifyOfflineRequest({ url:'/same' }, options);
  const second = classifyOfflineRequest('/same', options);
  assert.deepEqual(first, second);
});

test('ledger records allowed and blocked requests with stable counts and bounded fields', () => {
  const ledger = createOfflineRuntimeLedger();
  recordOfflineRequest(ledger, classifyOfflineRequest('/local', options), 'fetch');
  recordOfflineRequest(ledger, classifyOfflineRequest('https://example.invalid/x', options), 'xhr');
  const snapshot = snapshotOfflineRuntimeLedger(ledger);
  assert.equal(snapshot.schemaVersion, BLH_OFFLINE_RUNTIME_SCHEMA);
  assert.equal(snapshot.policy, BLH_OFFLINE_RUNTIME_POLICY);
  assert.equal(snapshot.allowedCount, 1);
  assert.equal(snapshot.blockedCount, 1);
  assert.deepEqual(snapshot.entries.map(entry => entry.disposition), ['allowed', 'blocked']);
});

test('unsupported, malformed, and dangerous ledger seeds fail closed', () => {
  assert.throws(() => createOfflineRuntimeLedger({ schemaVersion:99 }), error => error instanceof BLHOfflineRuntimeError && error.code === 'UNSUPPORTED_SCHEMA');
  assert.throws(() => createOfflineRuntimeLedger({ entries:[{ url:'', disposition:'allowed' }] }), error => error.code === 'INVALID_LEDGER');
  const dangerous = JSON.parse('{"schemaVersion":1,"__proto__":{"polluted":true}}');
  assert.throws(() => createOfflineRuntimeLedger(dangerous), error => error.code === 'DANGEROUS_KEY');
  assert.equal(Object.prototype.polluted, undefined);
});
