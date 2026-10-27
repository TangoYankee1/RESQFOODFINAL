// Local-only QR signing key shared by emulator function workers. Never print it.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const file = path.join(__dirname, '../functions/.env.local');
const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
if (!/^QR_HMAC_SECRET=.+$/m.test(existing)) {
  fs.writeFileSync(file, existing + (existing && !existing.endsWith('\n') ? '\n' : '')
    + `QR_HMAC_SECRET=${crypto.randomBytes(32).toString('hex')}\n`);
}
console.log('Local emulator signing configuration is ready.');
