import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('site');
createServer(async (req, res) => {
  try {
    const requested = decodeURIComponent((req.url || '/').split('?')[0]);
    let file = path.resolve(root, requested === '/' ? 'index.html' : `.${requested}`);
    if (!file.startsWith(root)) throw new Error('invalid path');
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}).listen(4173, '127.0.0.1', () => console.log('Serving http://127.0.0.1:4173'));
