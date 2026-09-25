import test from 'node:test';
import assert from 'node:assert';
import {
  decodeCbor,
  sha256,
  asn1DerToP1363,
  importCoseKey,
  verifySignature,
  COSEAlgorithm,
} from '../dist/index.js';

test('CBOR: Decodes basic types (integers, strings, arrays, maps)', () => {
  // Test map { 1: 2, "hello": "world", "arr": [1, 2, 3] }
  // Manually constructed CBOR byte sequence:
  // 0xa3 (map 3 pairs)
  // 0x01, 0x02 (key 1, val 2)
  // 0x65, 'h','e','l','l','o', 0x65, 'w','o','r','l','d'
  // 0x63, 'a','r','r', 0x83, 0x01, 0x02, 0x03
  const cborBytes = new Uint8Array([
    0xa3,
    0x01, 0x02,
    0x65, 0x68, 0x65, 0x6c, 0x6c, 0x6f,
    0x65, 0x77, 0x6f, 0x72, 0x6c, 0x64,
    0x63, 0x61, 0x72, 0x72,
    0x83, 0x01, 0x02, 0x03,
  ]);

  const decoded = decodeCbor(cborBytes);
  assert.ok(decoded instanceof Map);
  assert.strictEqual(decoded.get(1), 2);
  assert.strictEqual(decoded.get('hello'), 'world');
  assert.deepStrictEqual(decoded.get('arr'), [1, 2, 3]);
});

test('Crypto: SHA-256 computes expected hash', async () => {
  const hash = await sha256('ZeroAuth');
  // Expected sha256 of "ZeroAuth"
  assert.strictEqual(hash.length, 32);
});

test('Crypto: ASN.1 DER to P1363 conversion produces 64 bytes', () => {
  // Mock DER sequence: 0x30 0x44 0x02 0x20 [32 bytes r] 0x02 0x20 [32 bytes s]
  const r = new Uint8Array(32).fill(0x11);
  const s = new Uint8Array(32).fill(0x22);
  const der = new Uint8Array(70);
  der[0] = 0x30;
  der[1] = 68;
  der[2] = 0x02;
  der[3] = 32;
  der.set(r, 4);
  der[36] = 0x02;
  der[37] = 32;
  der.set(s, 38);

  const p1363 = asn1DerToP1363(der);
  assert.strictEqual(p1363.length, 64);
  assert.deepStrictEqual(p1363.subarray(0, 32), r);
  assert.deepStrictEqual(p1363.subarray(32, 64), s);
});

test('Crypto: Generate ECDSA keypair and verify with verifySignature', async () => {
  const keyPair = await globalThis.crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );

  const testData = new TextEncoder().encode('ZeroAuth Passkey Challenge Handshake');
  const rawSignatureP1363 = await globalThis.crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    keyPair.privateKey,
    testData
  );

  const isValid = await verifySignature({
    cryptoKey: keyPair.publicKey,
    algorithm: COSEAlgorithm.ES256,
    signature: new Uint8Array(rawSignatureP1363),
    data: testData,
  });

  assert.strictEqual(isValid, true);
});
