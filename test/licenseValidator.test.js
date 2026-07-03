const assert = require('node:assert/strict');
const test = require('node:test');
const crypto = require('crypto');
const { validateLicenseKey } = require('../src/licenseValidator');

test('validateLicenseKey rejects invalid keys', () => {
  assert.equal(validateLicenseKey(null), false);
  assert.equal(validateLicenseKey(undefined), false);
  assert.equal(validateLicenseKey(''), false);
  assert.equal(validateLicenseKey('invalid_prefix_someemail.signature'), false);
  assert.equal(validateLicenseKey('clyde_lic_byok_onlyemailnosignature'), false);
  assert.equal(validateLicenseKey('clyde_lic_byok_email.too.many.dots'), false);
  assert.equal(validateLicenseKey('clyde_lic_byok_dGVzdEBleGFtcGxlLmNvbQ==.d3Jvbmc='), false);
});

test('validateLicenseKey handles cryptographic signatures correctly (test keypair)', () => {
  // 1. Generate a temporary keypair for testing
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048
  });

  const email = 'test@clydeai.live';
  const emailEncoded = Buffer.from(email).toString('base64url');

  // 2. Create signature using the test private key
  const sign = crypto.createSign('SHA256');
  sign.update(email);
  sign.end();
  const signatureBase64 = sign.sign(privateKey).toString('base64url');

  const licenseKey = `clyde_lic_byok_${emailEncoded}.${signatureBase64}`;

  // 3. Inject our test public key into the validator module temporarily
  const licenseValidator = require('../src/licenseValidator');
  const originalPublicKey = licenseValidator.PUBLIC_KEY_PEM;
  
  try {
    licenseValidator.PUBLIC_KEY_PEM = publicKey.export({ type: 'spki', format: 'pem' });

    // 4. Verify signature validation works
    assert.equal(licenseValidator.validateLicenseKey(licenseKey), true);
    
    // 5. Verify tampered emails fail validation
    const tamperedLicenseKey = `clyde_lic_byok_${Buffer.from('other@clydeai.live').toString('base64url')}.${signatureBase64}`;
    assert.equal(licenseValidator.validateLicenseKey(tamperedLicenseKey), false);

    // 6. Verify tampered signatures fail validation
    const tamperedSigKey = `clyde_lic_byok_${emailEncoded}.invalid_sig_part`;
    assert.equal(licenseValidator.validateLicenseKey(tamperedSigKey), false);
  } finally {
    // Restore original public key
    licenseValidator.PUBLIC_KEY_PEM = originalPublicKey;
  }
});
