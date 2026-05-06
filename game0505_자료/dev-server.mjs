import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const root = resolve('.');
const port = Number.parseInt(process.argv[2] ?? '8000', 10);
const types = {
  '.css': 'text/css;charset=utf-8',
  '.html': 'text/html;charset=utf-8',
  '.js': 'text/javascript;charset=utf-8',
  '.mjs': 'text/javascript;charset=utf-8',
  '.png': 'image/png',
  '.txt': 'text/plain;charset=utf-8',
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const pathname = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const filePath = resolve(join(root, pathname));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const data = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': types[extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(data);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`http://127.0.0.1:${port}`);
});
