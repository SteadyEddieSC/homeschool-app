import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const manifest = JSON.parse(await readFile('source/releases/v10.32/release.json', 'utf8'));
await mkdir(path.dirname(manifest.output), { recursive: true });
await copyFile(manifest.source, manifest.output);
console.log(`Built ${manifest.output} from ${manifest.source}`);
