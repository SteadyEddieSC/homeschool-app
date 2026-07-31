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
    appVersion: '10.34.1',
    programName: 'Beaufort Learning Harbor',
    currentWeekId: 'week_demo_1',
    activeStudentId: 'stu_jordan',
    students: [
      { id: 'stu_jordan', name: 'Jordan', levelId: 'upper' },
      { id: 'stu_avery', name: 'Avery', levelId: 'lower' }
    ],
    curriculum: {
      weeks: [
        {
          id: 'week_demo_1',
          title: 'Synthetic week',
          lessons: [{ id: 'lesson_demo_1', title: 'Read chapter one' }]
        }
      ]
    },
    progress: {
      stu_jordan: { lesson_demo_1: { status: 'complete' } },
      stu_avery: {}
    },
    contentPacks: [{ id: 'pack_demo', title: 'Synthetic pack' }],
    biologyCompanion: { enabled: true },
    portfolioArtifacts: [{ id: 'artifact_demo', studentId: 'stu_jordan' }],
    authSettings: {
      adultPinHash: 'synthetic-pin-hash',
      pinHint: 'synthetic hint',
      adultUnlockExpiresAt: '2099-01-01T00:00:00.000Z',
      auditLog: [{ id: 'audit_demo', action: 'synthetic action' }],
      adultGateEnabled: true
    },
    backups: [
      {
        id: 'backup_demo',
        label: 'Synthetic backup',
        createdAt: '2026-07-31T00:00:00.000Z',
        hash: 'synthetic-hash',
        bytes: 1234,
        note: 'Synthetic metadata',
        snapshot: {
          students: [{ id: 'private_nested_copy', name: 'Nested payload omitted' }]
        }
      }
    ],
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

test('portable export preserves live application collections', () => {
  const envelope = parseImport(exportState(sampleState()));
  assert.deepEqual(envelope.state.students.map(student => student.name), ['Jordan', 'Avery']);
  assert.equal(envelope.state.curriculum.weeks[0].id, 'week_demo_1');
  assert.equal(envelope.state.contentPacks[0].id, 'pack_demo');
  assert.equal(envelope.state.biologyCompanion.enabled, true);
  assert.equal(envelope.state.portfolioArtifacts[0].id, 'artifact_demo');
});

test('portable export clears local adult secrets and unlock sessions', () => {
  const envelope = parseImport(exportState(sampleState()));
  assert.equal(envelope.state.authSettings.adultPinHash, '');
  assert.equal(envelope.state.authSettings.pinHint, '');
  assert.equal(envelope.state.authSettings.adultUnlockExpiresAt, '');
  assert.deepEqual(envelope.state.authSettings.auditLog, []);
  assert.equal(envelope.state.authSettings.adultGateEnabled, true);
});

test('portable export replaces nested backup payloads with deterministic metadata', () => {
  const envelope = parseImport(exportState(sampleState()));
  assert.equal(envelope.state.backups.length, 1);
  assert.equal(envelope.state.backups[0].id, 'backup_demo');
  assert.equal(envelope.state.backups[0].bytes, 1234);
  assert.equal(envelope.state.backups[0].payloadOmitted, true);
  assert.equal(envelope.state.backups[0].snapshot, undefined);
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

test('legacy raw browser state migrates without rewriting localStorage', () => {
  const raw = JSON.stringify(sampleState());
  const storage = memoryStorage({ [BLH_LEGACY_STORAGE_KEY]: raw });
  const envelope = readStoredState(storage);
  assert.equal(envelope.kind, BLH_DATA_KINDS.APPLICATION_STATE);
  assert.equal(envelope.state.authSettings.adultPinHash, 'synthetic-pin-hash');
  assert.equal(envelope.state.authSettings.adultUnlockExpiresAt, '');
  assert.ok(envelope.state.backups[0].snapshot);
  assert.equal(storage.snapshot()[BLH_LEGACY_STORAGE_KEY], raw);
});

test('legacy raw import preserves supported state while dropping unknown fields', () => {
  const envelope = parseImport(sampleState());
  assert.equal(envelope.state.authSettings.adultPinHash, 'synthetic-pin-hash');
  assert.equal(envelope.state.backups[0].snapshot.students[0].id, 'private_nested_copy');
  assert.equal(envelope.state.ignoredTopLevelField, undefined);
});

test('valid imported application state commits only after validation', () => {
  const original = JSON.stringify({ students: [], curriculum: { weeks: [] } });
  const storage = memoryStorage({ [BLH_LEGACY_STORAGE_KEY]: original });
  const envelope = commitImportedState(storage, exportState(sampleState()));
  assert.equal(envelope.state.activeStudentId, 'stu_jordan');
  const committed = JSON.parse(storage.snapshot()[BLH_LEGACY_STORAGE_KEY]);
  assert.equal(committed.students[0].name, 'Jordan');
  assert.equal(committed.authSettings.adultPinHash, '');
  assert.equal(committed.backups[0].snapshot, undefined);
  assert.equal(committed.ignoredTopLevelField, undefined);
});

test('invalid import fails closed and does not modify storage', () => {
  const original = JSON.stringify({ students: [], curriculum: { weeks: [] } });
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

test('curriculum-only packages are not accepted as full application state', () => {
  expectDataError(() => parseImport({ weeks: [] }), 'INVALID_STATE');
});

test('missing students or curriculum weeks are rejected', () => {
  expectDataError(() => parseImport({ curriculum: { weeks: [] } }), 'INVALID_STATE');
  expectDataError(() => parseImport({ students: [] }), 'INVALID_STATE');
  expectDataError(() => parseImport({ students: [], curriculum: {} }), 'INVALID_STATE');
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

test('objects with polluted prototypes are rejected', () => {
  const input = sampleState();
  Object.setPrototypeOf(input, { polluted: true });
  expectDataError(() => createEnvelope(input), 'INVALID_STATE');
  assert.equal(Object.prototype.polluted, undefined);
});

test('dangerous own keys and unsupported top-level fields are removed', () => {
  const input = sampleState();
  Object.defineProperty(input, '__proto__', {
    value: { polluted: true },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(input.curriculum.weeks[0], 'constructor', {
    value: { nestedPollution: true },
    enumerable: true,
    configurable: true
  });
  const envelope = createEnvelope(input);
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal(Object.prototype.nestedPollution, undefined);
  assert.equal(envelope.state.ignoredTopLevelField, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(envelope.state, '__proto__'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(envelope.state.curriculum.weeks[0], 'constructor'), false);
});
