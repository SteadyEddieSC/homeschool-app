import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  BLH_DATA_FORMAT,
  BLH_DATA_KINDS,
  BLH_LEGACY_STORAGE_KEY,
  BLH_SCHEMA_VERSION,
  BLHDataError,
  commitImportedState,
  createEnvelope,
  exportState,
  migrateToCurrent,
  parseImport,
  readStoredState,
  serializeEnvelope
} from '../modules/data-adapter.mjs';

function sampleState() {
  return {
    language: 'en',
    household: {
      family: { id: 'family_demo', name: 'Demo Family' },
      students: [
        { id: 'stu_jordan', name: 'Jordan' },
        { id: 'stu_avery', name: 'Avery' }
      ]
    },
    tasks: [{ id: 'task_demo', title: 'Read chapter one' }],
    notifications: [],
    ignoredTopLevelField: 'must not export'
  };
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    snapshot() {
      return Object.fromEntries(values.entries());
    }
  };
}

function expectDataError(fn, code) {
  assert.throws(fn, error => {
    assert.ok(error instanceof BLHDataError);
    assert.equal(error.code, code);
    return true;
  });
}

test('creates a schema-versioned envelope independent of product version', () => {
  const envelope = createEnvelope(sampleState(), { productVersion: '10.35' });
  assert.equal(envelope.format, BLH_DATA_FORMAT);
  assert.equal(envelope.schemaVersion, BLH_SCHEMA_VERSION);
  assert.equal(envelope.productVersion, '10.35');
  assert.equal(envelope.kind, BLH_DATA_KINDS.APPLICATION_STATE);
  assert.equal(envelope.state.ignoredTopLevelField, undefined);
});

test('application-state round trip is deterministic and byte stable', () => {
  const first = exportState(sampleState());
  const second = serializeEnvelope(parseImport(first));
  const third = serializeEnvelope(parseImport(second));
  assert.equal(first, second);
  assert.equal(second, third);
  assert.ok(first.endsWith('\n'));
});

test('product version is informational while schema version controls compatibility', () => {
  const envelope = createEnvelope(sampleState(), { productVersion: '9.99' });
  const migrated = migrateToCurrent(envelope);
  assert.equal(migrated.productVersion, '9.99');
  assert.equal(migrated.schemaVersion, 1);
});

test('legacy raw application state migrates without changing the stored value', () => {
  const raw = JSON.stringify(sampleState());
  const storage = memoryStorage({ [BLH_LEGACY_STORAGE_KEY]: raw });
  const envelope = readStoredState(storage);
  assert.equal(envelope.kind, BLH_DATA_KINDS.APPLICATION_STATE);
  assert.equal(storage.snapshot()[BLH_LEGACY_STORAGE_KEY], raw);
});

test('valid imported application state commits only after validation', () => {
  const storage = memoryStorage({ [BLH_LEGACY_STORAGE_KEY]: '{"language":"fr"}' });
  const envelope = commitImportedState(storage, exportState(sampleState()));
  assert.equal(envelope.state.language, 'en');
  const committed = JSON.parse(storage.snapshot()[BLH_LEGACY_STORAGE_KEY]);
  assert.equal(committed.language, 'en');
  assert.equal(committed.ignoredTopLevelField, undefined);
});

test('invalid import fails closed and does not modify storage', () => {
  const original = '{"language":"fr"}';
  const storage = memoryStorage({ [BLH_LEGACY_STORAGE_KEY]: original });
  expectDataError(() => commitImportedState(storage, '{bad json'), 'MALFORMED_JSON');
  assert.equal(storage.snapshot()[BLH_LEGACY_STORAGE_KEY], original);
});

test('malformed JSON has a stable error code', () => {
  expectDataError(() => parseImport('{bad json'), 'MALFORMED_JSON');
});

test('unsupported schema versions fail closed', () => {
  expectDataError(() => parseImport(JSON.stringify({
    format: BLH_DATA_FORMAT,
    schemaVersion: 999,
    productVersion: '10.35',
    kind: BLH_DATA_KINDS.APPLICATION_STATE,
    state: sampleState()
  })), 'UNSUPPORTED_SCHEMA');
});

test('partial unknown objects are rejected instead of treated as state', () => {
  expectDataError(() => parseImport({ unrelated: true }), 'INVALID_STATE');
});

test('current synthetic fixture packages migrate as demo fixtures', async () => {
  const fixtureText = await readFile(new URL('../fixtures/demo-family-active.json', import.meta.url), 'utf8');
  const envelope = parseImport(fixtureText);
  assert.equal(envelope.kind, BLH_DATA_KINDS.DEMO_FIXTURE);
  assert.equal(envelope.state.family.name, 'Demo Family');
  assert.deepEqual(envelope.state.students.map(student => student.name), ['Jordan', 'Avery']);
  assert.equal(envelope.state.unknown, undefined);
});

test('demo fixtures cannot be committed as application browser state', async () => {
  const fixtureText = await readFile(new URL('../fixtures/demo-family-fresh.json', import.meta.url), 'utf8');
  const storage = memoryStorage();
  expectDataError(() => commitImportedState(storage, fixtureText), 'UNSUPPORTED_KIND');
  assert.equal(storage.snapshot()[BLH_LEGACY_STORAGE_KEY], undefined);
});

test('dangerous object keys and unsupported top-level fields are removed', () => {
  const input = JSON.parse('{"language":"en","household":{},"__proto__":{"polluted":true},"secrets":"drop"}');
  const envelope = createEnvelope(input);
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal(envelope.state.secrets, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(envelope.state, '__proto__'), false);
});
