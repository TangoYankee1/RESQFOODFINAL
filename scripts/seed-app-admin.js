// Local-only administrator provisioning. Never print a password or reset on rerun.
const admin = require('firebase-admin');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function localHost(value, fallback) {
  const host = value || fallback;
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw new Error('Administrator setup requires loopback emulators.');
  return host;
}

async function provision({ reset = false, directory = path.join(__dirname, '../.local-config') } = {}) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = localHost(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
  process.env.FIRESTORE_EMULATOR_HOST = localHost(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080');
  const projectId = process.env.GCLOUD_PROJECT || 'resqfood-ec8f5';
  const app = admin.initializeApp({ projectId }, `admin-setup-${crypto.randomUUID()}`);
  const auth = app.auth(), db = app.firestore();
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const lock = path.join(directory, 'system-admin.lock');
  let locked = false;
  try {
    const fd = fs.openSync(lock, 'wx', 0o600);
    fs.closeSync(fd);
    locked = true;
    const registry = db.doc('systemConfig/systemAdministrator');
    const saved = await registry.get();
    const candidates = new Map();
    let token;
    do {
      const page = await auth.listUsers(1000, token);
      for (const u of page.users) if (u.customClaims?.role === 'systemAdmin') candidates.set(u.uid, u.email);
      token = page.pageToken;
    } while (token);
    const profiles = await db.collection('users').where('role', '==', 'systemAdmin').get();
    for (const doc of profiles.docs) candidates.set(doc.id, doc.data().email);
    if (saved.exists) candidates.set(saved.data().uid, saved.data().email);
    if (candidates.size > 1) throw new Error('Multiple administrator identities found. Restore a consistent snapshot; no accounts were removed.');

    const existingUid = candidates.keys().next().value;
    let account = existingUid ? await auth.getUser(existingUid).catch(e => {
      if (e.code === 'auth/user-not-found' && saved.data()?.state === 'provisioning') return null;
      throw e;
    }) : null;
    const email = (process.env.APP_ADMIN_EMAIL || account?.email || saved.data()?.email || candidates.get(existingUid) || 'systemadmin@resqfood.local').trim().toLowerCase();
    if (!email.includes('@')) throw new Error('APP_ADMIN_EMAIL must be an email address.');
    if (existingUid && email !== (account?.email || saved.data()?.email || candidates.get(existingUid))?.toLowerCase()) throw new Error('A system administrator already exists; a second email is not allowed.');
    if (reset && !account) throw new Error('No existing administrator to reset. Run seed:app-admin first.');
    if (!existingUid) {
      const collision = await auth.getUserByEmail(email).catch(e => { if (e.code === 'auth/user-not-found') return null; throw e; });
      if (collision) throw new Error('This email belongs to another account. It will not be promoted.');
    }
    const uid = existingUid || `system-admin-${crypto.randomUUID()}`;
    await db.runTransaction(async tx => {
      const current = await tx.get(registry);
      if (current.exists && current.data().uid !== uid) throw new Error('Another administrator setup won the reservation. Rerun setup.');
      if (!current.exists) tx.create(registry, { uid, email, state: account ? 'active' : 'provisioning', createdAt: new Date() });
    });
    const userRef = db.collection('users').doc(uid);
    const profile = await userRef.get();
    const credentialsFile = path.join(directory, 'system-admin-credentials.json');
    const pendingFile = path.join(directory, 'system-admin-credentials.pending.json');
    if (account && !reset) {
      if (account.disabled || account.customClaims?.role !== 'systemAdmin' || profile.data()?.role !== 'systemAdmin' || profile.data()?.status !== 'active') {
        throw new Error('Existing administrator needs recovery. Run reset:app-admin explicitly.');
      }
      // Recover a completed password operation interrupted before its file rename.
      if (fs.existsSync(pendingFile)) throw new Error('Interrupted credential operation detected. Run reset:app-admin explicitly.');
      return { uid, email, created: false, credentialsFile: fs.existsSync(credentialsFile) ? credentialsFile : null };
    }
    let credentials;
    if (!account && fs.existsSync(pendingFile)) {
      credentials = JSON.parse(fs.readFileSync(pendingFile, 'utf8'));
      if (credentials.uid !== uid || credentials.projectId !== projectId) throw new Error('Pending credential file belongs to another identity. Restore matching emulator data.');
    } else {
      credentials = { projectId, uid, email, password: crypto.randomBytes(24).toString('base64url'), login: 'http://localhost:5000/app-admin/login.html' };
      fs.writeFileSync(pendingFile, JSON.stringify(credentials, null, 2) + '\n', { mode: 0o600 });
    }
    const created = !account;
    if (account) {
      account = await auth.updateUser(uid, { password: credentials.password, disabled: false, emailVerified: true });
      await auth.revokeRefreshTokens(uid);
    } else {
      account = await auth.createUser({ uid, email, password: credentials.password, emailVerified: true, displayName: 'Local System Admin' });
    }
    await auth.setCustomUserClaims(uid, { ...account.customClaims, role: 'systemAdmin' });
    await db.runTransaction(async tx => {
      const current = await tx.get(registry);
      if (current.data()?.uid !== uid) throw new Error('Administrator reservation changed. Restore matching data.');
      tx.set(userRef, {
        fullName: profile.data()?.fullName || 'Local System Admin', email,
        role: 'systemAdmin', status: 'active', profileComplete: true,
        ...(!profile.exists ? { createdAt: new Date() } : {}), updatedAt: new Date(),
      }, { merge: true });
      tx.set(registry, { state: 'active', updatedAt: new Date() }, { merge: true });
    });
    fs.renameSync(pendingFile, credentialsFile);
    return { uid, email, created, reset, credentialsFile };
  } finally {
    if (locked) fs.unlinkSync(lock);
    await app.delete();
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--reset-password')) { console.error('Usage: node scripts/seed-app-admin.js [--reset-password]'); process.exitCode = 1; }
  else provision({ reset: args.includes('--reset-password') }).then(result => {
    console.log(result.created ? 'Local system administrator created.' : result.reset ? 'Administrator recovered; password rotated.' : 'Administrator already exists; password unchanged.');
    console.log(`Email: ${result.email}`);
    console.log('Login: http://localhost:5000/app-admin/login.html');
    console.log(result.credentialsFile ? `Private local credentials file: ${result.credentialsFile}` : 'Credentials file unavailable. Use reset:app-admin if the password is lost.');
  }).catch(() => { console.error('Administrator setup failed. Check emulator availability, singleton consistency, pending credentials and setup lock; see docs/SYSTEM-ADMIN.md. No password was printed.'); process.exitCode = 1; });
}
module.exports = { provision };
