// Fictional thesis-defense organizations. Never connects to production.
const admin = require('firebase-admin');
for (const [key, fallback] of Object.entries({ FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080', FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099' })) {
  const host = process.env[key] || fallback;
  if (!/^(localhost|127\.0\.0\.1):\d+$/.test(host)) throw new Error(`${key} must be a local emulator`);
  process.env[key] = host;
}
admin.initializeApp({ projectId:'resqfood-ec8f5' });
const db = admin.firestore();
const entries = [
  { id:'demo-lahug-community-kitchen', name:'DEMO — Lahug Community Kitchen', phone:'+639170009201', sitio:'ACACIA', serviceSitios:['ACACIA','ANAPOG','ARCO','AVOCADO','BAYANIHAN'], description:'Fictional community kitchen for the thesis demonstration.' },
  { id:'demo-lahug-feeding-partners', name:'DEMO — Lahug Feeding Partners', phone:'+639170009202', sitio:'LOWER PEACE VALLEY', serviceSitios:['LOWER PEACE VALLEY','UPPER PEACE VALLEY','LOWER BETANIA','GOLDEN VALLEY','UPPER GREEN VALLEY'], description:'Fictional feeding-program team for the thesis demonstration.' },
  { id:'demo-lahug-food-support', name:'DEMO — Lahug Food Support', phone:'+639170009203', sitio:'SUDLON', serviceSitios:['SUDLON','SUDLON RIVERSIDE','VETERANS','VETERANS VILLAGE','PASTEUR'], description:'Fictional food-assistance organization for the thesis demonstration.' },
];
async function run() {
  for (const entry of entries) {
    const uid = `${entry.id}-admin`;
    const userRef = db.collection('users').doc(uid);
    const orgRef = db.collection('organizations').doc(entry.id);
    const [user, org] = await Promise.all([userRef.get(),orgRef.get()]);
    if ((user.exists && user.data().demoFixture !== 'thesis-orgs-v1') || (org.exists && org.data().demoFixture !== 'thesis-orgs-v1')) throw new Error(`Existing non-demo record: ${entry.id}`);
    let account;
    try { account = await admin.auth().getUser(uid); }
    catch(error) {
      if(error.code !== 'auth/user-not-found') throw error;
      account = await admin.auth().createUser({ uid, phoneNumber:entry.phone, displayName:entry.name });
    }
    if(account.phoneNumber !== entry.phone) throw new Error(`Demo phone conflict: ${uid}`);
    await admin.auth().setCustomUserClaims(uid, { ...account.customClaims, role:'orgAdmin' });
    const common = { isDemo:true, demoFixture:'thesis-orgs-v1', barangay:'Lahug', sitio:entry.sitio, createdAt:admin.firestore.FieldValue.serverTimestamp(), updatedAt:admin.firestore.FieldValue.serverTimestamp() };
    // Re-running preserves review state and edits made during the demonstration.
    const batch = db.batch();
    if(!user.exists) batch.create(userRef, { ...common, uid, role:'orgAdmin', requestedRole:'orgAdmin', fullName:entry.name+' Coordinator', phoneNumber:entry.phone, organizationName:entry.name, orgId:entry.id, status:'active', trustStatus:'approved', profileComplete:true, address:`DEMO location only — ${entry.sitio}, Lahug` });
    if(!org.exists) batch.create(orgRef, { ...common, orgId:entry.id, orgName:entry.name, orgType:'community', phone:entry.phone, address:`DEMO location only — ${entry.sitio}, Lahug`, description:entry.description, serviceSitios:entry.serviceSitios, status:'active', primaryContactUid:uid, verifierUids:[uid], mode:'standard' });
    await batch.commit();
    console.log(`${entry.name} | sign in: ${entry.phone} | ${org.exists ? 'preserved' : 'created'}`);
  }
  console.log('Local demo organizations ready. OTP codes appear in the Auth emulator terminal; no real SMS is sent.');
}
run().catch(error=>{ console.error(error.message); process.exitCode=1; }).finally(()=>admin.app().delete());
