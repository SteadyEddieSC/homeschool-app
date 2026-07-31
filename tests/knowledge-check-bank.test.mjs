import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BLH_KNOWLEDGE_CHECK_FORMAT,
  BLH_KNOWLEDGE_CHECK_KIND,
  BLH_KNOWLEDGE_CHECK_SCHEMA,
  BLHKnowledgeCheckError,
  createKnowledgeCheckBank,
  parseKnowledgeCheckBank,
  serializeKnowledgeCheckBank
} from '../modules/knowledge-check-bank.mjs';

function samplePrompt(overrides = {}) {
  return {
    id: 'kc_demo_recitation',
    title: 'Synthetic history recitation',
    type: 'recitation',
    subject: 'History',
    track: 'Upper learner',
    status: 'draft',
    studentDirections: 'Explain the synthetic event in your own words.',
    evidenceExpectations: 'Give a clear two-minute oral response and cite one course note.',
    criteria: ['Accurate sequence', 'Clear explanation'],
    returnLanguage: 'Please revise the sequence and try again.',
    approvalLanguage: 'Approved after adult review.',
    adultNotes: 'Synthetic-only teacher note.',
    createdAt: '2026-07-31T00:00:00.000Z',
    updatedAt: '2026-07-31T00:00:00.000Z',
    ...overrides
  };
}

function expectKnowledgeError(fn, code) {
  assert.throws(fn, error => {
    assert.ok(error instanceof BLHKnowledgeCheckError);
    assert.equal(error.code, code);
    return true;
  });
}

test('creates a schema-1 bank independent of product release', () => {
  const bank = createKnowledgeCheckBank([samplePrompt()], { productVersion: '10.36' });
  assert.equal(bank.format, BLH_KNOWLEDGE_CHECK_FORMAT);
  assert.equal(bank.schemaVersion, BLH_KNOWLEDGE_CHECK_SCHEMA);
  assert.equal(bank.kind, BLH_KNOWLEDGE_CHECK_KIND);
  assert.equal(bank.productVersion, '10.36');
});

test('round trip is deterministic and strips unknown prompt fields', () => {
  const prompt = samplePrompt({ unknown: 'drop me' });
  const first = serializeKnowledgeCheckBank([prompt], { productVersion: '10.36' });
  const parsed = parseKnowledgeCheckBank(first);
  const second = serializeKnowledgeCheckBank(parsed);
  assert.equal(first, second);
  assert.equal(parsed.prompts[0].unknown, undefined);
  assert.ok(first.endsWith('\n'));
});

test('equivalent prompt sets serialize in stable id order', () => {
  const a = samplePrompt({ id: 'kc_a', title: 'A' });
  const b = samplePrompt({ id: 'kc_b', title: 'B' });
  assert.equal(
    serializeKnowledgeCheckBank([b, a]),
    serializeKnowledgeCheckBank([a, b])
  );
});

test('malformed and unsupported files fail closed with stable codes', () => {
  expectKnowledgeError(() => parseKnowledgeCheckBank('{bad json'), 'MALFORMED_JSON');
  expectKnowledgeError(() => parseKnowledgeCheckBank({}), 'INVALID_FORMAT');
  expectKnowledgeError(() => parseKnowledgeCheckBank({
    format: BLH_KNOWLEDGE_CHECK_FORMAT,
    schemaVersion: 999,
    kind: BLH_KNOWLEDGE_CHECK_KIND,
    productVersion: '10.36',
    prompts: []
  }), 'UNSUPPORTED_SCHEMA');
  expectKnowledgeError(() => parseKnowledgeCheckBank({
    format: BLH_KNOWLEDGE_CHECK_FORMAT,
    schemaVersion: 1,
    kind: 'assessment-bank',
    productVersion: '10.36',
    prompts: []
  }), 'UNSUPPORTED_KIND');
});

test('partial prompts and duplicate ids are rejected', () => {
  expectKnowledgeError(() => createKnowledgeCheckBank([{ id: 'partial' }]), 'INVALID_PROMPT');
  expectKnowledgeError(() => createKnowledgeCheckBank([samplePrompt(), samplePrompt()]), 'DUPLICATE_ID');
});

test('unsupported prompt types and statuses are rejected', () => {
  expectKnowledgeError(() => createKnowledgeCheckBank([samplePrompt({ type: 'multiple-choice' })]), 'INVALID_PROMPT');
  expectKnowledgeError(() => createKnowledgeCheckBank([samplePrompt({ status: 'auto-graded' })]), 'INVALID_PROMPT');
});

test('dangerous keys and polluted prototypes are rejected', () => {
  const polluted = samplePrompt();
  Object.defineProperty(polluted, '__proto__', {
    value: { polluted: true },
    enumerable: true,
    configurable: true
  });
  expectKnowledgeError(() => createKnowledgeCheckBank([polluted]), 'DANGEROUS_KEY');

  const inherited = samplePrompt();
  Object.setPrototypeOf(inherited, { polluted: true });
  expectKnowledgeError(() => createKnowledgeCheckBank([inherited]), 'INVALID_PROMPT');
  assert.equal(Object.prototype.polluted, undefined);
});
