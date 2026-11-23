import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let isBroken = false;
let userCounter = 1;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (url.pathname === '/') {
    const htmlPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(htmlPath));
      return;
    }
  }

  if (url.pathname === '/api/toggle-break') {
    isBroken = !isBroken;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ isBroken }));
    return;
  }

  if (url.pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ isBroken }));
    return;
  }

  if (url.pathname.startsWith('/api/users/')) {
    const id = parseInt(url.pathname.split('/').pop() || '1', 10);
    res.writeHead(200, { 'Content-Type': 'application/json' });

    if (!isBroken) {
      // Normal response shape
      res.end(
        JSON.stringify({
          id,
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          active: true,
          score: 100,
        })
      );
    } else {
      // Broken response shape: name removed, score changed to string, unexpectedField added
      res.end(
        JSON.stringify({
          id,
          email: null, // unexpected null
          score: '100 points', // type changed
          unexpectedField: 'legacy-data', // field added
        })
      );
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Demo mock API running at http://localhost:${PORT}`);
});
