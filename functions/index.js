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
const { assignRole } = require('./lib/assignRole');
const { createInvite, validateInvite, consumeInvite } = require('./lib/invite');
const { verifyQr } = require('./lib/qr');
const { reviewVerificationRequest } = require('./lib/reviewVerification');

if(!admin.apps || !admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// HTTP wrapper for manual testing / later deployment.
exports.claimDonation = functions.https.onRequest(async (req, res) => {
  try{
    const { donationId, volunteerId } = req.body || req.query || {};
    if(!donationId || !volunteerId) return res.status(400).json({ error: 'donationId and volunteerId required' });
    const result = await claimDonation(db, donationId, volunteerId);
    res.json(result);
  }catch(err){
    console.error(err);
    res.status(500).json({ error: err.message });
  }
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
    if(result.reason === 'not_found') throw new functions.https.HttpsError('not-found', 'Donation not found');
    if(result.reason === 'not_pending') throw new functions.https.HttpsError('failed-precondition', 'Donation is not pending');
  }
  return result;
}

exports.claimDonationCallableHandler = claimDonationCallableHandler;
exports.claimDonationCallable = functions.https.onCall(claimDonationCallableHandler);

async function transitionDonationStatusHandler(data, context){
  if(!context || !context.auth) throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');

  const { donationId, nextStatus } = data || {};
  const actorUid = context.auth.uid;
  const actorRole = context.auth.token && context.auth.token.role;

  if(!donationId || !nextStatus) throw new functions.https.HttpsError('invalid-argument', 'donationId and nextStatus are required');
  if(!actorRole) throw new functions.https.HttpsError('permission-denied', 'User role is required to transition donation status');

  const result = await transitionDonationStatus(db, donationId, actorUid, nextStatus, actorRole);
  if(!result.success){
    if(result.reason === 'not_found') throw new functions.https.HttpsError('not-found', 'Donation not found');
    if(result.reason === 'invalid_transition') throw new functions.https.HttpsError('failed-precondition', 'This status transition is not allowed');
    if(result.reason === 'not_owner' || result.reason === 'not_assigned_volunteer') throw new functions.https.HttpsError('permission-denied', 'You are not allowed to change this donation');
  }

  return result;
}

exports.transitionDonationStatusHandler = transitionDonationStatusHandler;
exports.transitionDonationStatusCallable = functions.https.onCall(transitionDonationStatusHandler);

// Simple callable to send a notification (used for testing and stubbed sending)
async function sendNotificationHandler(data, context){
  if(!context || !context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  const { recipientUid, title, body } = data || {};
  if(!recipientUid || !title || !body) throw new functions.https.HttpsError('invalid-argument', 'recipientUid, title and body required');
  const result = await sendNotification(db, recipientUid, title, body, { actorUid: context.auth.uid });
  return result;
}

exports.sendNotificationHandler = sendNotificationHandler;
exports.sendNotificationCallable = functions.https.onCall(sendNotificationHandler);

// Callable to allow authenticated users to create/update their canonical profile.
async function signupWithProfileHandler(data, context){
  if(!context || !context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  const uid = context.auth.uid;
  const profile = data || {};
  const result = await signupWithProfile(db, uid, profile);
  if(!result.success) throw new functions.https.HttpsError('invalid-argument', result.reason || 'failed');
  return result;
}

exports.signupWithProfileHandler = signupWithProfileHandler;
exports.signupWithProfile = functions.https.onCall(signupWithProfileHandler);

async function signupVolunteerWithProfileHandler(data, context){
  if(!context || !context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  const result = await signupVolunteerWithProfile(db, admin.auth(), context.auth.uid, data || {});
  if(!result.success) {
    const code = result.reason === 'role_conflict' ? 'already-exists' : 'invalid-argument';
    throw new functions.https.HttpsError(code, result.reason || 'failed');
  }
  return result;
}

exports.signupVolunteerWithProfileHandler = signupVolunteerWithProfileHandler;
exports.signupVolunteerWithProfile = functions.https.onCall(signupVolunteerWithProfileHandler);

async function signupOrgAdminWithProfileHandler(data, context){
  if(!context || !context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  const result = await signupOrgAdminWithProfile(db, context.auth.uid, data || {});
  if(!result.success) {
    const code = result.reason === 'role_conflict' ? 'already-exists' : 'invalid-argument';
    throw new functions.https.HttpsError(code, result.reason || 'failed');
  }
  return result;
}

exports.signupOrgAdminWithProfile = functions.https.onCall(signupOrgAdminWithProfileHandler);

async function reviewVerificationRequestHandler(data, context){
  if(!context || !context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  if(context.auth.token.role !== 'systemAdmin') throw new functions.https.HttpsError('permission-denied', 'Only system admins may review verification requests');
  const result = await reviewVerificationRequest(db, admin.auth(), context.auth.uid, data && data.requestId, data && data.decision, data && data.note);
  if(!result.success) throw new functions.https.HttpsError('failed-precondition', result.reason || 'review_failed');
  return result;
}

exports.reviewVerificationRequest = functions.https.onCall(reviewVerificationRequestHandler);

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
exports.assignRole = functions.https.onCall(assignRoleHandler);

// Invite callables
async function createInviteHandler(data, context){
  if(!context || !context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  const actorRole = context.auth.token && context.auth.token.role;
    if(actorRole !== 'systemAdmin') throw new functions.https.HttpsError('permission-denied', 'Only system admins may create invites');
  const kind = data && data.kind || 'lgu';
  const meta = data && data.meta || {};
  const expiresHours = data && data.expiresHours || 72;
  const res = await createInvite(db, context.auth.uid, kind, meta, expiresHours);
  if(!res.success) throw new functions.https.HttpsError('internal', 'failed');
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
exports.createInvite = functions.https.onCall(createInviteHandler);

exports.validateInviteHandler = validateInviteHandler;
exports.validateInvite = functions.https.onCall(validateInviteHandler);

exports.consumeInviteHandler = consumeInviteHandler;
exports.consumeInvite = functions.https.onCall(consumeInviteHandler);

// QR verification callable - allowed for volunteers, orgAdmin, system-admin
async function verifyQrHandler(data, context){
  if(!context || !context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  const actorRole = context.auth.token && context.auth.token.role;
    if(!['volunteer','orgAdmin','systemAdmin'].includes(actorRole)) throw new functions.https.HttpsError('permission-denied', 'Not authorized to verify QR');
  const token = data && data.token;
  if(!token) throw new functions.https.HttpsError('invalid-argument', 'token required');
  const res = await verifyQr(db, token, context.auth.uid);
  if(!res.success) throw new functions.https.HttpsError('failed-precondition', res.reason || 'invalid');
  return res;
}

exports.verifyQrHandler = verifyQrHandler;
exports.verifyQr = functions.https.onCall(verifyQrHandler);
