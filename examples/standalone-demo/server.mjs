import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZeroAuthServer, SqliteStorageAdapter } from '@zeroauth/server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
const ORIGIN = `http://${HOST}:${PORT}`;

// Initialize ZeroAuth Server with SQLite persistence
const storage = new SqliteStorageAdapter({ filename: path.join(__dirname, 'demo-zeroauth.db') });
const zeroAuth = new ZeroAuthServer({
  rp: {
    name: 'ZeroAuth MVP Interactive Demo',
    id: HOST,
    origin: ORIGIN,
  },
  storage,
});

// Simple session store for demo purposes
const sessions = new Map();

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, ORIGIN);

  // Serve static UI
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(htmlPath).pipe(res);
    return;
  }

  // API Routes
  try {
    if (req.method === 'POST' && url.pathname === '/api/register/options') {
      const { username, displayName } = await parseBody(req);
      if (!username) return sendJson(res, 400, { error: 'Username is required' });

      const options = await zeroAuth.createRegistrationOptions({ username, displayName });
      return sendJson(res, 200, options);
    }

    if (req.method === 'POST' && url.pathname === '/api/register/verify') {
      const { username, displayName, response } = await parseBody(req);
      const result = await zeroAuth.verifyRegistration({
        username,
        displayName,
        response,
      });

      const sessionId = 'sess_' + Math.random().toString(36).slice(2);
      sessions.set(sessionId, result.user);

      return sendJson(res, 200, {
        success: true,
        user: result.user,
        sessionId,
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/login/options') {
      const { username } = await parseBody(req);
      const options = await zeroAuth.createAuthenticationOptions({ username });
      return sendJson(res, 200, options);
    }

    if (req.method === 'POST' && url.pathname === '/api/login/verify') {
      const { response } = await parseBody(req);
      const result = await zeroAuth.verifyAuthentication({ response });

      const sessionId = 'sess_' + Math.random().toString(36).slice(2);
      sessions.set(sessionId, result.user);

      return sendJson(res, 200, {
        success: true,
        user: result.user,
        sessionId,
      });
    }

    // 404
    sendJson(res, 404, { error: 'Not Found' });
  } catch (err) {
    console.error('API Error:', err);
    sendJson(res, 500, { error: err.message || 'Internal Server Error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n🚀 ZeroAuth MVP Demo running at: ${ORIGIN}`);
  console.log(`   Open ${ORIGIN} in your browser to test Passkeys registration & login!\n`);
});
