import test from 'node:test';
import assert from 'node:assert';
import { ZeroAuthServer, MemoryStorageAdapter } from '../dist/index.js';

test('ZeroAuthServer generates valid registration options and saves challenge', async () => {
  const storage = new MemoryStorageAdapter();
  const server = new ZeroAuthServer({
    rp: {
      name: 'ZeroAuth Demo App',
      id: 'localhost',
      origin: 'http://localhost:3000',
    },
    storage,
  });

  const options = await server.createRegistrationOptions({
    username: 'indie_dev',
    displayName: 'Indie Developer',
  });

  assert.strictEqual(options.rp.id, 'localhost');
  assert.strictEqual(options.user.name, 'indie_dev');
  assert.ok(options.challenge.length > 0);

  // Verify challenge was saved in storage
  const savedChallenge = await storage.getChallenge(options.challenge);
  assert.ok(savedChallenge !== null);
  assert.strictEqual(savedChallenge.type, 'registration');
  assert.strictEqual(savedChallenge.userId, options.user.id);
});

test('ZeroAuthServer generates authentication options', async () => {
  const storage = new MemoryStorageAdapter();
  const server = new ZeroAuthServer({
    rp: {
      name: 'ZeroAuth Demo App',
      id: 'localhost',
      origin: 'http://localhost:3000',
    },
    storage,
  });

  const options = await server.createAuthenticationOptions();
  assert.strictEqual(options.rpId, 'localhost');
  assert.ok(options.challenge.length > 0);

  const savedChallenge = await storage.getChallenge(options.challenge);
  assert.ok(savedChallenge !== null);
  assert.strictEqual(savedChallenge.type, 'authentication');
});
