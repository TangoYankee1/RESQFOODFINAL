const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

async function main() {
  const projectId = 'resqfood-ec8f5';
  const firestoreRules = fs.readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8');
  const storageRules = fs.readFileSync(path.join(__dirname, '../../storage.rules'), 'utf8');

  const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: firestoreRules,
    },
    storage: {
      host: '127.0.0.1',
      port: 9199,
      rules: storageRules,
    },
  });

  try {
    console.log('Running unauthorized-write rules checks...');

    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const aliceDb = testEnv.authenticatedContext('alice', { role: 'donor' }).firestore();
    const bobDb = testEnv.authenticatedContext('bob', { role: 'donor' }).firestore();
    const adminDb = testEnv.authenticatedContext('admin-user', { role: 'systemAdmin' }).firestore();

    await assertFails(
      unauthDb.collection('users').doc('alice').set({
        fullName: 'Alice Example',
        phoneNumber: '+15550000001',
        barangay: 'Lapaz',
      })
    );

    await assertFails(
      bobDb.collection('users').doc('alice').set({
        fullName: 'Mallory',
        phoneNumber: '+15550000002',
        barangay: 'Central',
      })
    );

    await assertFails(
      aliceDb.collection('users').doc('alice').set({
        fullName: 'Alice Example',
        phoneNumber: '+15550000001',
        barangay: 'Lapaz',
        role: 'systemAdmin',
      })
    );

    await assertSucceeds(
      aliceDb.collection('users').doc('alice').set({
        fullName: 'Alice Example',
        phoneNumber: '+15550000001',
        barangay: 'Lapaz',
        status: 'active',
        updatedAt: new Date(),
      })
    );

    await assertFails(
      aliceDb.collection('auditLogs').doc('log-1').set({
        action: 'forged',
        createdAt: new Date(),
      })
    );

    await assertSucceeds(
      adminDb.collection('auditLogs').doc('log-1').set({
        action: 'admin-action',
        createdAt: new Date(),
        actorUid: 'admin-user',
      })
    );

    const unauthStorage = testEnv.unauthenticatedContext().storage();
    const aliceStorage = testEnv.authenticatedContext('alice', { sub: 'alice' }).storage();
    const bobStorage = testEnv.authenticatedContext('bob', { sub: 'bob' }).storage();

    await assertFails(
      unauthStorage.ref('authorization-letters/alice/letter.pdf').putString('not-allowed')
    );

    await assertFails(
      bobStorage.ref('authorization-letters/alice/letter.pdf').putString('not-allowed')
    );

    await assertSucceeds(
      aliceStorage.ref('authorization-letters/alice/letter.pdf').putString('allowed')
    );

    await assertFails(
      aliceStorage.ref('private/secret.txt').putString('secret')
    );

    console.log('Unauthorized-write rules checks passed.');
  } finally {
    await testEnv.cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
