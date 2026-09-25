import test from 'node:test';
import assert from 'node:assert';
import { SqliteStorageAdapter } from '../dist/index.js';

test('SqliteStorageAdapter: User operations (create, getById, getByUsername)', async () => {
  const storage = new SqliteStorageAdapter({ filename: ':memory:' });

  const created = await storage.createUser({
    id: 'user_123',
    username: 'indie_builder',
    displayName: 'Indie Builder',
  });

  assert.strictEqual(created.id, 'user_123');
  assert.strictEqual(created.username, 'indie_builder');

  const byId = await storage.getUserById('user_123');
  assert.ok(byId !== null);
  assert.strictEqual(byId.username, 'indie_builder');

  const byUsername = await storage.getUserByUsername('INDIE_BUILDER'); // case insensitive
  assert.ok(byUsername !== null);
  assert.strictEqual(byUsername.id, 'user_123');
});

test('SqliteStorageAdapter: Credential operations (save, list, update counter, delete)', async () => {
  const storage = new SqliteStorageAdapter({ filename: ':memory:' });

  const cred = {
    id: 'cred_abc',
    userId: 'user_123',
    publicKey: new Uint8Array([1, 2, 3, 4, 5]),
    counter: 0,
    deviceType: 'singleDevice',
    backedUp: false,
    name: 'MacBook Touch ID',
    createdAt: new Date(),
  };

  await storage.saveCredential(cred);

  const retrieved = await storage.getCredentialById('cred_abc');
  assert.ok(retrieved !== null);
  assert.strictEqual(retrieved.userId, 'user_123');
  assert.deepStrictEqual(Array.from(retrieved.publicKey), [1, 2, 3, 4, 5]);

  const userCreds = await storage.listCredentialsByUserId('user_123');
  assert.strictEqual(userCreds.length, 1);

  await storage.updateCredentialCounter('cred_abc', 5);
  const updated = await storage.getCredentialById('cred_abc');
  assert.strictEqual(updated.counter, 5);

  await storage.deleteCredential('cred_abc');
  const deleted = await storage.getCredentialById('cred_abc');
  assert.strictEqual(deleted, null);
});

test('SqliteStorageAdapter: Challenge operations with expiration', async () => {
  const storage = new SqliteStorageAdapter({ filename: ':memory:' });

  const activeChallenge = {
    challenge: 'chal_active',
    userId: 'user_1',
    type: 'registration',
    expiresAt: new Date(Date.now() + 60_000),
  };

  await storage.saveChallenge(activeChallenge);
  const fetched = await storage.getChallenge('chal_active');
  assert.ok(fetched !== null);

  const expiredChallenge = {
    challenge: 'chal_expired',
    userId: 'user_1',
    type: 'authentication',
    expiresAt: new Date(Date.now() - 1000), // already expired
  };

  await storage.saveChallenge(expiredChallenge);
  const fetchedExpired = await storage.getChallenge('chal_expired');
  assert.strictEqual(fetchedExpired, null); // auto-purged
});
