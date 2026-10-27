const fs = require('node:fs'), path = require('node:path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
async function run() {
  const env = await initializeTestEnvironment({ projectId: 'resqfood-ec8f5',
    firestore: { host: '127.0.0.1', port: 8080, rules: fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8') },
    storage: { host: '127.0.0.1', port: 9199, rules: fs.readFileSync(path.join(__dirname, '../storage.rules'), 'utf8') },
  });
  const prefix = `authorization-storage-${Date.now()}`, owner = `${prefix}-owner`, reviewer = `${prefix}-reviewer`, lgu = `${prefix}-lgu`;
  const file = `authorization-letters/${owner}/organization/proof.pdf`;
  const requestId = `${prefix}-request`;
  try {
    await env.withSecurityRulesDisabled(async ctx => {
      for (const [uid, role] of [[owner, 'orgAdmin'], [reviewer, 'systemAdmin'], [lgu, 'lguAdmin']]) {
        await ctx.firestore().collection('users').doc(uid).set({ role, status: 'active' });
      }
      await ctx.firestore().collection('verificationRequests').doc(requestId).set({ uploaderUid: owner, targetUid: owner, type: 'org_authorization', storagePath: file, status: 'pending', createdAt: new Date() });
    });
    const storage = (uid, role) => env.authenticatedContext(uid, { role }).storage().ref(file);
    await assertSucceeds(storage(owner, 'orgAdmin').put(new Uint8Array([37,80,68,70]), { contentType: 'application/pdf' }));
    await assertSucceeds(storage(owner, 'orgAdmin').getMetadata());
    await assertSucceeds(storage(reviewer, 'systemAdmin').getMetadata());
    const request = (uid, role) => env.authenticatedContext(uid, { role }).firestore().collection('verificationRequests').doc(requestId);
    await assertSucceeds(request(owner, 'orgAdmin').get());
    await assertSucceeds(request(reviewer, 'systemAdmin').get());
    await assertFails(request(lgu, 'lguAdmin').get());
    await assertFails(storage(lgu, 'lguAdmin').getMetadata());
    await assertFails(storage(`${prefix}-other`, 'orgAdmin').getMetadata());
    await env.withSecurityRulesDisabled(ctx => ctx.firestore().collection('users').doc(reviewer).update({ status: 'suspended' }));
    await assertFails(storage(reviewer, 'systemAdmin').getMetadata());
    await assertFails(request(reviewer, 'systemAdmin').get());
    console.log('PASS: authorization documents are owner/active-system-reviewer only; LGU, unrelated and suspended reviewer reads denied.');
  } finally {
    await env.withSecurityRulesDisabled(async ctx => {
      await ctx.storage().ref(file).delete();
      await ctx.firestore().collection('verificationRequests').doc(requestId).delete();
      await Promise.all([owner, reviewer, lgu].map(uid => ctx.firestore().collection('users').doc(uid).delete()));
    });
    await env.cleanup();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
