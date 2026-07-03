const crypto = require('crypto');

// Let's load the key from JSON using absolute path
const keys = require('C:/Users/skala/.gemini/antigravity-ide/brain/afda7612-26b5-42f0-82da-6e77927901b5/byok_keys.json');
const rawPrivateKey = keys.privateKey;

function testKey(keyString) {
  try {
    const sign = crypto.createSign('SHA256');
    sign.update('test@clydeai.live');
    sign.end();
    const sig = sign.sign(keyString).toString('base64url');
    console.log('SUCCESS:', sig.slice(0, 20) + '...');
  } catch (err) {
    console.error('FAIL:', err.message);
  }
}

console.log('--- Testing parsed JSON key directly (has actual newlines) ---');
testKey(rawPrivateKey);

console.log('\n--- Testing key with literal double quotes around it ---');
const keyWithQuotes = `"${rawPrivateKey}"`;
testKey(keyWithQuotes);

console.log('\n--- Testing key with single quotes around it ---');
const keyWithSingleQuotes = `'${rawPrivateKey}'`;
testKey(keyWithSingleQuotes);

console.log('\n--- Testing key with escaped \\n strings instead of newlines ---');
const keyWithEscapedN = rawPrivateKey.replace(/\n/g, '\\n');
testKey(keyWithEscapedN);

console.log('\n--- Testing normalized key (stripping quotes and replacing \\n) ---');
function normalizeKey(str) {
  if (!str) return str;
  let clean = str.trim();
  // Strip outer quotes if any
  if (clean.startsWith('"') && clean.endsWith('"')) {
    clean = clean.slice(1, -1);
  } else if (clean.startsWith("'") && clean.endsWith("'")) {
    clean = clean.slice(1, -1);
  }
  // Replace escaped \n
  clean = clean.replace(/\\n/g, '\n');
  return clean.trim();
}

console.log('Normalized keyWithQuotes:');
testKey(normalizeKey(keyWithQuotes));

console.log('Normalized keyWithEscapedN:');
testKey(normalizeKey(keyWithEscapedN));
