const crypto = require('crypto');

// Hardcoded public key for verifying license signatures
// In production, rotate this and keep the corresponding private key secure in your Vercel backend/Stripe webhooks environment.
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyzSKVVjHXx6tlAIa5pbB
i/UxZgM7kiecMD0Njxq+wkkGCbKd3tqPHfHCNZKbiWlviQz7AtYVBRcHufGQkaqC
vMsnT24pXeDv4p64j83o3uz9bVEcp6jMIlzg5XNaQyO3o25WjnkGBQWXwL2EdrEO
PCi5p2m9qjFzniVAUqvrNZfv+GhCYuCscOG6eLDzkCm1Wm7zjDPfBaTDfcVAwsQD
+016OOW9sxwIgQ8svxXH4vd/CjgC+EsbDyQXTinQXUWduZSxMAbPZEjEMNATDUAj
ZWV6c01XZl90sBmLfMrImuqcntQVHk21L0gTFDsxbcyCH2lPBu5dWhk44VNU5JFQ
3QIDAQAB
-----END PUBLIC KEY-----`;

/**
 * Validates a Clyde BYOK cryptographic license key.
 * Format: clyde_lic_byok_<email>.<signature_base64url>
 *
 * @param {string} licenseKey The license key to validate
 * @returns {boolean} True if the key is valid, false otherwise
 */
function validateLicenseKey(licenseKey) {
  if (typeof licenseKey !== 'string' || !licenseKey.startsWith('clyde_lic_byok_')) {
    return false;
  }

  try {
    const rawKey = licenseKey.slice('clyde_lic_byok_'.length);
    const parts = rawKey.split('.');
    if (parts.length !== 2) {
      return false;
    }

    const [emailEncoded, signatureBase64] = parts;
    const email = Buffer.from(emailEncoded, 'base64url').toString('utf8');

    // Create the verifier
    const verify = crypto.createVerify('SHA256');
    verify.update(email);
    verify.end();

    const signature = Buffer.from(signatureBase64, 'base64url');
    
    // Reference PUBLIC_KEY_PEM via module.exports to allow test mocking
    return verify.verify(module.exports.PUBLIC_KEY_PEM, signature);
  } catch (error) {
    // Only log severe non-signature errors to prevent test pollution
    if (!error.message.includes('decode error') && !error.message.includes('unsupported')) {
      console.error('License key verification error:', error);
    }
    return false;
  }
}

module.exports = {
  validateLicenseKey,
  PUBLIC_KEY_PEM
};
