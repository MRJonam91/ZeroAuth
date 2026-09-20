import test from 'node:test';
import assert from 'node:assert';
import { generateChallenge, uint8ArrayToBase64Url, base64UrlToUint8Array } from '../dist/index.js';

test('generateChallenge produces url-safe base64 strings', () => {
  const c1 = generateChallenge(32);
  const c2 = generateChallenge(32);

  assert.ok(c1.length > 0);
  assert.ok(c2.length > 0);
  assert.notStrictEqual(c1, c2);
  assert.strictEqual(/^[A-Za-z0-9_-]+$/.test(c1), true);
});

test('base64url roundtrip conversion', () => {
  const original = new Uint8Array([0, 1, 2, 250, 254, 255]);
  const encoded = uint8ArrayToBase64Url(original);
  const decoded = base64UrlToUint8Array(encoded);

  assert.deepStrictEqual(Array.from(decoded), Array.from(original));
});
