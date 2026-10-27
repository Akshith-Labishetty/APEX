// Tiny zero-dependency static file server for the game.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (urlPath === '/') urlPath = '/index.html';
    const file = normalize(join(root, urlPath));
    if (!file.startsWith(root)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

const basePort = Number(process.env.PORT) || 5173;

function listen(port) {
  server.listen(port, () => {
    console.log('');
    console.log('  ================================================');
    console.log('   GP MONTE-CARLO  ->  http://localhost:' + port);
    console.log('   Open that URL in your browser. Enjoy the race!');
    console.log('  ================================================');
    console.log('');
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error('  Port ' + basePort + ' is already in use — the game is probably already running.');
    console.error('  Open http://localhost:' + basePort + ' , or stop that server first.');
    console.error('');
    process.exit(1);
  }
  throw err;
});

listen(basePort);
