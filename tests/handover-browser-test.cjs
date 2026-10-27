// Optional browser integration test: Chrome DevTools at localhost:9222, Node 22+.
// Uses an isolated browser profile and fictional emulator fixtures, never live Auth.
process.env.GCLOUD_PROJECT = 'resqfood-ec8f5';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
const assert = require('node:assert/strict');
const admin = require('firebase-admin');
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore(), uid = `handover-browser-${Date.now()}`, orgId = `${uid}-org`;
const phone = '+63915' + String(Date.now()).slice(-7), errors = [];
let ws, seq = 0, donationId;
const requests = new Map();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function command(method, params = {}) {
  return new Promise((resolve,reject) => {
    const id = ++seq, timeout = setTimeout(() => { requests.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
    requests.set(id, message => { clearTimeout(timeout); message.error ? reject(new Error(message.error.message)) : resolve(message.result); });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function until(expression, label) {
  const end = Date.now()+30000;
  while (Date.now()<end) {
    try { if (await evaluate(expression)) return; } catch (_) { /* navigation destroys the old context */ }
    await pause(250);
  }
  throw new Error(`Timed out: ${label}; browser errors: ${errors.join('\n')}`);
}
async function go(path) {
  const marker = String(Date.now());
  await command('Page.navigate', { url: `http://localhost:5000${path}${path.includes('?') ? '&' : '?'}_browserTest=${marker}` });
  await until(`location.pathname === ${JSON.stringify(path.split('?')[0])} && location.search.includes(${JSON.stringify(marker)}) && document.readyState === 'complete'`, path);
  if (/^\/(donor|volunteer|org-admin)\//.test(path)) await until(`document.documentElement.dataset.authReady === '1' && !document.documentElement.hidden`, 'role guard ready');
}

const actors = { donor: `${uid}-donor`, volunteer: `${uid}-volunteer`, orgAdmin: `${uid}-orgAdmin` };
const donations = [];
async function login(role) {
  await go('/register/index.html');
  const token = await admin.auth().createCustomToken(actors[role]);
  await evaluate(`(async()=>{const sdk=await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');const cfg=await import('/js/core/firebaseConfig.js');await sdk.signOut(cfg.auth);await sdk.signInWithCustomToken(cfg.auth,${JSON.stringify(token)});})()`);
}
async function scenario(suffix, pickupMode, receiptMode) {
  const donationId = `${uid}-${suffix}`; donations.push(donationId);
  const ref = db.collection('donations').doc(donationId);
  await ref.set({ donorId: actors.donor, donorName:'Browser Donor', volunteerId:null, orgId, orgName:'Browser Kitchen',
    status:'pending', foodType:'Kanin', quantityKg:2.5, pickupAddress:'Browser fixture address', pickupWindowStart:new Date(),
    pickupWindowEnd:new Date(Date.now()+3600000), statusHistory:[], createdAt:new Date() });
  await login('donor'); await go(`/donor/qr-display.html?donationId=${donationId}`);
  await until(`/^\\d{4}$/.test(document.getElementById('pin-display')?.textContent||'')`, 'donor pickup codes');
  const pickupPin = await evaluate(`document.getElementById('pin-display').textContent`);
  const pickupQr = await evaluate(`document.getElementById('qr-container').title`);
  assert.ok(JSON.parse(pickupQr).sig);
  await login('volunteer');
  await evaluate(`(async()=>{const api=await import('/js/core/callables.js');const result=await api.claimDonation({donationId:${JSON.stringify(donationId)}});if(!result.success)throw Error(result.reason);})()`);
  await go(`/volunteer/active-mission.html?donationId=${donationId}`);
  await until(`document.getElementById('m-destination')?.textContent==='Browser Kitchen'`, 'receiving organization details');
  if (pickupMode === 'qr') {
    await evaluate(`document.getElementById('btn-cancel-mission').click()`);
    await until(`location.pathname==='/volunteer/index.html' && document.documentElement.dataset.authReady==='1'`, 'release returns to board');
    assert.equal((await ref.get()).data().volunteerId, null);
    await until(`document.querySelector('.btn-accept[data-id="${donationId}"]')`, 'released mission available again');
    await evaluate(`document.querySelector('.btn-accept[data-id="${donationId}"]').click()`);
    await until(`document.querySelector('#panel-my a[href*="${donationId}"]')`, 'claim through board button');
    await go(`/volunteer/active-mission.html?donationId=${donationId}`);
  }
  await until(`document.getElementById('pickup-link')?.href.includes(${JSON.stringify(donationId)}) && !document.getElementById('pickup-link').hidden`, 'assigned mission');
  await go(`/volunteer/scanner.html?donationId=${donationId}`);
  if (pickupMode === 'qr') {
    await evaluate(`document.getElementById('qr-proof-text').value=${JSON.stringify(pickupQr)};document.getElementById('btn-preview-qr').click()`);
    await until(`!document.getElementById('btn-confirm-pickup').disabled`, 'read-only pickup preview');
    assert.equal((await ref.get()).data().status,'scheduled');
    assert.equal((await db.collection('qrNonces').doc(JSON.parse(pickupQr).nonce).get()).data().used,false);
    await evaluate(`document.getElementById('btn-confirm-pickup').click()`);
  } else {
    await evaluate(`document.querySelectorAll('.pin-inputs .pin-digit').forEach((el,i)=>{el.value=${JSON.stringify(pickupPin)}[i];el.dispatchEvent(new Event('input',{bubbles:true}));});document.getElementById('btn-confirm-pin').click()`);
  }
  await until(`!document.getElementById('scan-success').classList.contains('hidden')`, 'atomic pickup confirmation');
  assert.equal((await ref.get()).data().status,'pickedUp');
  await go(`/volunteer/active-mission.html?donationId=${donationId}`);
  await until(`!document.getElementById('btn-enroute').hidden`, 'transport action');
  await evaluate(`document.getElementById('btn-enroute').click()`);
  await until(`!document.getElementById('btn-delivered').hidden && !document.getElementById('btn-delivered').disabled`, 'en route');
  await evaluate(`document.getElementById('btn-delivered').click()`);
  await until(`!document.getElementById('receipt-credentials').hidden && !document.getElementById('btn-receipt-code').disabled`, 'delivered');
  await evaluate(`document.getElementById('btn-receipt-code').click()`);
  await until(`/^\\d{4}$/.test(document.getElementById('receipt-pin').textContent)`, 'volunteer receipt codes');
  const receiptPin = await evaluate(`document.getElementById('receipt-pin').textContent`);
  const receiptQr = await evaluate(`document.getElementById('receipt-qr').title`);
  assert.equal(JSON.parse(receiptQr).purpose,'verify');
  await login('orgAdmin'); await go(`/org-admin/verify.html?donationId=${donationId}`);
  if (receiptMode === 'pin') {
    await evaluate(`document.getElementById('btn-mode-pin').click()`);
    await until(`!document.getElementById('pin-mode').classList.contains('hidden')`, 'PIN mode');
    await evaluate(`document.querySelectorAll('.pin-inputs .pin-digit').forEach((el,i)=>{el.value=${JSON.stringify(receiptPin)}[i];el.dispatchEvent(new Event('input',{bubbles:true}));});document.getElementById('btn-confirm-pin').click()`);
  } else {
    await evaluate(`document.getElementById('qr-proof-text').value=${JSON.stringify(receiptQr)};document.getElementById('btn-preview-qr').click()`);
    await until(`!document.getElementById('btn-confirm-verify').disabled`, 'read-only receipt preview');
    assert.equal((await ref.get()).data().status,'delivered');
    await evaluate(`document.getElementById('btn-confirm-verify').click()`);
  }
  await until(`!document.getElementById('verify-success').classList.contains('hidden')`, 'atomic organization receipt');
  assert.equal((await ref.get()).data().status,'verified');
  const audit = await db.collection('auditLogs').where('donationId','==',donationId).get();
  assert.equal(audit.docs.filter(d=>d.data().action==='handover_confirmed').length,2);
}
async function run() {
  const port=process.env.BROWSER_DEBUG_PORT || '9223';
  const targets=await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json());
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){requests.get(m.id)?.(m);requests.delete(m.id);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);};
  await command('Page.enable');await command('Runtime.enable');await command('Network.enable');await command('Network.setCacheDisabled',{cacheDisabled:true});
  // Runtime.enable can replay exceptions from the previous test's document.
  await go('/register/index.html'); errors.length = 0;
  for(const [role,actorUid] of Object.entries(actors)) {
    await admin.auth().createUser({uid:actorUid});await admin.auth().setCustomUserClaims(actorUid,{role});
    await db.collection('users').doc(actorUid).set({role,status:'active',fullName:role,orgId:role==='orgAdmin'?orgId:null,barangay:'Lahug'});
  }
  await db.collection('organizations').doc(orgId).set({status:'active',orgName:'Browser Kitchen',primaryContactUid:actors.orgAdmin,verifierUids:[actors.orgAdmin]});
  await scenario('qr-pickup-pin-receipt','qr','pin');
  await scenario('pin-pickup-qr-receipt','pin','qr');
  await login('donor');await go('/donor/index.html');
  await until(`document.getElementById('stat-verified')?.textContent==='2'`, 'donor receives verified updates');
  await login('volunteer'); await go('/volunteer/index.html');
  await until(`document.getElementById('stat-missions')?.textContent==='2' && document.getElementById('stat-kg')?.textContent==='5'`, 'volunteer completed totals');
  assert.equal(await evaluate(`document.getElementById('stat-awaiting').textContent`), '0');
  await go('/volunteer/history.html');
  await until(`document.getElementById('history-missions')?.textContent==='2' && document.querySelectorAll('#volunteer-history .hist-mission').length===2`, 'real volunteer history');
  await login('orgAdmin'); await go('/org-admin/index.html');
  await until(`document.getElementById('stat-deliveries')?.textContent==='2' && document.getElementById('stat-kg')?.textContent==='5' && document.getElementById('stat-today')?.textContent==='2'`, 'organization membership and dashboard totals');
  await go('/org-admin/history.html');
  await until(`document.getElementById('sum-deliveries')?.textContent==='2' && document.getElementById('sum-kg')?.textContent==='5'`, 'organization history totals');
  assert.deepEqual(errors,[]);
  console.log('PASS: browser donor pickup codes -> volunteer QR/PIN preview/confirmation -> transport -> volunteer receipt QR/PIN -> org confirmation -> donor realtime totals; both code modes; no unhandled errors');
}
run().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  ws?.close();
  for(const donationId of donations) {
    for(const collection of ['qrNonces','pins','auditLogs','notifications','handoverReceipts']) {
      const snap=await db.collection(collection).where('donationId','==',donationId).get();await Promise.all(snap.docs.map(d=>d.ref.delete()));
    }
    await db.collection('donations').doc(donationId).delete();
  }
  await db.collection('organizations').doc(orgId).delete();
  for(const actorUid of Object.values(actors)){await db.collection('users').doc(actorUid).delete();await admin.auth().deleteUser(actorUid).catch(()=>{});}
  await admin.app().delete();
});
