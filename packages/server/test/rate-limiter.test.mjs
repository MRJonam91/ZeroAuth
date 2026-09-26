import test from 'node:test';
import assert from 'node:assert';
import { RateLimiter } from '../dist/index.js';

test('RateLimiter: Allows requests within window and blocks exceeding attempts', () => {
  const limiter = new RateLimiter({
    maxRequests: 3,
    windowMs: 1000,
  });

  const ip = '192.168.1.50';

  // Request 1: Allowed
  const r1 = limiter.check(ip);
  assert.strictEqual(r1.allowed, true);
  assert.strictEqual(r1.remaining, 2);

  // Request 2: Allowed
  const r2 = limiter.check(ip);
  assert.strictEqual(r2.allowed, true);
  assert.strictEqual(r2.remaining, 1);

  // Request 3: Allowed
  const r3 = limiter.check(ip);
  assert.strictEqual(r3.allowed, true);
  assert.strictEqual(r3.remaining, 0);

  // Request 4: Blocked!
  const r4 = limiter.check(ip);
  assert.strictEqual(r4.allowed, false);
  assert.strictEqual(r4.remaining, 0);
  assert.ok(r4.resetMs > 0);

  // Different IP is independent
  const otherIp = '10.0.0.1';
  const rOther = limiter.check(otherIp);
  assert.strictEqual(rOther.allowed, true);
});
