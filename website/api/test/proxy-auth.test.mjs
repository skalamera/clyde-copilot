import assert from 'node:assert/strict';
import { test } from 'node:test';
import crypto from 'node:crypto';

process.env.CLYDE_LICENSE_SIGNING_SECRET = 'test-secret';
process.env.CLYDE_PROXY_CHAT_RPM = '3';

const { verifySignedLicenseToken, checkRateLimit } = await import('../proxy.js');

const USER_ID = '123e4567-e89b-12d3-a456-426614174000';

function sign(userId, secret = 'test-secret') {
  return crypto.createHmac('sha256', secret).update(userId).digest('base64url');
}

test('valid signed license token verifies', () => {
  const token = `clyde_lic_${USER_ID}.${sign(USER_ID)}`;
  const user = verifySignedLicenseToken(token);
  assert.ok(user);
  assert.equal(user.id, USER_ID);
});

test('token signed with wrong secret is rejected', () => {
  const token = `clyde_lic_${USER_ID}.${sign(USER_ID, 'wrong-secret')}`;
  assert.equal(verifySignedLicenseToken(token), null);
});

test('bare UUID is not a valid signed token', () => {
  assert.equal(verifySignedLicenseToken(USER_ID), null);
});

test('garbage tokens are rejected', () => {
  assert.equal(verifySignedLicenseToken(''), null);
  assert.equal(verifySignedLicenseToken('clyde_lic_not-a-uuid.abc123abc123abc123'), null);
  assert.equal(verifySignedLicenseToken(`clyde_lic_${USER_ID}.`), null);
});

test('rate limiter enforces per-user per-type limits', () => {
  const userId = crypto.randomUUID();
  assert.equal(checkRateLimit(userId, 'chat'), true);
  assert.equal(checkRateLimit(userId, 'chat'), true);
  assert.equal(checkRateLimit(userId, 'chat'), true);
  assert.equal(checkRateLimit(userId, 'chat'), false, '4th call within window should be limited (RPM=3)');
  // Different user is unaffected
  assert.equal(checkRateLimit(crypto.randomUUID(), 'chat'), true);
  // Different type for same user has its own bucket
  assert.equal(checkRateLimit(userId, 'embed'), true);
});
