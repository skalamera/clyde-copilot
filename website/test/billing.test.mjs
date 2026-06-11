import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const apiRoot = path.resolve('website/api');

test('entitlements reconciles Stripe by email when the Supabase subscription row is missing', () => {
  const source = fs.readFileSync(path.join(apiRoot, 'billing.js'), 'utf8');

  assert.match(source, /reconcileSubscriptionByEmail/);
  assert.match(source, /record = await reconcileSubscriptionByEmail\(user\)/);
});

test('checkout reuses an existing Stripe customer by email and stores user metadata', () => {
  const source = fs.readFileSync(path.join(apiRoot, 'billing.js'), 'utf8');

  assert.match(source, /stripe\.customers\.list\(\{ email, limit: 1 \}\)/);
  assert.match(source, /stripe\.customers\.update\(customerId/);
  assert.match(source, /customer: customerId \|\| undefined/);
  assert.match(source, /customer_email: customerId \? undefined : email \|\| undefined/);
});

test('signup endpoint handles duplicate Supabase emails without revealing account existence', () => {
  const source = fs.readFileSync(path.join(apiRoot, 'sign-up.js'), 'utf8');

  assert.match(source, /listSupabaseUsersByEmail\(email\)/);
  // Anti-enumeration: duplicate email must return a success-shaped response,
  // never a 409 / "already exists" oracle.
  assert.match(source, /Anti-enumeration/);
  assert.doesNotMatch(source, /sendJson\(res, 409/);
  assert.doesNotMatch(source, /An account already exists for this email/);
});

test('Pro signup checkout rejects duplicate email without revealing account existence', () => {
  const source = fs.readFileSync(path.join(apiRoot, 'billing.js'), 'utf8');

  assert.match(source, /listSupabaseUsersByEmail\(email\)/);
  // Anti-enumeration: generic 400, no "already exists" oracle.
  assert.match(source, /Anti-enumeration/);
  assert.doesNotMatch(source, /sendJson\(res, 409/);
  assert.doesNotMatch(source, /An account already exists for this email/);
  assert.doesNotMatch(source, /\/auth\/v1\/signup/);
  assert.doesNotMatch(source, /body\.password/);
  assert.doesNotMatch(source, /email_redirect_to/);
  assert.match(source, /stripe\.customers\.list\(\{ email, limit: 1 \}\)/);
  assert.match(source, /stripe\.customers\.update\(customerId/);
  assert.match(source, /pendingProSignupEmail: email/);
  assert.match(source, /client_reference_id: email/);
  assert.match(source, /subscription_data: \{\s*metadata: \{\s*pendingProSignupEmail: email/);
});

test('Stripe webhook invites the Supabase user after checkout is complete', () => {
  const source = fs.readFileSync(path.join(apiRoot, 'stripe-webhook.js'), 'utf8');
  const billingSource = fs.readFileSync(path.join(apiRoot, '_billing.js'), 'utf8');

  assert.match(source, /checkout\.session\.completed/);
  assert.match(source, /activatePaidCheckoutSession\(session\.id\)/);
  assert.match(source, /inviteSupabaseUserByEmail\(resolvedEmail\)/);
  assert.match(source, /listSupabaseUsersByEmail\(resolvedEmail\)/);
  assert.match(source, /stripe\.customers\.update\(customerId/);
  assert.match(source, /stripe\.subscriptions\.update\(subscription\.id/);
  assert.match(billingSource, /export async function inviteSupabaseUserByEmail/);
  assert.match(billingSource, /\/auth\/v1\/invite/);
  assert.match(billingSource, /redirect_to/);
});

test('checkout activation endpoint verifies paid checkout and sends invite', () => {
  const source = fs.readFileSync(path.join(apiRoot, 'billing.js'), 'utf8');
  const billingSource = fs.readFileSync(path.join(apiRoot, '_billing.js'), 'utf8');

  assert.match(source, /activatePaidCheckoutSession\(body\.sessionId\)/);
  assert.match(billingSource, /export async function activatePaidCheckoutSession/);
  assert.match(billingSource, /stripe\.checkout\.sessions\.retrieve\(cleanSessionId/);
  assert.match(billingSource, /expand: \['subscription', 'customer'\]/);
  assert.match(billingSource, /inviteSupabaseUserByEmail\(email\)/);
  assert.match(billingSource, /upsertSubscriptionRecord/);
});

test('Google OAuth token endpoint keeps the client secret on the website API', () => {
  const source = fs.readFileSync(path.join(apiRoot, 'google-oauth-token.js'), 'utf8');

  assert.match(source, /CLYDE_GOOGLE_OAUTH_CLIENT_SECRET/);
  assert.match(source, /oauth2\.googleapis\.com\/token/);
  assert.match(source, /grantType === 'authorization_code'/);
  assert.match(source, /grantType === 'refresh_token'/);
  assert.doesNotMatch(source, /sendJson\(res, 200, \{ clientSecret/);
});

test('invite completion endpoint updates the password with the invite access token', () => {
  const source = fs.readFileSync(path.join(apiRoot, 'complete-invite.js'), 'utf8');

  assert.match(source, /\/auth\/v1\/user/);
  assert.match(source, /method: 'PUT'/);
  assert.match(source, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.match(source, /body: JSON\.stringify\(\{ password \}\)/);
});
