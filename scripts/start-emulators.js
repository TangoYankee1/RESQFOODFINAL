const { spawn } = require('node:child_process');
const path = require('node:path');
require('./setup-emulator');
const child = spawn('firebase', ['emulators:start', '--only', 'auth,firestore,functions,storage,hosting', '--project', 'resqfood-ec8f5'], {
  stdio: 'inherit', shell: process.platform === 'win32',
  env: { ...process.env, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || path.resolve(__dirname, '../.local-config'),
    FUNCTIONS_DISCOVERY_TIMEOUT: process.env.FUNCTIONS_DISCOVERY_TIMEOUT || '60' },
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code || 0; });
