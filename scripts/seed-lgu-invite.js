const admin = require('firebase-admin');
const { createInvite } = require('../functions/lib/invite');

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
if (!emulatorHost) {
  throw new Error('Refusing to run without FIRESTORE_EMULATOR_HOST. This script is emulator-only.');
}

const projectId = process.env.GCLOUD_PROJECT || 'resqfood-ec8f5';
const barangay = process.argv[2] || 'Lahug';
const expiresHours = Number(process.argv[3] || 72);

if (!Number.isFinite(expiresHours) || expiresHours <= 0) {
  throw new Error('Expiry must be a positive number of hours.');
}

admin.initializeApp({ projectId });
const firestore = admin.firestore();

async function run() {
  const result = await createInvite(
    firestore,
    'local-system-admin',
    'lgu',
    {
      barangay,
      intendedEmailDomain: 'barangay.gov.ph',
      source: 'local-emulator-seed',
    },
    expiresHours,
  );

  if (!result.success) throw new Error('Invite creation failed.');

  console.log('Local LGU invite created.');
  console.log(`Invite ID: ${result.inviteId}`);
  console.log(`Token: ${result.token}`);
  console.log(`URL: http://localhost:5000/register/lgu-invite.html?token=${result.token}`);
  console.log(`Expires in: ${expiresHours} hours`);
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
