import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { functions } from "./firebaseConfig.js";

async function donorCall(name, payload = {}) {
  const response = await httpsCallable(functions, name)(payload);
  return response.data;
}
export const listDonationDestinations = () => donorCall('listDonationDestinations');
export const createDonorDonation = payload => donorCall('createDonorDonation', payload);
export const cancelDonorDonation = donationId => donorCall('cancelDonorDonation', { donationId });
export const refreshDonorExpiry = () => donorCall('refreshDonorExpiry');
export const donorMissionContact = donationId => donorCall('donorMissionContact', { donationId });
export const signupLguWithProfile = profile => donorCall('signupLguWithProfile', profile);
export const volunteerMissionContact = donationId => donorCall('volunteerMissionContact', { donationId });
export const updateOrganizationDetails = payload => donorCall('updateOrganizationDetails', payload);

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

async function claimDonation(payload){
  const fn = httpsCallable(functions, 'claimDonationCallable');
  return fn(payload).then(r => r.data);
}

async function transitionDonationStatus(payload){
  const fn = httpsCallable(functions, 'transitionDonationStatusCallable');
  return fn(payload).then(r => r.data);
}

async function sendNotification(payload){
  const fn = httpsCallable(functions, 'sendNotificationCallable');
  return fn(payload).then(r => r.data);
}

async function issuePin(payload){
  const fn = httpsCallable(functions, 'issuePin');
  return fn(payload).then(r => r.data);
}

async function verifyPinCode(payload){
  const fn = httpsCallable(functions, 'verifyPin');
  return fn(payload).then(r => r.data);
}

async function issueCredential(payload){
  const fn = httpsCallable(functions, 'issueCredential');
  return fn(payload).then(r => r.data);
}

async function recordOtpSend(payload){
  const fn = httpsCallable(functions, 'recordOtpSend');
  return fn(payload).then(r => r.data);
}

async function recordConsent(payload){
  const fn = httpsCallable(functions, 'recordConsent');
  return fn(payload).then(r => r.data);
}

async function exportCsv(payload){
  const fn = httpsCallable(functions, 'exportCsv');
  return fn(payload).then(r => r.data);
}

async function setUserStatus(payload){
  const fn = httpsCallable(functions, 'setUserStatus');
  return fn(payload).then(r => r.data);
}

export { signupWithProfile, signupVolunteerWithProfile, signupOrgAdminWithProfile, createInvite, validateInvite, consumeInvite, assignRole, verifyQr, reviewVerificationRequest, claimDonation, transitionDonationStatus, sendNotification, issuePin, verifyPinCode, issueCredential, recordOtpSend, recordConsent, exportCsv, setUserStatus };
