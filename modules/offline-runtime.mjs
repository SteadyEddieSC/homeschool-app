export const BLH_OFFLINE_RUNTIME_VERSION = 'v10.39';
export const BLH_OFFLINE_RUNTIME_POLICY = 'same-origin-and-embedded';
export const BLH_OFFLINE_RUNTIME_SCHEMA = 1;

const EMBEDDED_PROTOCOLS = new Set(['data:', 'blob:', 'about:']);
const MAX_LEDGER_ENTRIES = 200;

export class BLHOfflineRuntimeError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'BLHOfflineRuntimeError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function requestValue(input) {
  if (typeof input === 'string' || input instanceof URL) return String(input);
  if (input && typeof input === 'object' && typeof input.url === 'string') return input.url;
  throw new BLHOfflineRuntimeError('INVALID_REQUEST_URL', 'Request URL must be a string, URL, or Request-like object');
}

function normalizedOrigin(origin, baseHref) {
  if (typeof origin === 'string' && origin.trim()) return origin.trim();
  return new URL(baseHref).origin;
}

export function classifyOfflineRequest(input, options = {}) {
  const baseHref = options.baseHref || 'http://127.0.0.1/';
  const origin = normalizedOrigin(options.origin, baseHref);
  let url;
  try {
    url = new URL(requestValue(input), baseHref);
  } catch (error) {
    throw new BLHOfflineRuntimeError('INVALID_REQUEST_URL', 'Request URL could not be parsed', { cause: error.message });
  }
  if (EMBEDDED_PROTOCOLS.has(url.protocol)) {
    return Object.freeze({ allowed: true, category: 'embedded', reason: 'embedded-resource', url: url.href });
  }
  if (url.protocol === 'file:' && new URL(baseHref).protocol === 'file:') {
    return Object.freeze({ allowed: true, category: 'same-origin', reason: 'local-file', url: url.href });
  }
  if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin === origin) {
    return Object.freeze({ allowed: true, category: 'same-origin', reason: 'same-origin', url: url.href });
  }
  return Object.freeze({ allowed: false, category: 'external', reason: 'external-network', url: url.href });
}

export function createOfflineRuntimeLedger(seed = undefined) {
  const ledger = {
    schemaVersion: BLH_OFFLINE_RUNTIME_SCHEMA,
    runtimeVersion: BLH_OFFLINE_RUNTIME_VERSION,
    policy: BLH_OFFLINE_RUNTIME_POLICY,
    allowedCount: 0,
    blockedCount: 0,
    entries: []
  };
  if (seed === undefined) return ledger;
  if (!seed || typeof seed !== 'object' || Array.isArray(seed)) {
    throw new BLHOfflineRuntimeError('INVALID_LEDGER', 'Offline runtime ledger seed must be an object');
  }
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    if (Object.prototype.hasOwnProperty.call(seed, key)) throw new BLHOfflineRuntimeError('DANGEROUS_KEY', `Dangerous key rejected: ${key}`);
  }
  if (seed.schemaVersion !== undefined && seed.schemaVersion !== BLH_OFFLINE_RUNTIME_SCHEMA) {
    throw new BLHOfflineRuntimeError('UNSUPPORTED_SCHEMA', `Unsupported offline runtime ledger schema: ${seed.schemaVersion}`);
  }
  const entries = Array.isArray(seed.entries) ? seed.entries.slice(-MAX_LEDGER_ENTRIES) : [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new BLHOfflineRuntimeError('INVALID_LEDGER', 'Ledger entries must be objects');
    if (typeof entry.url !== 'string' || !entry.url) throw new BLHOfflineRuntimeError('INVALID_LEDGER', 'Ledger entry URL is required');
    if (!['allowed', 'blocked'].includes(entry.disposition)) throw new BLHOfflineRuntimeError('INVALID_LEDGER', 'Ledger entry disposition is invalid');
  }
  ledger.entries = entries.map(entry => ({
    api: String(entry.api || 'unknown').slice(0, 32),
    category: String(entry.category || 'unknown').slice(0, 32),
    disposition: entry.disposition,
    reason: String(entry.reason || '').slice(0, 80),
    url: entry.url.slice(0, 2048)
  }));
  ledger.allowedCount = ledger.entries.filter(entry => entry.disposition === 'allowed').length;
  ledger.blockedCount = ledger.entries.filter(entry => entry.disposition === 'blocked').length;
  return ledger;
}

export function recordOfflineRequest(ledger, decision, api = 'unknown') {
  if (!ledger || typeof ledger !== 'object' || !Array.isArray(ledger.entries)) {
    throw new BLHOfflineRuntimeError('INVALID_LEDGER', 'Offline runtime ledger is not initialized');
  }
  if (!decision || typeof decision !== 'object' || typeof decision.allowed !== 'boolean' || typeof decision.url !== 'string') {
    throw new BLHOfflineRuntimeError('INVALID_DECISION', 'Offline request decision is invalid');
  }
  const entry = {
    api: String(api || 'unknown').slice(0, 32),
    category: String(decision.category || 'unknown').slice(0, 32),
    disposition: decision.allowed ? 'allowed' : 'blocked',
    reason: String(decision.reason || '').slice(0, 80),
    url: decision.url.slice(0, 2048)
  };
  ledger.entries.push(entry);
  if (ledger.entries.length > MAX_LEDGER_ENTRIES) ledger.entries.splice(0, ledger.entries.length - MAX_LEDGER_ENTRIES);
  if (decision.allowed) ledger.allowedCount += 1;
  else ledger.blockedCount += 1;
  return Object.freeze({ ...entry });
}

export function snapshotOfflineRuntimeLedger(ledger) {
  const normalized = createOfflineRuntimeLedger(ledger);
  return Object.freeze({
    schemaVersion: normalized.schemaVersion,
    runtimeVersion: normalized.runtimeVersion,
    policy: normalized.policy,
    allowedCount: normalized.allowedCount,
    blockedCount: normalized.blockedCount,
    entries: Object.freeze(normalized.entries.map(entry => Object.freeze({ ...entry })))
  });
}

function blockedError(decision, api) {
  return new BLHOfflineRuntimeError('EXTERNAL_NETWORK_BLOCKED', `${api} blocked by ${BLH_OFFLINE_RUNTIME_POLICY}: ${decision.url}`, decision);
}

export function installOfflineRuntimeGuard(scope = globalThis, options = {}) {
  if (!scope || typeof scope !== 'object') throw new BLHOfflineRuntimeError('INVALID_SCOPE', 'A browser-like global scope is required');
  if (scope.__blhOfflineRuntimeGuard) return scope.__blhOfflineRuntimeGuard;
  const baseHref = options.baseHref || scope.location?.href || 'http://127.0.0.1/';
  const origin = options.origin || scope.location?.origin || new URL(baseHref).origin;
  const blockExternal = options.blockExternal !== false;
  const ledger = createOfflineRuntimeLedger();
  const decide = (input, api) => {
    const decision = classifyOfflineRequest(input, { baseHref, origin });
    recordOfflineRequest(ledger, decision, api);
    try {
      if (typeof scope.dispatchEvent === 'function' && typeof scope.CustomEvent === 'function') {
        scope.dispatchEvent(new scope.CustomEvent('blh:offline-runtime', { detail:{ api, decision } }));
      }
    } catch {}
    return decision;
  };

  const originals = {};
  if (typeof scope.fetch === 'function') {
    originals.fetch = scope.fetch.bind(scope);
    scope.fetch = function blhOfflineFetch(input, init) {
      const decision = decide(input, 'fetch');
      if (!decision.allowed && blockExternal) return Promise.reject(blockedError(decision, 'fetch'));
      return originals.fetch(input, init);
    };
  }

  const xhrPrototype = scope.XMLHttpRequest?.prototype;
  if (xhrPrototype && typeof xhrPrototype.open === 'function') {
    originals.xhrOpen = xhrPrototype.open;
    xhrPrototype.open = function blhOfflineXhrOpen(method, url, ...rest) {
      const decision = decide(url, 'xhr');
      if (!decision.allowed && blockExternal) throw blockedError(decision, 'xhr');
      return originals.xhrOpen.call(this, method, url, ...rest);
    };
  }

  if (scope.navigator && typeof scope.navigator.sendBeacon === 'function') {
    originals.sendBeacon = scope.navigator.sendBeacon.bind(scope.navigator);
    scope.navigator.sendBeacon = function blhOfflineSendBeacon(url, data) {
      const decision = decide(url, 'beacon');
      if (!decision.allowed && blockExternal) return false;
      return originals.sendBeacon(url, data);
    };
  }

  const api = Object.freeze({
    version: BLH_OFFLINE_RUNTIME_VERSION,
    policy: BLH_OFFLINE_RUNTIME_POLICY,
    classify: input => classifyOfflineRequest(input, { baseHref, origin }),
    snapshot: () => snapshotOfflineRuntimeLedger(ledger),
    reset() {
      ledger.entries.length = 0;
      ledger.allowedCount = 0;
      ledger.blockedCount = 0;
    },
    restore() {
      if (originals.fetch) scope.fetch = originals.fetch;
      if (originals.xhrOpen && xhrPrototype) xhrPrototype.open = originals.xhrOpen;
      if (originals.sendBeacon && scope.navigator) scope.navigator.sendBeacon = originals.sendBeacon;
      delete scope.__blhOfflineRuntimeGuard;
    }
  });
  Object.defineProperty(scope, '__blhOfflineRuntimeGuard', { value: api, configurable: true });
  return api;
}
