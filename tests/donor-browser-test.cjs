// Optional browser integration test: Chrome DevTools at localhost:9222, Node 22+.
// Uses an isolated browser profile and fictional emulator fixtures, never live Auth.
process.env.GCLOUD_PROJECT = 'resqfood-ec8f5';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
const assert = require('node:assert/strict');
const admin = require('firebase-admin');
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore(), uid = `donor-browser-${Date.now()}`, orgId = `${uid}-org`;
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
}
async function run() {
  const debugPort = process.env.BROWSER_DEBUG_PORT || '9222';
  const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(r=>r.json());
  const target = targets.find(t=>t.type==='page'); assert.ok(target, 'Launch an isolated headless Chrome first');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject) => { ws.onopen=resolve; ws.onerror=reject; });
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) { requests.get(message.id)?.(message); requests.delete(message.id); }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Page.javascriptDialogOpening') command('Page.handleJavaScriptDialog', { accept: true });
  };
  await command('Page.enable'); await command('Runtime.enable');
  await command('Network.enable'); await command('Network.setCacheDisabled', { cacheDisabled: true });
  await admin.auth().createUser({ uid, phoneNumber: phone });
  await db.collection('organizations').doc(orgId).set({ orgName: 'Browser Kitchen', status: 'active', barangay: 'Lahug', primaryContactUid: 'fixture', verifierUids: [] });
  await go('/register/donor.html');
  await evaluate(`(async()=>{const auth=await import('/js/core/auth.js');await auth.signOutCurrentUser();})()`);
  await evaluate(`document.getElementById('inp-phone').value=${JSON.stringify(phone)};document.getElementById('btn-send-otp').click()`);
  await until(`!document.getElementById('otp-section').classList.contains('hidden')`, 'registration OTP sent');
  const registrationCodes = await fetch('http://127.0.0.1:9099/emulator/v1/projects/resqfood-ec8f5/verificationCodes').then(r=>r.json());
  const registrationCode = registrationCodes.verificationCodes.find(c=>c.phoneNumber===phone).code;
  await evaluate(`document.querySelectorAll('.otp-input').forEach((input,i)=>input.value=${JSON.stringify(registrationCode)}[i]);document.querySelectorAll('.otp-input')[5].dispatchEvent(new Event('input',{bubbles:true}))`);
  await until(`document.getElementById('step-2').classList.contains('active')`, 'registration OTP confirmed');
  await evaluate(`document.getElementById('inp-name').value='Browser Donor';document.getElementById('inp-email').value='browser@example.com';document.getElementById('inp-barangay').value='Lahug';document.getElementById('inp-street').value='Browser Test Street, Lahug';document.getElementById('btn-2-next').click();document.getElementById('toggle-business').click();document.getElementById('inp-business-name').value='Browser Eatery';document.getElementById('inp-permit').value='BROWSER-TEST-ONLY';document.getElementById('btn-3-next').click();const box=document.getElementById('waiver-scroll-box');box.scrollTop=box.scrollHeight;box.dispatchEvent(new Event('scroll'))`);
  await until(`!document.getElementById('chk-safety').disabled`, 'waiver scroll completed');
  await evaluate(`document.getElementById('chk-safety').click();document.getElementById('chk-privacy').click();document.getElementById('btn-4-submit').click()`);
  await until(`document.getElementById('step-5').classList.contains('active')`, 'registration completed');
  const registered = (await db.collection('users').doc(uid).get()).data();
  assert.equal(registered.role, 'donor'); assert.equal(registered.businessName, 'Browser Eatery');
  assert.equal(registered.permitNumber, 'BROWSER-TEST-ONLY');
  assert.equal((await db.collection('consentRecords').doc(`${uid}_donor_v1-2026-10`).get()).exists, true);
  await evaluate(`(async()=>{const auth=await import('/js/core/auth.js');await auth.signOutCurrentUser();})()`);
  await go('/donor/login.html');
  await evaluate(`document.getElementById('login-phone').value=${JSON.stringify(phone)};document.getElementById('login-send').click()`);
  await until(`document.getElementById('login-confirm') && !document.getElementById('login-confirm').disabled`, 'OTP sent');
  const codes = await fetch('http://127.0.0.1:9099/emulator/v1/projects/resqfood-ec8f5/verificationCodes').then(r=>r.json());
  const code = codes.verificationCodes.find(c=>c.phoneNumber===phone).code;
  await evaluate(`document.getElementById('login-code').value=${JSON.stringify(code)};document.getElementById('login-confirm').click()`);
  await until(`location.pathname === '/donor/index.html' && document.getElementById('greeting-name')?.textContent.includes('Browser')`, 'donor login/dashboard');
  await go('/donor/post.html');
  await until(`document.getElementById('inp-org')?.querySelector('option[value="${orgId}"]')`, 'active organizations');
  assert.equal(await evaluate(`document.getElementById('inp-pickup-addr').value`), 'Browser Test Street, Lahug');
  await evaluate(`(async () => {
    const stamp=d=>{const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes());};
    document.getElementById('inp-food-type').value='Kanin';
    document.getElementById('inp-qty').value='2.5';document.getElementById('inp-desc').value='Browser fixture';
    document.getElementById('inp-window-end').value=stamp(new Date(Date.now()+3600000));document.getElementById('btn-p1-next').click();
    document.getElementById('inp-org').value=${JSON.stringify(orgId)};
    const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;canvas.getContext('2d').fillRect(0,0,32,32);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg'));
    const transfer=new DataTransfer();transfer.items.add(new File([blob],'capstone.jpg',{type:'image/jpeg'}));
    const photo=document.getElementById('inp-photo');photo.files=transfer.files;photo.dispatchEvent(new Event('change',{bubbles:true}));
  })()`);
  await until(`document.getElementById('photo-preview').style.display === 'block'`, 'image compression preview');
  await evaluate(`(() => {
    document.getElementById('btn-p2-next').click();
    const chk=document.getElementById('chk-post-confirm');chk.checked=true;chk.dispatchEvent(new Event('change'));
    document.getElementById('btn-hold-submit').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
  })()`);
  await until(`location.pathname === '/donor/qr-display.html' && /^\\d{4}$/.test(document.getElementById('pin-display')?.textContent || '')`, 'posted donation and pickup PIN');
  donationId = await evaluate(`new URLSearchParams(location.search).get('donationId')`);
  const stored = (await db.collection('donations').doc(donationId).get()).data();
  assert.equal(stored.orgId, orgId); assert.equal(stored.donorId, uid);
  assert.ok(stored.imageUrl, 'Uploaded photo must be linked to the donation');
  assert.equal(await evaluate(`!!document.querySelector('#qr-container canvas, #qr-container img')`), true);
  assert.ok(await evaluate(`document.getElementById('pin-expiry').textContent.includes('PIN:')`));
  await go('/donor/index.html');
  await until(`document.querySelector('[data-cancel="${donationId}"]')`, 'posted donation on board');
  await evaluate(`document.querySelector('[data-cancel="${donationId}"]').click()`);
  await until(`document.getElementById('stat-cancelled')?.textContent === '1'`, 'audited cancellation and statistics');
  await go('/donor/history.html');
  await until(`document.getElementById('history-list')?.textContent.includes('Browser Kitchen') && document.getElementById('history-list').textContent.includes('Na-cancel')`, 'standalone history');
  assert.equal((await db.collection('donations').doc(donationId).get()).data().status, 'cancelled');
  assert.deepEqual(errors, [], 'No unhandled browser errors');
  console.log('PASS: browser donor registration/consent, OTP sign-in, profile prefill, destination, photo compression/upload, three-step post, QR/PIN/countdown, realtime board, cancellation/stats, standalone history');
}
run().catch(error => { console.error(error); process.exitCode=1; }).finally(async () => {
  ws?.close();
  await db.collection('users').doc(uid).delete(); await db.collection('organizations').doc(orgId).delete();
  await db.collection('consentRecords').doc(`${uid}_donor_v1-2026-10`).delete();
  if (donationId) await db.collection('donations').doc(donationId).delete();
  if (donationId) await admin.storage().bucket('resqfood-ec8f5.firebasestorage.app').file(`donation-images/${uid}/${donationId}.jpg`).delete({ ignoreNotFound: true });
  await admin.auth().deleteUser(uid).catch(()=>{}); await admin.app().delete();
});
