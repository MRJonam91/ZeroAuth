import test from 'node:test';
import assert from 'node:assert';
import { aaguidBytesToUuid, lookupAAGUID } from '../dist/index.js';

test('AAGUID: Converts 16-byte buffer to formatted UUID string', () => {
  // Apple iCloud Keychain: dd48324f-6371-4f9a-bd29-0e0ecb3c4720
  const bytes = new Uint8Array([
    0xdd, 0x48, 0x32, 0x4f,
    0x63, 0x71,
    0x4f, 0x9a,
    0xbd, 0x29,
    0x0e, 0x0e, 0xcb, 0x3c, 0x47, 0x20,
  ]);

  const uuid = aaguidBytesToUuid(bytes);
  assert.strictEqual(uuid, 'dd48324f-6371-4f9a-bd29-0e0ecb3c4720');
});

test('AAGUID: Identifies known authenticators (Apple, Windows Hello, Yubico, Google)', () => {
  const apple = lookupAAGUID('dd48324f-6371-4f9a-bd29-0e0ecb3c4720');
  assert.strictEqual(apple.vendor, 'Apple');
  assert.strictEqual(apple.name, 'iCloud Keychain (Passkey)');

  const winHello = lookupAAGUID('08987058-cadc-4b81-b6e1-30de50dcbe96');
  assert.strictEqual(winHello.vendor, 'Microsoft');
  assert.strictEqual(winHello.name, 'Windows Hello');

  const yubi = lookupAAGUID('ee882879-7216-4633-9b2f-ffac658d7080');
  assert.strictEqual(yubi.vendor, 'Yubico');
  assert.strictEqual(yubi.type, 'cross-platform');

  const google = lookupAAGUID('ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4');
  assert.strictEqual(google.vendor, 'Google');
  assert.strictEqual(google.name, 'Google Password Manager');
});

test('AAGUID: Gracefully handles unknown authenticators', () => {
  const unknown = lookupAAGUID('ffffffff-ffff-ffff-ffff-ffffffffffff');
  assert.strictEqual(unknown.vendor, 'Unknown Authenticator');
  assert.strictEqual(unknown.name, 'Passkey Hardware Device');
});
