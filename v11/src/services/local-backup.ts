import { LOCAL_LEARNING_STORAGE_KEY } from './local-learning';
import { LOCAL_ORGANIZATION_STORAGE_KEY } from './local-organization';
import { LOCAL_SUPPORT_STORAGE_KEY } from './local-support';
import { SYNC_QUEUE_STORAGE_KEY } from './sync-queue';

const ENVELOPE_SCHEMA = 'beaufort-learning-harbor-encrypted-backup-v1';
const PAYLOAD_SCHEMA = 'beaufort-learning-harbor-local-preview-backup-v1';
const RELEASE = '11.0.0-beta.2';
const PBKDF2_ITERATIONS = 120_000;
const EMERGENCY_ROLLBACK_KEY = 'beaufortLearningHarbor.v11.beta2.preRestoreSnapshot';

interface BackupEnvelope {
  schema: typeof ENVELOPE_SCHEMA;
  release: typeof RELEASE;
  createdAt: string;
  kdf: {
    name: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number;
    salt: string;
  };
  cipher: {
    name: 'AES-GCM';
    iv: string;
  };
  checksum: {
    algorithm: 'SHA-256';
    value: string;
  };
  ciphertext: string;
}

interface BackupPayload {
  schema: typeof PAYLOAD_SCHEMA;
  sourceRelease: typeof RELEASE;
  exportedAt: string;
  stores: {
    organization: unknown;
    learning: unknown;
    support: unknown;
    syncQueue: unknown;
  };
  counts: BackupRecordCounts;
  exclusions: string[];
}

export interface BackupRecordCounts {
  households: number;
  learners: number;
  todayItems: number;
  supportTickets: number;
  members: number;
  queuedOperations: number;
}

export interface BackupPreview {
  envelopeSchema: string;
  sourceRelease: string;
  exportedAt: string;
  counts: BackupRecordCounts;
  exclusions: string[];
  payload: BackupPayload;
}

function parseStore(key: string, fallback: unknown): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function sanitizeOrganizationStore(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const source = structuredClone(value) as { invitations?: unknown[] };
  if (Array.isArray(source.invitations)) source.invitations = [];
  return source;
}

function countArray(value: unknown, key: string): number {
  if (!value || typeof value !== 'object') return 0;
  const candidate = (value as Record<string, unknown>)[key];
  return Array.isArray(candidate) ? candidate.length : 0;
}

function recordCounts(stores: BackupPayload['stores']): BackupRecordCounts {
  return {
    households: countArray(stores.learning, 'households'),
    learners: countArray(stores.learning, 'learners'),
    todayItems: countArray(stores.learning, 'todayItems'),
    supportTickets: Array.isArray(stores.support) ? stores.support.length : 0,
    members: countArray(stores.organization, 'members'),
    queuedOperations: countArray(stores.syncQueue, 'operations')
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function ownedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', ownedArrayBuffer(bytes));
  return bytesToHex(new Uint8Array(digest));
}

async function deriveKey(passphrase: string, salt: Uint8Array, usage: KeyUsage[]): Promise<CryptoKey> {
  if (passphrase.length < 12) throw new Error('Backup passphrase must be at least 12 characters.');
  const material = await crypto.subtle.importKey(
    'raw',
    ownedArrayBuffer(new TextEncoder().encode(passphrase)),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: ownedArrayBuffer(salt), iterations: PBKDF2_ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    usage
  );
}

function currentPayload(): BackupPayload {
  const organization = sanitizeOrganizationStore(parseStore(LOCAL_ORGANIZATION_STORAGE_KEY, null));
  const stores: BackupPayload['stores'] = {
    organization,
    learning: parseStore(LOCAL_LEARNING_STORAGE_KEY, { households: [], learners: [], todayItems: [], transitionReceipts: {} }),
    support: parseStore(LOCAL_SUPPORT_STORAGE_KEY, []),
    syncQueue: parseStore(SYNC_QUEUE_STORAGE_KEY, { schema: 'beaufort-learning-harbor-sync-queue-v1', lastSuccessfulSyncAt: null, operations: [] })
  };
  return {
    schema: PAYLOAD_SCHEMA,
    sourceRelease: RELEASE,
    exportedAt: new Date().toISOString(),
    stores,
    counts: recordCounts(stores),
    exclusions: [
      'Supabase sessions and credentials',
      'passwords and password-reset state',
      'service-role keys and deployment secrets',
      'BAND and OAuth tokens',
      'active invitation tokens'
    ]
  };
}

function validatePayload(value: unknown): BackupPayload {
  if (!value || typeof value !== 'object') throw new Error('Backup payload is missing.');
  const payload = value as Partial<BackupPayload>;
  if (payload.schema !== PAYLOAD_SCHEMA) throw new Error('Backup payload schema is not supported.');
  if (payload.sourceRelease !== RELEASE) throw new Error(`Backup release ${String(payload.sourceRelease)} is not supported by ${RELEASE}.`);
  if (!payload.stores || typeof payload.stores !== 'object') throw new Error('Backup application stores are missing.');
  const expectedCounts = recordCounts(payload.stores as BackupPayload['stores']);
  const counts = payload.counts as BackupRecordCounts | undefined;
  if (!counts || JSON.stringify(counts) !== JSON.stringify(expectedCounts)) {
    throw new Error('Backup record counts do not match the contained data.');
  }
  return payload as BackupPayload;
}

export async function createEncryptedBackup(passphrase: string): Promise<string> {
  const payload = currentPayload();
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, ['encrypt']);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ownedArrayBuffer(iv) },
    key,
    ownedArrayBuffer(plaintext)
  ));
  const envelope: BackupEnvelope = {
    schema: ENVELOPE_SCHEMA,
    release: RELEASE,
    createdAt: payload.exportedAt,
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      salt: bytesToBase64(salt)
    },
    cipher: { name: 'AES-GCM', iv: bytesToBase64(iv) },
    checksum: { algorithm: 'SHA-256', value: await sha256(encrypted) },
    ciphertext: bytesToBase64(encrypted)
  };
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

export async function inspectEncryptedBackup(serialized: string, passphrase: string): Promise<BackupPreview> {
  let envelope: BackupEnvelope;
  try {
    envelope = JSON.parse(serialized) as BackupEnvelope;
  } catch {
    throw new Error('Backup file is not valid JSON.');
  }
  if (envelope.schema !== ENVELOPE_SCHEMA) throw new Error('Backup envelope schema is not supported.');
  if (envelope.release !== RELEASE) throw new Error(`Backup envelope release ${String(envelope.release)} is not supported.`);
  if (envelope.kdf?.iterations !== PBKDF2_ITERATIONS || envelope.kdf?.hash !== 'SHA-256') {
    throw new Error('Backup key-derivation parameters are not supported.');
  }
  if (envelope.cipher?.name !== 'AES-GCM') throw new Error('Backup cipher is not supported.');
  const encrypted = base64ToBytes(envelope.ciphertext);
  if (await sha256(encrypted) !== envelope.checksum?.value) throw new Error('Backup checksum verification failed.');

  const salt = base64ToBytes(envelope.kdf.salt);
  const iv = base64ToBytes(envelope.cipher.iv);
  const key = await deriveKey(passphrase, salt, ['decrypt']);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ownedArrayBuffer(iv) },
      key,
      ownedArrayBuffer(encrypted)
    );
  } catch {
    throw new Error('Backup could not be decrypted. Check the passphrase and file integrity.');
  }
  const payload = validatePayload(JSON.parse(new TextDecoder().decode(plaintext)) as unknown);
  return {
    envelopeSchema: envelope.schema,
    sourceRelease: payload.sourceRelease,
    exportedAt: payload.exportedAt,
    counts: payload.counts,
    exclusions: payload.exclusions,
    payload
  };
}

export function applyBackupPreview(preview: BackupPreview): void {
  const rollback = {
    createdAt: new Date().toISOString(),
    organization: localStorage.getItem(LOCAL_ORGANIZATION_STORAGE_KEY),
    learning: localStorage.getItem(LOCAL_LEARNING_STORAGE_KEY),
    support: localStorage.getItem(LOCAL_SUPPORT_STORAGE_KEY),
    syncQueue: localStorage.getItem(SYNC_QUEUE_STORAGE_KEY)
  };
  localStorage.setItem(EMERGENCY_ROLLBACK_KEY, JSON.stringify(rollback));
  localStorage.setItem(LOCAL_ORGANIZATION_STORAGE_KEY, JSON.stringify(preview.payload.stores.organization));
  localStorage.setItem(LOCAL_LEARNING_STORAGE_KEY, JSON.stringify(preview.payload.stores.learning));
  localStorage.setItem(LOCAL_SUPPORT_STORAGE_KEY, JSON.stringify(preview.payload.stores.support));
  localStorage.setItem(SYNC_QUEUE_STORAGE_KEY, JSON.stringify(preview.payload.stores.syncQueue));
}

export function downloadBackup(serialized: string): void {
  const blob = new Blob([serialized], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `beaufort-learning-harbor-${RELEASE}-${new Date().toISOString().slice(0, 10)}.blh-backup.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const LOCAL_BACKUP_RELEASE = RELEASE;
