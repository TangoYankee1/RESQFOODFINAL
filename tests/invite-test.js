process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'resqfood-ec8f5';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

const admin = require('firebase-admin');
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore();

const { createInvite, validateInvite, consumeInvite } = require('../functions/lib/invite');

async function run() {
  console.log('Running invite-test...');
  const creator = 'admin_test_uid';
  const resCreate = await createInvite(db, creator, 'lgu', { org: 'Lahug' }, 1);
  console.log('createInvite result:', resCreate);
  if(!resCreate.success) process.exit(1);

  const token = resCreate.token;
  const resVal = await validateInvite(db, token);
  console.log('validateInvite result:', resVal);
  if(!resVal.success) process.exit(1);

  const resConsume = await consumeInvite(db, token, 'user_consumed_uid');
  console.log('consumeInvite result:', resConsume);
  if(!resConsume.success) process.exit(1);

  // Try consuming again -> should fail
  const resConsume2 = await consumeInvite(db, token, 'user2');
  console.log('consumeInvite (2) result:', resConsume2);
  if(resConsume2.success) process.exit(1);

  console.log('invite-test complete');
}

run().catch(e=>{ console.error(e); process.exit(1); });
