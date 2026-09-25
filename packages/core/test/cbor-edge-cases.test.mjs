import test from 'node:test';
import assert from 'node:assert';
import { decodeCbor } from '../dist/index.js';

test('CBOR Edge Cases: negative integers, large integers, booleans, null', () => {
  // 0x20 -> -1
  assert.strictEqual(decodeCbor(new Uint8Array([0x20])), -1);
  // 0x29 -> -10
  assert.strictEqual(decodeCbor(new Uint8Array([0x29])), -10);
  // 0x38, 0x63 -> -100 (-1 - 99)
  assert.strictEqual(decodeCbor(new Uint8Array([0x38, 0x63])), -100);

  // Simple values: false (0xf4), true (0xf5), null (0xf6), undefined (0xf7)
  assert.strictEqual(decodeCbor(new Uint8Array([0xf4])), false);
  assert.strictEqual(decodeCbor(new Uint8Array([0xf5])), true);
  assert.strictEqual(decodeCbor(new Uint8Array([0xf6])), null);
  assert.strictEqual(decodeCbor(new Uint8Array([0xf7])), undefined);
});

test('CBOR Edge Cases: empty string, empty bytes, empty map, empty array', () => {
  // Empty text string: 0x60
  assert.strictEqual(decodeCbor(new Uint8Array([0x60])), '');
  // Empty byte string: 0x40
  assert.deepStrictEqual(decodeCbor(new Uint8Array([0x40])), new Uint8Array(0));
  // Empty array: 0x80
  assert.deepStrictEqual(decodeCbor(new Uint8Array([0x80])), []);
  // Empty map: 0xa0
  const emptyMap = decodeCbor(new Uint8Array([0xa0]));
  assert.ok(emptyMap instanceof Map);
  assert.strictEqual(emptyMap.size, 0);
});

test('CBOR Edge Cases: truncated buffer throws error', () => {
  // Text string length 10 but only 2 bytes provided: 0x6a, 0x41, 0x42
  assert.throws(() => {
    decodeCbor(new Uint8Array([0x6a, 0x41, 0x42]));
  }, /CBOR/);
});
