import test from 'node:test';
import assert from 'node:assert';
import {
  ZeroAuthServer,
  MemoryStorageAdapter,
} from '../dist/index.js';
import {
  uint8ArrayToBase64Url,
  verifyAuthenticationResponse,
  COSEAlgorithm,
  sha256,
} from '@zeroauth/core';

test('Security: Origin mismatch rejection (Anti-Phishing)', async () => {
  const clientData = {
    type: 'webauthn.get',
    challenge: 'valid_chal',
    origin: 'https://fake-phishing-domain.com', // Evil phishing domain
  };
  const clientDataJSON = uint8ArrayToBase64Url(
    new TextEncoder().encode(JSON.stringify(clientData))
  );

  await assert.rejects(
    async () => {
      await verifyAuthenticationResponse({
        response: {
          clientDataJSON,
          authenticatorData: uint8ArrayToBase64Url(new Uint8Array(37)),
          signature: uint8ArrayToBase64Url(new Uint8Array(64)),
        },
        expectedChallenge: 'valid_chal',
        expectedOrigin: 'https://my-legit-app.com', // Expected legit domain
        expectedRpId: 'my-legit-app.com',
        credentialPublicKey: new Uint8Array(65),
      });
    },
    /Origin mismatch/
  );
});

test('Security: Challenge mismatch rejection (Anti-Replay)', async () => {
  const clientData = {
    type: 'webauthn.get',
    challenge: 'stale_old_challenge',
    origin: 'https://my-legit-app.com',
  };
  const clientDataJSON = uint8ArrayToBase64Url(
    new TextEncoder().encode(JSON.stringify(clientData))
  );

  await assert.rejects(
    async () => {
      await verifyAuthenticationResponse({
        response: {
          clientDataJSON,
          authenticatorData: uint8ArrayToBase64Url(new Uint8Array(37)),
          signature: uint8ArrayToBase64Url(new Uint8Array(64)),
        },
        expectedChallenge: 'fresh_server_challenge',
        expectedOrigin: 'https://my-legit-app.com',
        expectedRpId: 'my-legit-app.com',
        credentialPublicKey: new Uint8Array(65),
      });
    },
    /challenge mismatch/
  );
});

test('Security: Cloned authenticator detection via signature counter', async () => {
  // Create an authenticatorData with valid rpIdHash and signCount = 5
  const authData = new Uint8Array(37);
  const rpIdHash = await sha256('localhost');
  authData.set(rpIdHash, 0);
  // Set UP flag (byte 32 = 0x01)
  authData[32] = 0x01;
  // Set signCount = 5 (bytes 33..37)
  new DataView(authData.buffer).setUint32(33, 5, false);

  const clientData = {
    type: 'webauthn.get',
    challenge: 'active_chal',
    origin: 'http://localhost:3000',
  };
  const clientDataJSON = uint8ArrayToBase64Url(
    new TextEncoder().encode(JSON.stringify(clientData))
  );

  // If previous counter is already 10, received 5 indicates cloned or rolled-back credential!
  await assert.rejects(
    async () => {
      await verifyAuthenticationResponse({
        response: {
          clientDataJSON,
          authenticatorData: uint8ArrayToBase64Url(authData),
          signature: uint8ArrayToBase64Url(new Uint8Array(64)),
        },
        expectedChallenge: 'active_chal',
        expectedOrigin: 'http://localhost:3000',
        expectedRpId: 'localhost',
        credentialPublicKey: new Uint8Array(65),
        previousCounter: 10, // Higher than received signCount!
      });
    },
    /authenticator cloning detected/
  );
});

test('Security: Expired challenges are automatically rejected by ZeroAuthServer', async () => {
  const storage = new MemoryStorageAdapter();
  const server = new ZeroAuthServer({
    rp: { name: 'SecTest', id: 'localhost', origin: 'http://localhost:3000' },
    storage,
    challengeTtlSeconds: 0, // Immediately expired
    silent: true,
  });

  const opts = await server.createRegistrationOptions({ username: 'alice' });

  // Fast forward by waiting a brief instant so timestamp expires
  await new Promise((r) => setTimeout(r, 50));

  const clientData = {
    type: 'webauthn.create',
    challenge: opts.challenge,
    origin: 'http://localhost:3000',
  };

  await assert.rejects(
    async () => {
      await server.verifyRegistration({
        username: 'alice',
        response: {
          clientDataJSON: uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(clientData))),
          attestationObject: 'dummy',
        },
      });
    },
    /challenge not found or expired/
  );
});
