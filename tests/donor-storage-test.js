const fs = require('node:fs'), path = require('node:path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
async function run() {
  const env = await initializeTestEnvironment({ projectId: 'resqfood-ec8f5',
    firestore: { host: '127.0.0.1', port: 8080, rules: fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8') },
    storage: { host: '127.0.0.1', port: 9199, rules: fs.readFileSync(path.join(__dirname, '../storage.rules'), 'utf8') },
  });
  const uid = `donor-storage-${Date.now()}`, volunteer = `${uid}-volunteer`;
  try {
    await env.withSecurityRulesDisabled(async context => {
      await context.firestore().collection('users').doc(uid).set({ role: 'donor', status: 'active' });
      await context.firestore().collection('users').doc(volunteer).set({ role: 'volunteer', status: 'active' });
    });
    const donorStorage = env.authenticatedContext(uid, { role: 'donor' }).storage();
    const volunteerStorage = env.authenticatedContext(volunteer, { role: 'volunteer' }).storage();
    const image = new Uint8Array([255,216,255,217]);
    await assertSucceeds(donorStorage.ref(`donation-images/${uid}/valid.jpg`).put(image, { contentType: 'image/jpeg' }));
    await assertFails(volunteerStorage.ref(`donation-images/${uid}/other.jpg`).put(image, { contentType: 'image/jpeg' }));
    await assertFails(volunteerStorage.ref(`donation-images/${volunteer}/own.jpg`).put(image, { contentType: 'image/jpeg' }));
    await assertFails(donorStorage.ref(`donation-images/${uid}/bad.txt`).put(image, { contentType: 'text/plain' }));
    await assertFails(donorStorage.ref(`donation-images/${uid}/large.jpg`).put(new Uint8Array(5*1024*1024+1), { contentType: 'image/jpeg' }));
    await env.withSecurityRulesDisabled(context => context.firestore().collection('users').doc(uid).update({ status: 'suspended' }));
    await assertFails(donorStorage.ref(`donation-images/${uid}/suspended.jpg`).put(image, { contentType: 'image/jpeg' }));
    console.log('PASS: donor image owner/role/activation/MIME/size restrictions');
  } finally {
    await env.withSecurityRulesDisabled(async context => {
      await context.firestore().collection('users').doc(uid).delete();
      await context.firestore().collection('users').doc(volunteer).delete();
      await context.storage().ref(`donation-images/${uid}/valid.jpg`).delete();
    });
    await env.cleanup();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
