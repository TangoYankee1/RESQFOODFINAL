const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

async function run() {
  const env = await initializeTestEnvironment({ projectId: 'resqfood-ec8f5', firestore: {
    host: '127.0.0.1', port: 8080, rules: fs.readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8'),
  } });
  const prefix = `rules-review-${Date.now()}`;
  const ids = Object.fromEntries(['donor','volunteer','orgAdmin','lguAdmin','systemAdmin','suspended'].map(role => [role, `${prefix}-${role}`]));
  const donationId = `${prefix}-donation`, orgId = `${prefix}-org`;
  try {
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      for (const [role, uid] of Object.entries(ids)) await db.collection('users').doc(uid).set({ role: role === 'suspended' ? 'donor' : role, status: role === 'suspended' ? 'suspended' : 'active' });
      await db.collection('organizations').doc(orgId).set({ status: 'active', primaryContactUid: ids.orgAdmin, verifierUids: [ids.orgAdmin] });
    });
    const db = role => env.authenticatedContext(ids[role], { role: role === 'suspended' ? 'donor' : role }).firestore();
    const data = { donorId: ids.donor, status: 'pending', foodType: 'Rice', quantityKg: 2, safetyDeclared: true,
      pickupWindowStart: new Date(), pickupWindowEnd: new Date(Date.now()+3600000), orgId, createdAt: new Date() };
    await assertFails(env.unauthenticatedContext().firestore().collection('donations').doc(donationId).set(data));
    await assertFails(db('volunteer').collection('donations').doc(donationId).set({ ...data, donorId: ids.volunteer }));
    await assertFails(db('suspended').collection('donations').doc(donationId).set({ ...data, donorId: ids.suspended }));
    await assertFails(db('donor').collection('donations').doc(donationId).set(data));
    await env.withSecurityRulesDisabled(context => context.firestore().collection('donations').doc(donationId).set(data));
    await assertSucceeds(db('volunteer').collection('donations').doc(donationId).get());
    await assertSucceeds(db('orgAdmin').collection('donations').doc(donationId).get());
    await assertSucceeds(db('lguAdmin').collection('donations').doc(donationId).get());
    await assertSucceeds(db('donor').collection('donations').doc(donationId).update({ imageUrl: 'https://example.com/image.jpg', updatedAt: new Date() }));
    await assertFails(db('orgAdmin').collection('organizations').doc(orgId).update({ status: 'active', verifierUids: [ids.volunteer] }));
    await assertFails(db('orgAdmin').collection('organizations').doc(orgId).update({ address: 'Bypass audited command' }));
    await assertFails(db('systemAdmin').collection('users').doc(ids.donor).update({ role: 'systemAdmin' }));
    await assertFails(db('systemAdmin').collection('handoverReceipts').doc(`${donationId}_pickup`).set({ actorUid: ids.volunteer, newStatus: 'pickedUp' }));
    await assertFails(db('volunteer').collection('handoverReceipts').doc(`${donationId}_pickup`).get());
    await assertFails(db('volunteer').collection('donations').doc(donationId).update({ status: 'scheduled', volunteerId: ids.volunteer }));
    await assertFails(db('donor').collection('donations').doc(donationId).update({ status: 'cancelled' }));
    await assertFails(db('donor').collection('users').doc(ids.donor).update({ status: 'active', role: 'systemAdmin' }));
    await assertFails(db('suspended').collection('donations').doc(donationId).get());
    const applicantUid = `${prefix}-applicant`;
    await assertFails(env.authenticatedContext(applicantUid).firestore().collection('users').doc(applicantUid)
      .set({ fullName: 'Unreviewed applicant', phoneNumber: '+639171234567', barangay: 'Lahug', requestedRole: 'lguAdmin', status: 'pending_review' }));
    console.log('PASS: rules enforce role, activation, org membership, protected fields, server-only transport');
  } finally {
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await Promise.all(Object.values(ids).map(uid => db.collection('users').doc(uid).delete()));
      await db.collection('donations').doc(donationId).delete();
      await db.collection('organizations').doc(orgId).delete();
    });
    await env.cleanup();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
