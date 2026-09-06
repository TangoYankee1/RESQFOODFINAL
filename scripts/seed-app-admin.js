const admin = require('firebase-admin');

const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
if (!authHost || !firestoreHost) {
  throw new Error('Refusing to run without Firebase Auth and Firestore emulator hosts.');
}

const projectId = process.env.GCLOUD_PROJECT || 'resqfood-ec8f5';
const email = process.env.APP_ADMIN_EMAIL || 'god1@resqfood.local';
const password = process.env.APP_ADMIN_PASSWORD || 'admin 1';

admin.initializeApp({ projectId });
const auth = admin.auth();
const firestore = admin.firestore();

async function run() {
  let user;
  try {
    user = await auth.getUserByEmail(email);
    user = await auth.updateUser(user.uid, { password, emailVerified: true, disabled: false });
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    user = await auth.createUser({ email, password, emailVerified: true, displayName: 'Local App Admin' });
  }

  await auth.setCustomUserClaims(user.uid, { role: 'systemAdmin' });
  await firestore.collection('users').doc(user.uid).set({
    fullName: 'Local App Admin',
    email,
    role: 'systemAdmin',
    status: 'active',
    profileComplete: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }, { merge: true });

  console.log('Local App Admin ready.');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log('Login: http://localhost:5000/app-admin/login.html');
  console.log(`UID: ${user.uid}`);
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
