import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const expectedWorker = 'beaufort-learning-harbor-v11-preview';
const expectedRelease = '11.0.0-rc.1';

function fail(message) {
  throw new Error(`Cloudflare Vite deployment output invalid: ${message}`);
}

export async function validateViteDeployOutput(root = process.cwd()) {
  const redirectPath = path.join(root, '.wrangler/deploy/config.json');
  let redirect;
  try {
    redirect = JSON.parse(await readFile(redirectPath, 'utf8'));
  } catch {
    fail('generated deployment redirect is missing or invalid; run the production build first');
  }

  if (!redirect || typeof redirect.configPath !== 'string' || Object.keys(redirect).length !== 1) {
    fail('generated deployment redirect has an unexpected shape');
  }

  const generatedConfigPath = path.resolve(path.dirname(redirectPath), redirect.configPath);
  const generatedRelative = path.relative(root, generatedConfigPath).replaceAll('\\', '/');
  if (generatedRelative.startsWith('../') || !generatedRelative.startsWith('dist/')) {
    fail('generated deployment redirect escapes the reviewed dist output');
  }

  let generated;
  try {
    generated = JSON.parse(await readFile(generatedConfigPath, 'utf8'));
  } catch {
    fail('generated Worker configuration is missing or invalid');
  }

  if (generated.name !== expectedWorker) fail('generated configuration targets the wrong Worker');
  if (generated.vars?.APP_RELEASE !== expectedRelease || generated.vars?.APP_ENV !== 'preview') {
    fail('generated configuration has unexpected release or environment variables');
  }
  if (typeof generated.main !== 'string' || !generated.main) fail('generated configuration is missing its built Worker entry point');
  if (typeof generated.assets?.directory !== 'string' || !generated.assets.directory) fail('generated configuration is missing its built assets directory');
  if (generated.assets?.binding !== 'ASSETS') fail('generated configuration is missing the reviewed ASSETS binding');
  if (!Array.isArray(generated.assets?.run_worker_first) || !generated.assets.run_worker_first.includes('/api/*')) {
    fail('generated configuration is missing Worker-first API routing');
  }

  const generatedMainPath = path.resolve(path.dirname(generatedConfigPath), generated.main);
  const generatedAssetsPath = path.resolve(path.dirname(generatedConfigPath), generated.assets.directory);
  const expectedAssetsPath = path.join(root, 'dist/client');
  if (generatedAssetsPath !== expectedAssetsPath) fail('generated configuration does not point to dist/client');

  try {
    await access(generatedMainPath);
    await access(path.join(generatedAssetsPath, 'index.html'));
  } catch {
    fail('generated Worker entry point or client index is missing');
  }

  return {
    worker: generated.name,
    release: generated.vars.APP_RELEASE,
    environment: generated.vars.APP_ENV,
    config: generatedRelative,
    assets: path.relative(root, generatedAssetsPath).replaceAll('\\', '/'),
    workerFirstApi: true
  };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  const result = await validateViteDeployOutput();
  console.log(`Cloudflare Vite deployment output passed: ${result.worker}, ${result.release}, ${result.assets}, Worker-first API routing enabled.`);
}
