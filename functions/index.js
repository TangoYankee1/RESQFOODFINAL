const admin = require('firebase-admin');
let functions;
try{
  functions = require('firebase-functions');
}catch(e){
  // Fallback shim for environments without firebase-functions installed (tests/emulator sandbox).
  const HttpsError = class HttpsError extends Error { constructor(code, message){ super(message); this.code = code; } };
  functions = {
    https: {
      onRequest: (fn) => fn,
      onCall: (fn) => fn,
      HttpsError
    },
    HttpsError
  };
}
const { claimDonation } = require('./lib/claim');
const { transitionDonationStatus } = require('./lib/lifecycle');
const { sendNotification } = require('./lib/notify');
const { signupWithProfile } = require('./lib/authSignup');
const { signupVolunteerWithProfile } = require('./lib/volunteerSignup');
const { signupOrgAdminWithProfile } = require('./lib/orgAdminSignup');
const { signupLguWithProfile } = require('./lib/lguSignup');
const { volunteerMissionContact } = require('./lib/volunteer');
const { updateOrganizationDetails } = require('./lib/organization');
const { assignRole } = require('./lib/assignRole');
const { createInvite, validateInvite, consumeInvite } = require('./lib/invite');
const { reviewVerificationRequest } = require('./lib/reviewVerification');
const { issuePin } = require('./lib/pin');
const { issueCredential } = require('./lib/signQr');
const { recordOtpSend } = require('./lib/otpGuard');
const { recordConsent } = require('./lib/consent');
const { exportCsv } = require('./lib/csvExport');
const { setUserStatus } = require('./lib/adminActions');
const { handover } = require('./lib/handover');
const { listDonationDestinations, createDonorDonation, cancelDonorDonation, refreshDonorExpiry, donorMissionContact } = require('./lib/donor');

if(!admin.apps || !admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const { requireActiveAccount, isReceivingOrgMember } = require('./lib/access');

// All operational callables share live status/role checks. Onboarding may run
// before activation, but a suspended account cannot restart signup.
function callable(handler) {
  const onboarding = ['signupWithProfileHandler', 'signupVolunteerWithProfileHandler',
    'signupOrgAdminWithProfileHandler', 'signupLguWithProfileHandler', 'consumeInviteHandler', 'recordConsentHandler'];
  return functions.https.onCall(async (data, context) => {
    if (!['validateInviteHandler', 'recordOtpSendHandler'].includes(handler.name)) {
      if (onboarding.includes(handler.name)) {
        if (!context?.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first');
        const user = await db.collection('users').doc(context.auth.uid).get();
        if (user.exists && ['suspended', 'rejected'].includes(user.data().status)) {
          throw new functions.https.HttpsError('permission-denied', 'Account is not eligible');
        }
      } else {
        await requireActiveAccount(db, context, functions.https.HttpsError);
      }
    }
    return handler(data, context);
  });
}

// Donor commands use one small role gate in addition to the shared live account guard.
function donorCommand(operation) {
  return callable(async function donorOperation(data, context) {
    if (context.auth.token.role !== 'donor') throw new functions.https.HttpsError('permission-denied', 'Donor account required');
    const result = await operation(data || {}, context.auth.uid);
    if (!result.success) throw new functions.https.HttpsError(
      result.reason === 'permission-denied' ? 'permission-denied' : result.reason === 'not_found' ? 'not-found' : 'failed-precondition', result.reason);
    return result;
  });
}
exports.listDonationDestinations = donorCommand(() => listDonationDestinations(db));
exports.createDonorDonation = donorCommand((data, uid) => createDonorDonation(db, uid, data));
exports.cancelDonorDonation = donorCommand((data, uid) => cancelDonorDonation(db, uid, data.donationId));
exports.refreshDonorExpiry = donorCommand((data, uid) => refreshDonorExpiry(db, uid));
exports.donorMissionContact = donorCommand((data, uid) => donorMissionContact(db, uid, data.donationId));

// Retired unsafe legacy endpoint: clients use the authenticated callable.
exports.claimDonation = functions.https.onRequest((req, res) => {
  res.status(410).json({ error: 'Use claimDonationCallable' });
});

// Callable function with auth check: only allow authenticated volunteers to claim.
async function claimDonationCallableHandler(data, context){
  // Auth checks
  if(!context || !context.auth) throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  const role = context.auth.token && context.auth.token.role;
  if(role !== 'volunteer') throw new functions.https.HttpsError('permission-denied', 'Only volunteers may claim donations.');

  const donationId = data && data.donationId;
  const volunteerId = context.auth.uid;
  if(!donationId) throw new functions.https.HttpsError('invalid-argument', 'donationId is required');

  const result = await claimDonation(db, donationId, volunteerId);
  if(!result.success){
    // map known reasons to HttpsError codes where appropriate
    if(result.reason === 'not_found') throw new functions.https.HttpsError('not-found', 'Donation not found', { reason: result.reason });
    if(result.reason === 'expired') throw new functions.https.HttpsError('failed-precondition', 'Pickup window has expired', { reason: result.reason });
    if(result.reason === 'not_pending') throw new functions.https.HttpsError('failed-precondition', 'Donation is not pending', { reason: result.reason });
  }
  return result;
}

exports.claimDonationCallableHandler = claimDonationCallableHandler;
exports.claimDonationCallable = callable(claimDonationCallableHandler);

async function transitionDonationStatusHandler(data, context){
  if(!context || !context.auth) throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');

  const { donationId, nextStatus } = data || {};
  const actorUid = context.auth.uid;
  const actorRole = context.auth.token && context.auth.token.role;

  if(!donationId || !nextStatus) throw new functions.https.HttpsError('invalid-argument', 'donationId and nextStatus are required');
  if(!actorRole) throw new functions.https.HttpsError('permission-denied', 'User role is required to transition donation status');

  const result = actorRole === 'donor' && nextStatus === 'cancelled'
    ? await cancelDonorDonation(db, actorUid, donationId)
    : await transitionDonationStatus(db, donationId, actorUid, nextStatus, actorRole);
  if(!result.success){
    if(result.reason === 'not_found') throw new functions.https.HttpsError('not-found', 'Donation not found');
    if(result.reason === 'invalid_transition') throw new functions.https.HttpsError('failed-precondition', 'This status transition is not allowed');
    if(result.reason === 'not_owner' || result.reason === 'not_assigned_volunteer' || result.reason === 'not_receiving_org') throw new functions.https.HttpsError('permission-denied', 'You are not allowed to change this donation');
    throw new functions.https.HttpsError('failed-precondition', result.reason || 'transition_failed');
  }

  return result;
}

exports.transitionDonationStatusHandler = transitionDonationStatusHandler;
exports.transitionDonationStatusCallable = callable(transitionDonationStatusHandler);

// Simple callable to send a notification (used for testing and stubbed sending)
async function sendNotificationHandler(data, context){
  if(!context || !context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  if (context.auth.token.role !== 'systemAdmin') throw new functions.https.HttpsError('permission-denied', 'Only system admins may send manual notifications');
  const { recipientUid, title, body } = data || {};
  if(!recipientUid || !title || !body) throw new functions.https.HttpsError('invalid-argument', 'recipientUid, title and body required');
  const result = await sendNotification(db, recipientUid, title, body, { actorUid: context.auth.uid });
  return result;
}

exports.sendNotificationHandler = sendNotificationHandler;
exports.sendNotificationCallable = callable(sendNotificationHandler);

// Callable to allow authenticated users to create/update their canonical profile.
async function signupWithProfileHandler(data, context){
  if(!context || !context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  const uid = context.auth.uid;
  const profile = data || {};
  if (profile.safetyConsent !== true || profile.privacyConsent !== true || !String(profile.barangay || '').trim()) {
    throw new functions.https.HttpsError('failed-precondition', 'Safety/privacy consent and barangay are required');
  }
  const verifiedPhone = context.auth.token.phone_number;
  if (!verifiedPhone || profile.phone !== verifiedPhone) {
    throw new functions.https.HttpsError('failed-precondition', 'Verify this phone number before saving the profile');
  }
  const result = await signupWithProfile(db, uid, profile);
  if(!result.success) throw new functions.https.HttpsError('invalid-argument', result.reason || 'failed');
  const saved = await db.collection('users').doc(uid).get();
  const account = await admin.auth().getUser(uid);
  await admin.auth().setCustomUserClaims(uid, { ...account.customClaims, role: saved.data().role });
  return result;
}

exports.signupWithProfileHandler = signupWithProfileHandler;
exports.signupWithProfile = callable(signupWithProfileHandler);

async function signupVolunteerWithProfileHandler(data, context){
  if(!context || !context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  if (!context.auth.token.phone_number || data?.phone !== context.auth.token.phone_number) throw new functions.https.HttpsError('failed-precondition', 'Verify the submitted phone first');
  const result = await signupVolunteerWithProfile(db, admin.auth(), context.auth.uid, data || {});
  if(!result.success) {
    const code = result.reason === 'role_conflict' ? 'already-exists' : 'invalid-argument';
    throw new functions.https.HttpsError(code, result.reason || 'failed');
  }
  return result;
}

exports.signupVolunteerWithProfileHandler = signupVolunteerWithProfileHandler;
exports.signupVolunteerWithProfile = callable(signupVolunteerWithProfileHandler);

async function signupOrgAdminWithProfileHandler(data, context){
  if(!context || !context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  if (!context.auth.token.phone_number || data?.phone !== context.auth.token.phone_number) throw new functions.https.HttpsError('failed-precondition', 'Verify the submitted phone first');
  let result;
  try { result = await signupOrgAdminWithProfile(db, context.auth.uid, data || {}); }
  catch (error) { throw new functions.https.HttpsError('failed-precondition',
    ['role_conflict', 'account_ineligible', 'already_registered', 'organization_exists', 'invalid_authorization_request'].includes(error.message) ? error.message : 'signup_failed'); }
  if(!result.success) {
    const code = result.reason === 'role_conflict' ? 'already-exists' : 'invalid-argument';
    throw new functions.https.HttpsError(code, result.reason || 'failed');
  }
  const account = await admin.auth().getUser(context.auth.uid);
  await admin.auth().setCustomUserClaims(context.auth.uid, { ...account.customClaims, role: 'orgAdmin' });
  return result;
}

exports.signupOrgAdminWithProfile = callable(signupOrgAdminWithProfileHandler);

async function signupLguWithProfileHandler(data, context) {
  if (!context.auth.token.phone_number || data?.phone !== context.auth.token.phone_number) {
    throw new functions.https.HttpsError('failed-precondition', 'Verify the submitted phone first');
  }
  const result = await signupLguWithProfile(db, context.auth.uid, data || {});
  if (!result.success) throw new functions.https.HttpsError('failed-precondition', result.reason);
  return result;
}
exports.signupLguWithProfile = callable(signupLguWithProfileHandler);

async function volunteerMissionContactHandler(data, context) {
  if (context.auth.token.role !== 'volunteer') throw new functions.https.HttpsError('permission-denied', 'Volunteer required');
  const result = await volunteerMissionContact(db, context.auth.uid, data?.donationId);
  if (!result.success) throw new functions.https.HttpsError(result.reason === 'permission-denied' ? 'permission-denied' : 'failed-precondition', result.reason);
  return result;
}
exports.volunteerMissionContact = callable(volunteerMissionContactHandler);

async function updateOrganizationDetailsHandler(data, context) {
  const result = await updateOrganizationDetails(db, context.auth.uid, data);
  if (!result.success) throw new functions.https.HttpsError(result.reason === 'permission-denied' ? 'permission-denied' : 'invalid-argument', result.reason);
  return result;
}
exports.updateOrganizationDetails = callable(updateOrganizationDetailsHandler);

async function reviewVerificationRequestHandler(data, context){
  if(!context || !context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  if(context.auth.token.role !== 'systemAdmin') throw new functions.https.HttpsError('permission-denied', 'Only system admins may review verification requests');
  const result = await reviewVerificationRequest(db, admin.auth(), context.auth.uid, data && data.requestId, data && data.decision, data && data.note);
  if(!result.success) throw new functions.https.HttpsError('failed-precondition', result.reason || 'review_failed');
  return result;
}

exports.reviewVerificationRequest = callable(reviewVerificationRequestHandler);

// Admin-only callable to assign roles
async function assignRoleHandler(data, context){
  if(!context || !context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  const actorUid = context.auth.uid;
  const actorRole = context.auth.token && context.auth.token.role;
    if(actorRole !== 'systemAdmin') throw new functions.https.HttpsError('permission-denied', 'Only system admins may assign roles');
  const targetUid = data && data.uid;
  const role = data && data.role;
  const result = await assignRole(db, admin.auth(), actorUid, actorRole, targetUid, role);
  if(!result.success) throw new functions.https.HttpsError('failed-precondition', result.reason || 'assign_failed');
  return result;
}

exports.assignRoleHandler = assignRoleHandler;
exports.assignRole = callable(assignRoleHandler);

// Invite callables
async function createInviteHandler(data, context){
  if(!context || !context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  const actorRole = context.auth.token && context.auth.token.role;
    if(actorRole !== 'systemAdmin') throw new functions.https.HttpsError('permission-denied', 'Only system admins may create invites');
  const kind = data && data.kind || 'lgu';
  const meta = data && data.meta || {};
  const expiresHours = data && data.expiresHours || 72;
  const res = await createInvite(db, context.auth.uid, kind, meta, expiresHours);
  if(!res.success) throw new functions.https.HttpsError('invalid-argument', res.reason || 'failed');
  return res;
}

async function validateInviteHandler(data){
  const token = data && data.token;
  if(!token) throw new functions.https.HttpsError('invalid-argument', 'token required');
  const res = await validateInvite(db, token);
  if(!res.success) throw new functions.https.HttpsError('not-found', res.reason || 'invalid');
  return res;
}

async function consumeInviteHandler(data, context){
  if(!context || !context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  const token = data && data.token;
  if(!token) throw new functions.https.HttpsError('invalid-argument', 'token required');
  const res = await consumeInvite(db, token, context.auth.uid);
  if(!res.success) throw new functions.https.HttpsError('failed-precondition', res.reason || 'invalid');
  return res;
}

exports.createInviteHandler = createInviteHandler;
exports.createInvite = callable(createInviteHandler);

exports.validateInviteHandler = validateInviteHandler;
exports.validateInvite = callable(validateInviteHandler);

exports.consumeInviteHandler = consumeInviteHandler;
exports.consumeInvite = callable(consumeInviteHandler);

// QR preview is read-only; pickup/receipt confirmation is handled atomically.
// Input: { payload } — raw scanned QR text. Verification outcomes (bad shape,
// expired, replayed, cancelled…) are RETURNED as { success:false, reason } so
// the client can map them to precise Tagalog copy; only auth/arg errors throw.
async function verifyQrHandler(data, context) {
  let payload;
  try { payload = JSON.parse(data?.payload); } catch { return { success: false, reason: 'bad_shape' }; }
  return handover(db, context.auth.uid, context.auth.token.role, {
    donationId: payload?.donationId, purpose: data?.context?.purpose || payload?.purpose,
    mode: 'qr', proof: data?.payload,
  }, false);
}
async function previewHandoverHandler(data, context) {
  return handover(db, context.auth.uid, context.auth.token.role, data, false);
}
async function confirmHandoverHandler(data, context) {
  return handover(db, context.auth.uid, context.auth.token.role, data, true);
}
exports.previewHandover = callable(previewHandoverHandler);
exports.confirmHandover = callable(confirmHandoverHandler);

exports.verifyQrHandler = verifyQrHandler;
exports.verifyQr = callable(verifyQrHandler);

// ── PROD.MD callables: PIN lifecycle (15-min TTL, single-use, hash-at-rest)

// Only the source of a handover may issue its purpose-bound PIN:
// donor for pickup; assigned volunteer for delivered receipt.
async function issuePinHandler(data, context) {
  if (!context || !context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  const { donationId, purpose } = data || {};
  if (!donationId) throw new functions.https.HttpsError('invalid-argument', 'donationId required');
  const snap = await db.collection('donations').doc(String(donationId)).get();
  if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Donation not found');
  const d = snap.data();
  const uid = context.auth.uid;
  const role = context.auth.token && context.auth.token.role;
  const party = d.donorId === uid || d.volunteerId === uid || await isReceivingOrgMember(db, d, uid) || ['lguAdmin', 'systemAdmin'].includes(role);
  if (!party) throw new functions.https.HttpsError('permission-denied', 'Not a party to this donation');
  const pickup = (purpose || 'verify') === 'pickup';
  if (pickup ? role !== 'donor' || d.donorId !== uid || !['pending','scheduled'].includes(d.status)
    : role !== 'volunteer' || d.volunteerId !== uid || d.status !== 'delivered') throw new functions.https.HttpsError('permission-denied', 'Only the handover source may issue this PIN');
  const deadline = d.pickupWindowEnd?.toDate ? d.pickupWindowEnd.toDate() : new Date(d.pickupWindowEnd);
  if (pickup && deadline <= new Date()) throw new functions.https.HttpsError('failed-precondition', 'Pickup window expired');
  return issuePin(db, { donationId: String(donationId), purpose, requestedBy: uid, role, deadline: pickup ? deadline : null });
}
exports.issuePinHandler = issuePinHandler;
exports.issuePin = callable(issuePinHandler);

// verifyPin (server PIN check): replaces every client-side DEMO_PINS path.
// Compatibility entry point also performs atomic confirmation; no consume-only path.
async function verifyPinHandler(data, context) {
  return handover(db, context.auth.uid, context.auth.token.role, {
    donationId: data?.donationId, purpose: data?.purpose || 'verify', mode: 'pin',
    proof: String(data?.pin || ''), requestId: data?.requestId,
  }, true);
}
exports.verifyPinHandler = verifyPinHandler;
exports.verifyPin = callable(verifyPinHandler);

// issueCredential: donor pickup proof or assigned-volunteer receipt proof.
async function issueCredentialHandler(data, context) {
  if (!context || !context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  const { donationId, purpose = 'pickup' } = data || {};
  if (!donationId) throw new functions.https.HttpsError('invalid-argument', 'donationId required');
  const snap = await db.collection('donations').doc(String(donationId)).get();
  if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Donation not found');
  const d = snap.data();
  const role = context.auth.token && context.auth.token.role;
  const issuerAllowed = purpose === 'pickup' ? role === 'donor' && d.donorId === context.auth.uid
    : purpose === 'verify' && role === 'volunteer' && d.volunteerId === context.auth.uid;
  if (!issuerAllowed) {
    throw new functions.https.HttpsError('permission-denied', 'Only the donor may issue credentials');
  }
  try {
    const result = await issueCredential(db, { donationId: String(donationId), donorId: d.donorId, issuedBy: context.auth.uid, purpose });
    if (!result.success) throw new functions.https.HttpsError('failed-precondition', result.reason);
    return result;
  } catch (err) {
    if (String(err && err.message).includes('QR_HMAC_SECRET')) throw new functions.https.HttpsError('failed-precondition', 'QR signing not configured');
    throw err;
  }
}
exports.issueCredentialHandler = issueCredentialHandler;
exports.issueCredential = callable(issueCredentialHandler);

// recordOtpSend: pre-send rate-limit gate (per-phone 3/10min + per-IP 20/hr).
async function recordOtpSendHandler(data, context) {
  const { phone } = data || {};
  if (!phone) throw new functions.https.HttpsError('invalid-argument', 'phone required');
  const raw = context && context.rawRequest;
  const ip = (raw && (raw.ip || (raw.headers && raw.headers['x-forwarded-for']))) || null;
  try {
    return await recordOtpSend(db, { phone: String(phone), ip });
  } catch (err) {
    throw new functions.https.HttpsError(err.code || 'unavailable', err.message);
  }
}
exports.recordOtpSendHandler = recordOtpSendHandler;
exports.recordOtpSend = callable(recordOtpSendHandler);

// recordConsent: versioned immutable consent (RA 10173).
async function recordConsentHandler(data, context) {
  if (!context || !context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  const { kind, version, textHash, userAgent } = data || {};
  const raw = context.rawRequest;
  const ip = (raw && (raw.ip || (raw.headers && raw.headers['x-forwarded-for']))) || null;
  const res = await recordConsent(db, { uid: context.auth.uid, kind, version, textHash, userAgent, ip });
  if (!res.success) throw new functions.https.HttpsError('invalid-argument', res.reason || 'invalid');
  return res;
}
exports.recordConsentHandler = recordConsentHandler;
exports.recordConsent = callable(recordConsentHandler);

// exportCsv: role-gated + audit-logged export for LGU/DILG reporting.
async function exportCsvHandler(data, context) {
  if (!context || !context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  const role = context.auth.token && context.auth.token.role;
  const res = await exportCsv(db, {
    kind: (data && data.kind) || 'donations',
    actorUid: context.auth.uid, actorRole: role,
    barangay: data && data.barangay, max: data && data.max,
      status: data && data.status, action: data && data.action, range: data && data.range,
  });
  if (!res.success) throw new functions.https.HttpsError(res.reason === 'permission-denied' ? 'permission-denied' : 'invalid-argument', res.reason || 'failed');
  return res;
}
exports.exportCsvHandler = exportCsvHandler;
exports.exportCsv = callable(exportCsvHandler);

// setUserStatus: audited suspend/activate (user + audit atomically).
async function setUserStatusHandler(data, context) {
  if (!context || !context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  const role = context.auth.token && context.auth.token.role;
  const res = await setUserStatus(db, {
    targetUid: data && data.targetUid,
    status: data && data.status,
    actorUid: context.auth.uid, actorRole: role,
    reason: data && data.reason,
  });
  if (!res.success) {
    throw new functions.https.HttpsError(
      res.reason === 'permission-denied' ? 'permission-denied' : res.reason === 'not_found' ? 'not-found' : 'invalid-argument',
      res.reason || 'failed');
  }
  return res;
}
exports.setUserStatusHandler = setUserStatusHandler;
exports.setUserStatus = callable(setUserStatusHandler);
