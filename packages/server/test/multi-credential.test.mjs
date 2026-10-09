import test from 'node:test';
import assert from 'node:assert';
import {
  ZeroAuthServer,
  MemoryStorageAdapter,
  createZeroAuthHandler,
  SessionManager,
} from '../dist/index.js';

test('Multi-Passkey: Register multiple keys, rename, list, and revoke', async () => {
  const storage = new MemoryStorageAdapter();
  const server = new ZeroAuthServer({
    rp: { name: 'MultiKey App', id: 'localhost', origin: 'http://localhost:3000' },
    storage,
    silent: true,
  });

  const user = await storage.createUser({
    id: 'user_multi',
    username: 'multikey_user',
  });

  // Save 2 credentials for this user (e.g. MacBook and YubiKey)
  await storage.saveCredential({
    id: 'cred_macbook',
    userId: user.id,
    publicKey: new Uint8Array([1, 2, 3]),
    counter: 0,
    name: 'MacBook Pro Touch ID',
    createdAt: new Date(),
  });

  await storage.saveCredential({
    id: 'cred_yubikey',
    userId: user.id,
    publicKey: new Uint8Array([4, 5, 6]),
    counter: 0,
    name: 'YubiKey 5 NFC Backup',
    createdAt: new Date(),
  });

  // 1. List user credentials
  const creds = await server.listUserCredentials(user.id);
  assert.strictEqual(creds.length, 2);

  // 2. Rename credential
  await server.renameCredential('cred_macbook', 'Work Laptop (M3)');
  const updated = await storage.getCredentialById('cred_macbook');
  assert.strictEqual(updated?.name, 'Work Laptop (M3)');

  // 3. Revoke credential
  await server.revokeCredential('cred_yubikey');
  const remaining = await server.listUserCredentials(user.id);
  assert.strictEqual(remaining.length, 1);
  assert.strictEqual(remaining[0]?.id, 'cred_macbook');
});

test('Universal Handler: GET /credentials, PATCH /credentials, DELETE /credentials', async () => {
  const storage = new MemoryStorageAdapter();
  const server = new ZeroAuthServer({
    rp: { name: 'Handler MultiKey', id: 'localhost', origin: 'http://localhost:3000' },
    storage,
    silent: true,
  });

  const sessionManager = new SessionManager({ storage });
  const handler = createZeroAuthHandler(server, {
    basePath: '/api/auth',
    sessionManager,
  });

  const user = await storage.createUser({
    id: 'user_api_multi',
    username: 'api_user',
  });

  const session = await sessionManager.createSession(user.id);

  await storage.saveCredential({
    id: 'cred_device_1',
    userId: user.id,
    publicKey: new Uint8Array([10, 20]),
    counter: 0,
    name: 'iPhone 15 Pro',
    aaguid: 'dd48324f-6371-4f9a-bd29-0e0ecb3c4720',
    createdAt: new Date(),
  });

  // 1. GET /credentials
  const getReq = new Request('http://localhost:3000/api/auth/credentials', {
    method: 'GET',
    headers: { Authorization: `Bearer ${session.id}` },
  });
  const getRes = await handler(getReq);
  assert.strictEqual(getRes.status, 200);
  const getData = await getRes.json();
  assert.strictEqual(getData.credentials.length, 1);
  assert.strictEqual(getData.credentials[0].name, 'iPhone 15 Pro');
  assert.strictEqual(getData.credentials[0].aaguid, 'dd48324f-6371-4f9a-bd29-0e0ecb3c4720');

  // 2. PATCH /credentials (Rename)
  const patchReq = new Request('http://localhost:3000/api/auth/credentials', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${session.id}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ credentialId: 'cred_device_1', name: 'Personal iPhone' }),
  });
  const patchRes = await handler(patchReq);
  assert.strictEqual(patchRes.status, 200);

  // 3. DELETE /credentials (Revoke)
  const delReq = new Request('http://localhost:3000/api/auth/credentials', {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${session.id}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ credentialId: 'cred_device_1' }),
  });
  const delRes = await handler(delReq);
  assert.strictEqual(delRes.status, 200);

  // Verify list is now empty
  const getEmptyRes = await handler(getReq);
  const getEmptyData = await getEmptyRes.json();
  assert.strictEqual(getEmptyData.credentials.length, 0);
});
