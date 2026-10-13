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
    name: 'ZeroAuth Interactive Demo',
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

    // Helper to get session user
    const authHeader = req.headers['authorization'] || '';
    const sessionId = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const sessionUser = sessionId ? sessions.get(sessionId) : null;

    if (req.method === 'GET' && url.pathname === '/api/me') {
      if (!sessionUser) return sendJson(res, 200, { authenticated: false, user: null });
      return sendJson(res, 200, { authenticated: true, user: sessionUser });
    }

    if (req.method === 'POST' && url.pathname === '/api/logout') {
      if (sessionId) sessions.delete(sessionId);
      return sendJson(res, 200, { success: true });
    }

    if (req.method === 'GET' && url.pathname === '/api/credentials') {
      if (!sessionUser) return sendJson(res, 401, { error: 'Unauthorized' });
      const creds = await zeroAuth.listUserCredentials(sessionUser.id);
      return sendJson(res, 200, {
        credentials: creds.map((c) => ({
          id: c.id,
          name: c.name,
          deviceType: c.deviceType,
          backedUp: c.backedUp,
          aaguid: c.aaguid,
          createdAt: c.createdAt,
          lastUsedAt: c.lastUsedAt,
        })),
      });
    }

    if (req.method === 'PATCH' && url.pathname === '/api/credentials') {
      if (!sessionUser) return sendJson(res, 401, { error: 'Unauthorized' });
      const { credentialId, name } = await parseBody(req);
      if (!credentialId || !name) return sendJson(res, 400, { error: 'credentialId and name are required' });
      await zeroAuth.renameCredential(credentialId, name);
      return sendJson(res, 200, { success: true });
    }

    if (req.method === 'DELETE' && url.pathname === '/api/credentials') {
      if (!sessionUser) return sendJson(res, 401, { error: 'Unauthorized' });
      const { credentialId } = await parseBody(req);
      if (!credentialId) return sendJson(res, 400, { error: 'credentialId is required' });
      await zeroAuth.revokeCredential(credentialId);
      return sendJson(res, 200, { success: true });
    }

    // 404
    sendJson(res, 404, { error: 'Not Found' });
  } catch (err) {
    console.error('API Error:', err);
    sendJson(res, 500, { error: err.message || 'Internal Server Error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n🚀 ZeroAuth Interactive Demo running at: ${ORIGIN}`);
  console.log(`   Open ${ORIGIN} in your browser to test Passkeys registration & login!\n`);
});
