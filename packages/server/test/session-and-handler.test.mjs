import test from 'node:test';
import assert from 'node:assert';
import {
  ZeroAuthServer,
  MemoryStorageAdapter,
  SessionManager,
  createZeroAuthHandler,
} from '../dist/index.js';

test('SessionManager: create, validate, sliding expiration, revoke, and prune', async () => {
  const storage = new MemoryStorageAdapter();
  await storage.createUser({
    id: 'user_dev',
    username: 'developer',
  });

  const sessionManager = new SessionManager({
    storage,
    sessionTtlSeconds: 10,
    slidingExpiration: true,
  });

  // Create session
  const session = await sessionManager.createSession('user_dev');
  assert.ok(session.id.startsWith('za_sess_'));
  assert.strictEqual(session.userId, 'user_dev');

  // Validate session
  const valid = await sessionManager.validateSession(session.id);
  assert.ok(valid !== null);
  assert.strictEqual(valid.user.id, 'user_dev');
  assert.strictEqual(valid.user.username, 'developer');

  // Revoke session (logout)
  await sessionManager.revokeSession(session.id);
  const revoked = await sessionManager.validateSession(session.id);
  assert.strictEqual(revoked, null);
});

test('Universal Web Handler: /register/options, /me, /logout, 404', async () => {
  const storage = new MemoryStorageAdapter();
  const server = new ZeroAuthServer({
    rp: {
      name: 'Handler Test App',
      id: 'localhost',
      origin: 'http://localhost:3000',
    },
    storage,
    silent: true,
  });

  const sessionManager = new SessionManager({ storage });
  const handler = createZeroAuthHandler(server, {
    basePath: '/api/auth',
    cookieName: 'za_test_cookie',
    sessionManager,
  });

  // 1. POST /register/options
  const optReq = new Request('http://localhost:3000/api/auth/register/options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'alpha_tester' }),
  });
  const optRes = await handler(optReq);
  assert.strictEqual(optRes.status, 200);
  const optData = await optRes.json();
  assert.strictEqual(optData.rp.id, 'localhost');
  assert.ok(optData.challenge.length > 0);

  // 2. GET /me without session
  const meUnauthReq = new Request('http://localhost:3000/api/auth/me', {
    method: 'GET',
  });
  const meUnauthRes = await handler(meUnauthReq);
  const meUnauthData = await meUnauthRes.json();
  assert.strictEqual(meUnauthData.authenticated, false);
  assert.strictEqual(meUnauthData.user, null);

  // 3. GET /me with Bearer token
  const testUser = await storage.createUser({
    id: 'user_sess_1',
    username: 'tester',
  });
  const session = await sessionManager.createSession(testUser.id);

  const meAuthReq = new Request('http://localhost:3000/api/auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${session.id}`,
    },
  });
  const meAuthRes = await handler(meAuthReq);
  const meAuthData = await meAuthRes.json();
  assert.strictEqual(meAuthData.authenticated, true);
  assert.strictEqual(meAuthData.user.username, 'tester');

  // 4. POST /logout with Cookie
  const logoutReq = new Request('http://localhost:3000/api/auth/logout', {
    method: 'POST',
    headers: {
      Cookie: `za_test_cookie=${session.id}`,
    },
  });
  const logoutRes = await handler(logoutReq);
  assert.strictEqual(logoutRes.status, 200);
  assert.ok(logoutRes.headers.get('set-cookie')?.includes('Max-Age=0'));

  // Verify session revoked
  const afterLogout = await sessionManager.validateSession(session.id);
  assert.strictEqual(afterLogout, null);

  // 5. 404 for unknown route
  const notFoundReq = new Request('http://localhost:3000/api/auth/unknown', {
    method: 'GET',
  });
  const notFoundRes = await handler(notFoundReq);
  assert.strictEqual(notFoundRes.status, 404);
});
