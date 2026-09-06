import { getFunctions, httpsCallable, connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { app, auth } from "./firebaseConfig.js";

const functions = getFunctions(app);
// If running on localhost during dev, connect to functions emulator
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  try { connectFunctionsEmulator(functions, 'localhost', 5001); } catch(e) { /* ignore */ }
}

async function signupWithProfile(profile) {
  const fn = httpsCallable(functions, 'signupWithProfile');
  return fn(profile).then(r => r.data);
}

async function signupVolunteerWithProfile(profile) {
  const fn = httpsCallable(functions, 'signupVolunteerWithProfile');
  return fn(profile).then(r => r.data);
}

async function signupOrgAdminWithProfile(profile) {
  const fn = httpsCallable(functions, 'signupOrgAdminWithProfile');
  return fn(profile).then(r => r.data);
}

async function createInvite(payload){
  const fn = httpsCallable(functions, 'createInvite');
  return fn(payload).then(r => r.data);
}

async function validateInvite(payload){
  const fn = httpsCallable(functions, 'validateInvite');
  return fn(payload).then(r => r.data);
}

async function consumeInvite(payload){
  const fn = httpsCallable(functions, 'consumeInvite');
  return fn(payload).then(r => r.data);
}

async function assignRole(payload){
  const fn = httpsCallable(functions, 'assignRole');
  return fn(payload).then(r => r.data);
}

async function verifyQr(payload){
  const fn = httpsCallable(functions, 'verifyQr');
  return fn(payload).then(r => r.data);
}

async function reviewVerificationRequest(payload){
  const fn = httpsCallable(functions, 'reviewVerificationRequest');
  return fn(payload).then(r => r.data);
}

export { signupWithProfile, signupVolunteerWithProfile, signupOrgAdminWithProfile, createInvite, validateInvite, consumeInvite, assignRole, verifyQr, reviewVerificationRequest };
