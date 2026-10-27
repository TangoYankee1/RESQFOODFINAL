// Real OTP, upload, review and activation UI against loopback emulators only.
process.env.GCLOUD_PROJECT = 'resqfood-ec8f5';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
const assert = require('node:assert/strict');
const admin = require('firebase-admin');
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT, storageBucket: 'resqfood-ec8f5.firebasestorage.app' });
const db = admin.firestore(), prefix = `onboarding-browser-${Date.now()}`;
const users = ['volunteer', 'orgAdmin', 'lguAdmin', 'systemAdmin'].map(role => ({ role, uid: `${prefix}-${role}`,
  phone: '+63916' + String(Date.now()).slice(-6) + String(['volunteer','orgAdmin','lguAdmin','systemAdmin'].indexOf(role)) }));
const errors = [], pending = new Map();
let ws, seq = 0, inviteId;
const reportFixtures = [];
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq, timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP timeout: ${method}`)); }, 45000);
    pending.set(id, m => { clearTimeout(timer); m.error ? reject(Error(m.error.message)) : resolve(m.result); });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const r = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function until(expression, label) {
  const end = Date.now() + 60000;
  while (Date.now() < end) {
    try { if (await evaluate(expression)) return; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw Error(`Timed out: ${label}; errors: ${errors.join('\n')}`);
}
async function go(path, guarded = false) {
  const marker = String(Date.now());
  await command('Page.navigate', { url: `http://localhost:5000${path}${path.includes('?') ? '&' : '?'}_test=${marker}` });
  await until(`location.search.includes(${JSON.stringify(marker)}) && document.readyState==='complete'`, path);
  if (guarded) await until(`document.documentElement.dataset.authReady==='1' && !document.documentElement.hidden`, 'guard');
}
async function fill(values, button) {
  await evaluate(`(()=>{const values=${JSON.stringify(values)};for(const [id,v] of Object.entries(values)){const el=document.getElementById(id);if(!el)throw Error(id);if(el.type==='checkbox')el.checked=v;else el.value=v;}document.getElementById(${JSON.stringify(button)}).click();})()`);
}
async function login(actor) {
  await go('/register/index.html');
  const token = await admin.auth().createCustomToken(actor.uid);
  await evaluate(`(async()=>{const sdk=await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');const {auth}=await import('/js/core/firebaseConfig.js');await sdk.signOut(auth);await sdk.signInWithCustomToken(auth,${JSON.stringify(token)});})()`);
}
async function otp(actor, path, fieldPrefix, section) {
  await go(path);
  await until(`document.getElementById(${JSON.stringify(fieldPrefix+'-btn-send-otp')})`, 'wizard ready');
  await evaluate(`(async()=>{const api=await import('/js/core/auth.js');await api.signOutCurrentUser();})()`);
  await fill({ [`${fieldPrefix}-inp-phone`]: actor.phone }, `${fieldPrefix}-btn-send-otp`);
  await until(`!document.getElementById(${JSON.stringify(section)}).classList.contains('hidden')`, 'OTP sent');
  const codes = await fetch('http://127.0.0.1:9099/emulator/v1/projects/resqfood-ec8f5/verificationCodes').then(r => r.json());
  const code = codes.verificationCodes.find(c => c.phoneNumber === actor.phone)?.code;
  assert.ok(code, 'Auth emulator issued a code');
  await evaluate(`(()=>{const inputs=document.querySelectorAll('#${section} .otp-input');inputs.forEach((el,i)=>el.value=${JSON.stringify(code)}[i]);inputs[5].dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await until(`document.getElementById('step-${fieldPrefix === 'lgu' ? 3 : 2}').classList.contains('active')`, 'OTP verified');
}
async function upload(inputId, button, nextStep) {
  await evaluate(`(()=>{const transfer=new DataTransfer();transfer.items.add(new File(['%PDF-1.4 fictional capstone fixture'],'authorization.pdf',{type:'application/pdf'}));const el=document.getElementById(${JSON.stringify(inputId)});el.files=transfer.files;el.dispatchEvent(new Event('change',{bubbles:true}));document.getElementById(${JSON.stringify(button)}).click();})()`);
  await until(`document.getElementById('step-${nextStep}').classList.contains('active')`, 'document uploaded');
}
async function approve(actor) {
  const profile = (await db.collection('users').doc(actor.uid).get()).data();
  const requestId = profile.verificationRequestId || profile.authorizationRequestId;
  assert.ok(requestId);
  await login(users[3]); await go('/admin/index.html', true);
  await until(`document.querySelector('.review-request[data-id="${requestId}"]')`, 'review queue');
  await evaluate(`document.querySelector('.review-request[data-id="${requestId}"]').closest('tr').querySelector('.view-document').click()`);
  await until(`document.querySelector('#document-preview iframe')?.src.startsWith('blob:')`, 'authorization document retrieved for review');
  await evaluate(`document.querySelector('#document-preview button').click()`);
  await evaluate(`document.querySelector('.review-request[data-id="${requestId}"]').click()`);
  await until(`!document.querySelector('.review-request[data-id="${requestId}"]')`, 'review approved');
  assert.equal((await db.collection('users').doc(actor.uid).get()).data().status, 'active');
  await login(actor);
}
async function run() {
  const targets = await fetch(`http://127.0.0.1:${process.env.BROWSER_DEBUG_PORT || '9223'}/json/list`).then(r => r.json());
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = event => {
    const m = JSON.parse(event.data);
    if (m.id) { pending.get(m.id)?.(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Page.javascriptDialogOpening') command('Page.handleJavaScriptDialog', { accept: true, promptText: 'Fictional document and training acknowledgment reviewed' }).catch(e => errors.push(e.message));
  };
  await command('Page.enable'); await command('Runtime.enable'); await command('Network.enable');
  await command('Network.setCacheDisabled', { cacheDisabled: true });
  await command('Browser.setDownloadBehavior', { behavior: 'deny' });
  await command('Browser.setPermission', { permission: { name: 'camera' }, setting: 'denied', origin: 'http://localhost:5000' });
  await go('/register/index.html'); errors.length = 0;
  for (const actor of users) await admin.auth().createUser({ uid: actor.uid, phoneNumber: actor.phone });
  await admin.auth().setCustomUserClaims(users[3].uid, { role: 'systemAdmin' });
  await db.collection('users').doc(users[3].uid).set({ role: 'systemAdmin', status: 'active', fullName: 'Browser Reviewer', createdAt: new Date() });

  if (!process.argv.includes('--lgu-only')) {
  if (!process.argv.includes('--org-only')) {
  const volunteer = users[0];
  await otp(volunteer, '/register/volunteer.html', 'v', 'v-otp-section');
  await fill({ 'v-inp-name': 'Browser Volunteer', 'v-inp-nickname': 'Tester', 'v-inp-barangay': 'Lahug', 'v-inp-commitment': 'regular' }, 'v-btn-2-next');
  await until(`document.getElementById('step-3').classList.contains('active')`, 'volunteer profile');
  await evaluate(`document.getElementById('v-btn-3-next').click()`);
  assert.equal(await evaluate(`document.getElementById('v-err-id').classList.contains('visible')`), true);
  await upload('v-inp-id', 'v-btn-3-next', 4);
  await evaluate(`document.querySelector('[data-slot]').checked=true;document.querySelector('#barangay-chips input').checked=true`);
  await fill({ 'v-inp-transport': 'walk' }, 'v-btn-4-next');
  await fill({ 'v-inp-ec-name': 'Emergency Contact', 'v-inp-ec-phone': '+639171234567', 'v-chk-terms': true }, 'v-btn-submit');
  await until(`document.getElementById('step-success').classList.contains('active')`, 'volunteer submitted');
  assert.equal((await db.collection('users').doc(volunteer.uid).get()).data().status, 'pending_orientation');
  await go('/volunteer/index.html', true);
  await until(`document.getElementById('panel-available').textContent.includes('Pending')`, 'pending volunteer screen');
  assert.equal(await evaluate(`document.querySelectorAll('.btn-accept').length`), 0);
  await approve(volunteer); await go('/volunteer/index.html', true);
  await until(`document.getElementById('orientation-banner').classList.contains('hidden')`, 'volunteer activated');
  // Return login uses the real wizard-issued phone, not a custom-token bypass.
  await evaluate(`(async()=>{const api=await import('/js/core/auth.js');await api.signOutCurrentUser();})()`);
  await go('/volunteer/login.html?next=%2Fvolunteer%2Fhistory.html');
  await fill({ 'login-phone': volunteer.phone }, 'login-send');
  await until(`!document.getElementById('login-confirm').disabled`, 'returning volunteer OTP sent');
  const returningCodes = await fetch('http://127.0.0.1:9099/emulator/v1/projects/resqfood-ec8f5/verificationCodes').then(r => r.json());
  const returningCode = returningCodes.verificationCodes.find(c => c.phoneNumber === volunteer.phone).code;
  await fill({ 'login-code': returningCode }, 'login-confirm');
  await until(`location.pathname==='/volunteer/history.html' && document.documentElement.dataset.authReady==='1'`, 'returning volunteer intent preserved');

  // More than a page of expired listings must not crowd out an available mission.
  const boardFixtures = [];
  const boardOrg = db.collection('organizations').doc(prefix+'-board-org');
  reportFixtures.push(boardOrg); boardFixtures.push(boardOrg);
  await boardOrg.set({ status: 'active', orgName: 'Board fixture kitchen', primaryContactUid: users[3].uid, verifierUids: [] });
  for (let i = 0; i < 51; i++) {
    const ref = db.collection('donations').doc(`${prefix}-expired-${i}`); reportFixtures.push(ref); boardFixtures.push(ref);
    await ref.set({ donorId: users[3].uid, orgId: prefix+'-board-org', status: 'pending', foodType: 'Expired fixture',
      pickupWindowStart: new Date(Date.now()-7200000), pickupWindowEnd: new Date(Date.now()-3600000), createdAt: new Date() });
  }
  const available = db.collection('donations').doc(`${prefix}-available`); reportFixtures.push(available); boardFixtures.push(available);
  await available.set({ donorId: users[3].uid, orgId: prefix+'-board-org', status: 'pending', foodType: 'Current board fixture', quantityKg: 1,
    pickupWindowStart: new Date(), pickupWindowEnd: new Date(Date.now()+3600000), createdAt: new Date() });
  await go('/volunteer/index.html', true);
  await until(`document.getElementById('panel-available').textContent.includes('Current board fixture')`, 'expired records cannot crowd out available mission');
  assert.equal(await evaluate(`document.getElementById('panel-available').textContent.includes('Expired fixture')`), false);
  await Promise.all(boardFixtures.map(ref => ref.delete()));
  await db.collection('users').doc(volunteer.uid).update({ status: 'rejected' });
  await go('/volunteer/index.html', true);
  await until(`document.getElementById('panel-available').textContent.includes('Hindi naaprubahan')`, 'rejected volunteer sees accurate status');
  await go('/volunteer/history.html', true);
  await until(`document.getElementById('volunteer-history').textContent.includes('Hindi naaprubahan')`, 'rejected volunteer history stays gated');
  await db.collection('users').doc(volunteer.uid).update({ status: 'suspended' });
  await command('Page.navigate', { url: 'http://localhost:5000/volunteer/index.html?_suspensionTest='+Date.now() });
  await until(`location.pathname==='/register/index.html' && location.search.includes('suspended=1')`, 'suspended session signed out');
  await db.collection('users').doc(volunteer.uid).update({ status: 'active' });
  if (process.argv.includes('--volunteer-only')) {
    assert.deepEqual(errors, []);
    console.log('PASS: volunteer signup/approval, returning OTP login and intent, expired-board filtering, rejected history/dashboard and suspended-session gate.');
    return;
  }

  }
  const org = users[1];
  await otp(org, '/register/org-admin.html', 'o', 'o-otp-section');
  await fill({ 'o-inp-name': 'Browser Onboarding Kitchen', 'o-inp-type': 'soup_kitchen', 'o-inp-barangay': 'Lahug', 'o-inp-address': '123 Browser Street, Lahug, Cebu City' }, 'o-btn-2-next');
  await fill({ 'o-inp-contact': 'Browser Coordinator', 'o-inp-designation': 'Coordinator' }, 'o-btn-3-next');
  await upload('o-inp-doc', 'o-btn-4-next', 5);
  await evaluate(`document.getElementById('o-btn-device').click()`);
  await until(`!document.getElementById('o-btn-5-next').disabled`, 'camera denied PIN fallback');
  assert.ok((await evaluate(`document.getElementById('o-device-mode').textContent`)).includes('PIN'));
  await evaluate(`document.getElementById('o-btn-5-next').click()`);
  await fill({ 'o-chk-training': true, 'o-chk-responsibility': true }, 'o-btn-submit');
  await until(`document.getElementById('step-7').classList.contains('active')`, 'org submitted');
  await go('/org-admin/index.html', true);
  await until(`document.getElementById('panel-incoming').textContent.includes('Pending')`, 'pending org screen');
  await go('/org-admin/verify.html', true);
  await until(`document.querySelector('main').textContent.includes('Pending')`, 'pending org cannot open receipt controls');
  assert.equal(await evaluate(`document.getElementById('btn-confirm-pin')===null`), true);
  await approve(org); await go('/org-admin/index.html', true);
  await until(`document.getElementById('pending-banner').classList.contains('hidden')`, 'org activated');
  assert.equal((await db.collection('organizations').doc(org.uid).get()).data().status, 'active');
  assert.equal((await db.collection('organizations').doc(org.uid).get()).data().address, '123 Browser Street, Lahug, Cebu City');
  await evaluate(`document.getElementById('btn-signout').click();document.getElementById('btn-confirm-signout').click()`);
  await until(`location.pathname==='/org-admin/login.html'`, 'org sign-out returns to login');
  await command('Page.navigate', { url: 'http://localhost:5000/org-admin/history.html?_protected='+Date.now() });
  await until(`location.pathname==='/org-admin/login.html' && new URLSearchParams(location.search).get('next')?.startsWith('/org-admin/history.html')`, 'org login preserves protected destination');
  await until(`document.documentElement.dataset.loginReady==='1'`, 'org login handlers ready');
  await fill({ 'login-phone': org.phone }, 'login-send');
  await until(`!document.getElementById('login-confirm').disabled`, 'org return OTP sent');
  const orgCodes = await fetch('http://127.0.0.1:9099/emulator/v1/projects/resqfood-ec8f5/verificationCodes').then(r => r.json());
  await fill({ 'login-code': orgCodes.verificationCodes.find(c => c.phoneNumber === org.phone).code }, 'login-confirm');
  await until(`location.pathname==='/org-admin/history.html' && document.documentElement.dataset.authReady==='1'`, 'org OTP return login');
  await go('/org-admin/verify.html', true);
  await until(`!document.getElementById('pin-mode').classList.contains('hidden')`, 'saved PIN mode selected');
  await go('/org-admin/index.html', true);
  await until(`!document.getElementById('org-details-form').hidden`, 'primary can edit details');
  await evaluate(`(()=>{const form=document.getElementById('org-details-form');form.elements.address.value='456 Updated Browser Street, Lahug, Cebu City';form.requestSubmit();})()`);
  await until(`document.getElementById('org-details-status').textContent.includes('Na-save')`, 'address updated');
  assert.equal((await db.collection('organizations').doc(org.uid).get()).data().address, '456 Updated Browser Street, Lahug, Cebu City');
  const queueFixtures = [];
  for (let i=0;i<25;i++) {
    const ref=db.collection('donations').doc(`${prefix}-queue-${i}`); reportFixtures.push(ref); queueFixtures.push(ref);
    await ref.set({ orgId:org.uid, donorId:users[3].uid, volunteerId:users[0].uid, status:'delivered', quantityKg:1,
      foodType:'Queue fixture '+i, createdAt:new Date(), updatedAt:new Date() });
  }
  await until(`document.getElementById('incoming-count').textContent==='25' && document.querySelectorAll('#panel-incoming .delivery-card').length===25`, 'all 25 waiting deliveries visible');
  const oldReceipt = db.collection('donations').doc(`${prefix}-old-receipt`), newReceipt = db.collection('donations').doc(`${prefix}-new-receipt`);
  reportFixtures.push(oldReceipt,newReceipt); queueFixtures.push(oldReceipt,newReceipt);
  await oldReceipt.set({ orgId:org.uid, donorId:users[3].uid, volunteerId:users[0].uid, status:'verified', quantityKg:7,
    foodType:'Old receipt fixture', createdAt:new Date(), verifiedAt:new Date(Date.now()-40*86400000) });
  await newReceipt.set({ orgId:org.uid, donorId:users[3].uid, volunteerId:users[0].uid, status:'verified', quantityKg:2.5,
    foodType:'New receipt fixture', createdAt:new Date(Date.now()-70*86400000), verifiedAt:new Date() });
  await until(`document.getElementById('stat-deliveries').textContent==='2' && document.getElementById('stat-kg').textContent==='2.5' && document.getElementById('stat-today').textContent==='1'`, 'receipt-based summary');
  await evaluate(`document.getElementById('tab-verified').click()`);
  assert.ok((await evaluate(`document.getElementById('panel-verified').textContent`)).includes('New receipt fixture'));
  assert.equal((await evaluate(`document.getElementById('panel-verified').textContent`)).includes('Old receipt fixture'),false);
  await go('/org-admin/history.html',true);
  await until(`document.querySelectorAll('#history-list .history-item').length===2`, 'org history loaded');
  assert.ok((await evaluate(`document.querySelector('#history-list .history-item').textContent`)).includes('New receipt fixture'));
  await Promise.all(queueFixtures.map(ref=>ref.delete()));
  await db.collection('users').doc(org.uid).update({status:'rejected'});
  for(const path of ['/org-admin/index.html','/org-admin/history.html','/org-admin/verify.html']) {
    await go(path,true);
    await until(`document.body.textContent.includes('Hindi naaprubahan')`, 'rejected org gate '+path);
  }
  await db.collection('users').doc(org.uid).update({status:'active'});
  await db.collection('organizations').doc(org.uid).update({status:'suspended'});
  for(const path of ['/org-admin/index.html','/org-admin/history.html','/org-admin/verify.html']) {
    await go(path,true);
    await until(`document.body.textContent.includes('Naka-suspend ang organization')`, 'disabled organization gate '+path);
  }
  await db.collection('organizations').doc(org.uid).update({status:'active'});
  if(process.argv.includes('--org-only')) {
    assert.deepEqual(errors,[]);
    console.log('PASS: org OTP signup/return login, address update, pending/rejected/disabled gates, PIN mode, complete queue and receipt-based history/metrics.');
    return;
  }

  }
  await login(users[3]); await go('/app-admin/index.html', true);
  await until(`document.getElementById('invite-form')`, 'invite form');
  await evaluate(`(()=>{const form=document.getElementById('invite-form');form.elements.email.value='browser@barangay.gov.ph';form.elements.barangay.value='Lahug';form.requestSubmit();})()`);
  await until(`document.querySelector('#invite-result a')`, 'invite created');
  const invitation = new URL(await evaluate(`document.querySelector('#invite-result a').href`));
  const token = invitation.searchParams.get('token');
  const { createHash } = require('node:crypto');
  inviteId = (await db.collection('invites').where('tokenHash', '==', createHash('sha256').update(token).digest('hex')).get()).docs[0].id;
  await go(invitation.pathname + invitation.search);
  await until(`!document.getElementById('lgu-btn-invite-next').disabled`, 'valid LGU invite');
  await fill({ 'lgu-inp-email': 'browser@barangay.gov.ph' }, 'lgu-btn-invite-next');
  // otp() navigates, so perform the LGU OTP in the existing invite wizard.
  await evaluate(`(async()=>{const api=await import('/js/core/auth.js');await api.signOutCurrentUser();})()`);
  await fill({ 'lgu-inp-phone': users[2].phone }, 'lgu-btn-send-otp');
  await until(`!document.getElementById('lgu-otp-section').classList.contains('hidden')`, 'LGU OTP sent');
  const codes = await fetch('http://127.0.0.1:9099/emulator/v1/projects/resqfood-ec8f5/verificationCodes').then(r => r.json());
  const code = codes.verificationCodes.find(c => c.phoneNumber === users[2].phone).code;
  await evaluate(`document.querySelectorAll('#lgu-otp-section .otp-input').forEach((el,i)=>el.value=${JSON.stringify(code)}[i]);document.querySelectorAll('#lgu-otp-section .otp-input')[5].dispatchEvent(new Event('input',{bubbles:true}))`);
  await until(`document.getElementById('step-3').classList.contains('active')`, 'LGU OTP verified');
  await fill({ 'lgu-inp-name': 'Browser LGU Coordinator', 'lgu-inp-designation': 'Coordinator', 'lgu-inp-barangay': 'Lahug' }, 'lgu-btn-3-next');
  await upload('lgu-inp-doc', 'lgu-btn-4-next', 5);
  await fill({ 'lgu-chk-audit': true }, 'lgu-btn-submit');
  await until(`document.getElementById('step-6').classList.contains('active')`, 'LGU submitted');
  const applicant = (await db.collection('users').doc(users[2].uid).get()).data();
  assert.equal(applicant.status, 'pending_review'); assert.equal(applicant.role, undefined);
  assert.equal((await db.collection('invites').doc(inviteId).get()).data().usedBy, users[2].uid);
  for (const page of ['index', 'users', 'donations', 'audit']) {
    await go(`/admin/${page}.html`, true);
    await until(`document.querySelector('main [role="status"]')?.textContent.includes('Pending')`, 'pending LGU gate');
    assert.equal(await evaluate(`document.querySelector('main table')`), null);
  }
  await approve(users[2]); await go('/admin/index.html', true);
  await until(`document.getElementById('admin-name').textContent.includes('Browser LGU')`, 'LGU dashboard activated');
  await go('/admin/users.html', true);
  await evaluate(`document.getElementById('btn-signout').click()`);
  await until(`location.pathname==='/admin/login.html' && document.documentElement.dataset.loginReady==='1'`, 'LGU sign-out');
  assert.equal(await evaluate(`(async()=>{const {getCurrentUser}=await import('/js/core/auth.js');return (await getCurrentUser())===null;})()`), true);
  await fill({ 'login-phone': users[2].phone }, 'login-send');
  await until(`!document.getElementById('login-confirm').disabled`, 'returning LGU OTP');
  const returnCodes = await fetch('http://127.0.0.1:9099/emulator/v1/projects/resqfood-ec8f5/verificationCodes').then(r => r.json());
  await fill({ 'login-code': returnCodes.verificationCodes.find(c => c.phoneNumber === users[2].phone).code }, 'login-confirm');
  await until(`location.pathname==='/admin/index.html' && document.documentElement.dataset.pageReady==='1'`, 'returning LGU dashboard');
  for (const status of ['pending', 'verified']) {
    const ref = db.collection('donations').doc(`${prefix}-${status}`); reportFixtures.push(ref);
    await ref.set({ donorId: users[0].uid, orgId: users[1].uid, status, foodType: `${prefix}-${status}`, quantityKg: 2,
      createdAt: new Date(), verifiedAt: status === 'verified' ? new Date() : null });
  }
  const legacy = db.collection('auditLogs').doc(`${prefix}-legacy`); reportFixtures.push(legacy);
  await legacy.set({ type: 'user_suspended', uid: users[2].uid, donationId: `${prefix}-historical`, at: new Date() });
  async function captureExport(button) {
    await evaluate(`(()=>{window.__exportCsv=null;const original=URL.createObjectURL;URL.createObjectURL=blob=>{blob.text().then(text=>window.__exportCsv=text);return original(blob)};document.getElementById(${JSON.stringify(button)}).click();})()`);
    await until(`typeof window.__exportCsv==='string'`, 'CSV export received');
    return evaluate('window.__exportCsv');
  }
  await go('/admin/donations.html', true);
  await until(`document.getElementById('donations-body').textContent.includes('${prefix}-pending')`, 'report fixtures loaded');
  await evaluate(`document.querySelector('[data-status="verified"]').click()`);
  await until(`document.getElementById('donations-body').textContent.includes('${prefix}-verified') && !document.getElementById('donations-body').textContent.includes('${prefix}-pending')`, 'report status filter');
  const donationCsv = await captureExport('btn-export-donations');
  assert.ok(donationCsv.includes(`${prefix}-verified`)); assert.ok(!donationCsv.includes(`${prefix}-pending`));
  await go('/admin/audit.html', true);
  await until(`document.getElementById('audit-body').textContent.includes('${prefix}-historical')`, 'legacy audit displayed');
  await evaluate(`document.querySelector('[data-action="user_suspended"]').click()`);
  const auditCsv = await captureExport('btn-export-audit');
  assert.ok(auditCsv.includes(`${prefix}-historical`));
  await db.collection('users').doc(users[2].uid).update({ status: 'rejected' });
  for (const page of ['index', 'users', 'donations', 'audit']) {
    await go(`/admin/${page}.html`, true);
    await until(`document.querySelector('main [role="status"]')?.textContent.includes('Hindi naaprubahan')`, 'rejected LGU gate');
  }
  assert.deepEqual(errors, []);
  console.log(process.argv.includes('--lgu-only')
    ? 'PASS: LGU invite, OTP, upload/approval, pending/rejected gates, actual sign-out, returning OTP, filtered donation CSV and historical audit export.'
    : 'PASS: volunteer/org OTP, upload, pending screens, admin UI review/activation; PIN fallback; LGU onboarding/access/login; filtered donation CSV and historical audit export.');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  ws?.close();
  await Promise.all(reportFixtures.map(ref => ref.delete()));
  for (const actor of users) {
    const requests = await db.collection('verificationRequests').where('uploaderUid', '==', actor.uid).get();
    for (const request of requests.docs) {
      if (request.data().storagePath) await admin.storage().bucket().file(request.data().storagePath).delete().catch(() => {});
      await request.ref.delete();
    }
    const audits = await db.collection('auditLogs').where('actorUid', '==', actor.uid).get();
    await Promise.all(audits.docs.map(d => d.ref.delete()));
    await db.collection('users').doc(actor.uid).delete();
    await db.collection('organizations').doc(actor.uid).delete();
    await admin.auth().deleteUser(actor.uid).catch(() => {});
  }
  if (inviteId) await db.collection('invites').doc(inviteId).delete();
  await admin.app().delete();
});
