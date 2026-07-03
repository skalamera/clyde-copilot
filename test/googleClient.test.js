const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const { GOOGLE_SCOPES, createGoogleClient, describeGoogleError, oauthParams } = require('../src/googleClient');

test('google sync requests only read scopes for current local action flow', () => {
  assert.deepEqual(GOOGLE_SCOPES, [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ]);
});

test('google API errors include response status and OAuth details', () => {
  const message = describeGoogleError({
    response: {
      status: 400,
      data: {
        error: 'invalid_request',
        error_description: 'client_secret is missing'
      }
    }
  });

  assert.equal(message, 'HTTP 400: invalid_request: client_secret is missing');
});

test('loopback callback page does not claim the token exchange is complete', () => {
  const source = fs.readFileSync(require.resolve('../src/googleClient'), 'utf8');

  assert.doesNotMatch(source, /Clyde is connected to Google/);
  assert.match(source, /Return to Clyde to finish connecting/);
});

test('OAuth params include client secret only when configured', () => {
  assert.equal(
    oauthParams({ client_id: 'abc', client_secret: '', grant_type: 'authorization_code' }).toString(),
    'client_id=abc&grant_type=authorization_code'
  );

  assert.equal(
    oauthParams({ client_id: 'abc', client_secret: 'secret', grant_type: 'authorization_code' }).toString(),
    'client_id=abc&client_secret=secret&grant_type=authorization_code'
  );
});

test('Google token proxy path posts JSON instead of requiring a desktop client secret', async () => {
  const posts = [];
  const client = createGoogleClient({
    now: () => 0,
    axiosClient: {
      post: async (url, body, options) => {
        posts.push({ url, body, options });
        return { data: { access_token: 'next-token', expires_in: 3600 } };
      }
    }
  });

  const tokens = await client.refreshAccessToken({
    clientId: 'client-id',
    refreshToken: 'refresh-token',
    tokenEndpoint: 'https://clydeai.live/api/google-oauth-token'
  });

  assert.equal(tokens.access_token, 'next-token');
  assert.equal(posts[0].url, 'https://clydeai.live/api/google-oauth-token');
  assert.equal(posts[0].options.headers['content-type'], 'application/json');
  assert.deepEqual(posts[0].body, {
    clientId: 'client-id',
    code: undefined,
    codeVerifier: undefined,
    refreshToken: 'refresh-token',
    grantType: 'refresh_token',
    redirectUri: undefined
  });
});
