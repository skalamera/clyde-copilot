const crypto = require('crypto');

// Hardcoded public key for verifying license signatures
// In production, rotate this and keep the corresponding private key secure in your Vercel backend/Stripe webhooks environment.
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA25D1KTtgHaLzFYL1ZH21
O8ExAMh1dn0oySS26Fs8SnHAutTKfoSjNGScHj7chdKwBgxREJ0J9K+cR9Ihibir
Ltieh2cRaDVuBCeOIOnBmiIR6A6AdpsrBRBJ9nRECD28ttx8egQcCmSFHlzHuath
TQ30b/4vzUS9IS6qhW7P6KtOdfFvpRvbAx0RxkoK1vK0Fho1cmY8wMEPMCkcNtPB
3DTn0HQHaVyKYI9Azg005uIabHNlhHDP8bVmP8JU4KnztTiVV+O576SjcC5CJPCp
VVQiO002UeqTLI7zBHQOJEuRjqUKIkt83Cai8zw/tYSutF/btjtiPjDJL9C8qkTw
OwIDAQAB
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
