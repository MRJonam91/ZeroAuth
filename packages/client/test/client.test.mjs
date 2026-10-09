import test from 'node:test';
import assert from 'node:assert';
import {
  isWebAuthnSupported,
  isConditionalUIAvailable,
  isPlatformAuthenticatorAvailable,
  normalizeWebAuthnError,
  ZeroAuthClientError,
  startPasskeyRegistration,
  startPasskeyAuthentication,
} from '../dist/index.js';

test('Client: isWebAuthnSupported returns false in non-browser environment', () => {
  assert.strictEqual(isWebAuthnSupported(), false);
});

test('Client: normalizeWebAuthnError translates DOMExceptions correctly', () => {
  const notAllowed = new Error('User refused');
  notAllowed.name = 'NotAllowedError';
  const err1 = normalizeWebAuthnError(notAllowed);
  assert.strictEqual(err1.code, 'USER_CANCELLED');
  assert.strictEqual(err1.name, 'ZeroAuthClientError');

  const invalidState = new Error('Key exists');
  invalidState.name = 'InvalidStateError';
  const err2 = normalizeWebAuthnError(invalidState);
  assert.strictEqual(err2.code, 'INVALID_STATE');

  const securityErr = new Error('Bad origin');
  securityErr.name = 'SecurityError';
  const err3 = normalizeWebAuthnError(securityErr);
  assert.strictEqual(err3.code, 'SECURITY_ERROR');

  const timeoutErr = new Error('Timed out');
  timeoutErr.name = 'TimeoutError';
  const err4 = normalizeWebAuthnError(timeoutErr);
  assert.strictEqual(err4.code, 'TIMEOUT');

  const notSupported = new Error('Algorithm not supported');
  notSupported.name = 'NotSupportedError';
  const err5 = normalizeWebAuthnError(notSupported);
  assert.strictEqual(err5.code, 'NOT_SUPPORTED');

  const unknown = new Error('Random issue');
  unknown.name = 'CustomError';
  const err6 = normalizeWebAuthnError(unknown);
  assert.strictEqual(err6.code, 'UNKNOWN');
  assert.strictEqual(err6.message, 'Random issue');

  // Idempotency check: already a ZeroAuthClientError
  const same = normalizeWebAuthnError(err1);
  assert.strictEqual(same, err1);
});

test('Client: startPasskeyRegistration rejects cleanly when WebAuthn is unsupported', async () => {
  await assert.rejects(
    async () => {
      await startPasskeyRegistration({
        rp: { name: 'Test App', id: 'localhost' },
        user: { id: 'u1', name: 'user', displayName: 'User' },
        challenge: 'dGVzdGNoYWxsZW5nZQ',
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      });
    },
    (err) => {
      assert(err instanceof ZeroAuthClientError);
      assert.strictEqual(err.code, 'NOT_SUPPORTED');
      return true;
    }
  );
});

test('Client: startPasskeyAuthentication rejects cleanly when WebAuthn is unsupported', async () => {
  await assert.rejects(
    async () => {
      await startPasskeyAuthentication({
        challenge: 'dGVzdGNoYWxsZW5nZQ',
        rpId: 'localhost',
      });
    },
    (err) => {
      assert(err instanceof ZeroAuthClientError);
      assert.strictEqual(err.code, 'NOT_SUPPORTED');
      return true;
    }
  );
});

test('Client: mock browser WebAuthn support and platform detection', async () => {
  // Simulate window.PublicKeyCredential
  globalThis.window = {
    PublicKeyCredential: Object.assign(
      function PublicKeyCredential() {},
      {
        isConditionalMediationAvailable: async () => true,
        isUserVerifyingPlatformAuthenticatorAvailable: async () => true,
      }
    ),
  };
  globalThis.PublicKeyCredential = globalThis.window.PublicKeyCredential;

  try {
    assert.strictEqual(isWebAuthnSupported(), true);
    const conditional = await isConditionalUIAvailable();
    assert.strictEqual(conditional, true);
    const platform = await isPlatformAuthenticatorAvailable();
    assert.strictEqual(platform, true);
  } finally {
    delete globalThis.window;
    delete globalThis.PublicKeyCredential;
  }
});
