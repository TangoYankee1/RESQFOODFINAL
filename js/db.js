import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from './firebase-init.js';

const DONATIONS = 'donations';

export async function createDonation(donorId, data) {
  const payload = {
    ...data,
    donorId,
    status: 'open',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, DONATIONS), payload);
  return ref.id;
}

export async function getDonation(id) {
  const snap = await getDoc(doc(db, DONATIONS, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function listDonationsByDonor(donorId) {
  const q = query(
    collection(db, DONATIONS),
    where('donorId', '==', donorId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listOpenDonations() {
  const q = query(
    collection(db, DONATIONS),
    where('status', '==', 'open'),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listDonationsByStatuses(statuses) {
  const q = query(
    collection(db, DONATIONS),
    where('status', 'in', statuses),
    orderBy('updatedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function claimDonation(id, volunteerId) {
  await updateDoc(doc(db, DONATIONS, id), {
    status: 'claimed',
    volunteerId,
    claimedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function completeDonation(id) {
  await updateDoc(doc(db, DONATIONS, id), {
    status: 'completed',
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function listBeneficiaryOrgs() {
  const q = query(collection(db, 'users'), where('role', '==', 'Beneficiary'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listDonationsByStatusForOrg(status, orgId) {
  const q = query(
    collection(db, DONATIONS),
    where('beneficiaryOrgId', '==', orgId),
    where('status', '==', status),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listDonationsByStatusesForOrg(statuses, orgId) {
  const q = query(
    collection(db, DONATIONS),
    where('beneficiaryOrgId', '==', orgId),
    where('status', 'in', statuses),
    orderBy('updatedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listActiveMissionsByVolunteer(uid) {
  const q = query(
    collection(db, DONATIONS),
    where('volunteerId', '==', uid),
    where('status', 'in', ['claimed', 'picked-up', 'en-route', 'delivered']),
    orderBy('claimedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listMissionHistoryByVolunteer(uid) {
  const q = query(
    collection(db, DONATIONS),
    where('volunteerId', '==', uid),
    where('status', 'in', ['completed', 'verified']),
    orderBy('updatedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function pickupDonation(id) {
  await updateDoc(doc(db, DONATIONS, id), {
    status: 'picked-up',
    pickedUpAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function enRouteDonation(id) {
  await updateDoc(doc(db, DONATIONS, id), {
    status: 'en-route',
    enRouteAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deliveredDonation(id) {
  await updateDoc(doc(db, DONATIONS, id), {
    status: 'delivered',
    deliveredAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function donationQrPayload(donationId, donorId) {
  return JSON.stringify({ type: 'resqfood-donation', v: 2, id: donationId, donorId, createdAt: Date.now() });
}

export function parseDonationQr(text) {
  try {
    const data = JSON.parse(text);
    if (data?.type === 'resqfood-donation' && data.id) return data.id;
  } catch {
    /* plain id fallback */
  }
  if (/^[a-zA-Z0-9]{10,}$/.test(text.trim())) return text.trim();
  return null;
}

export function parseDonationQrFull(text) {
  try {
    const data = JSON.parse(text);
    if (data?.type === 'resqfood-donation' && data.id) return data;
  } catch {}
  return null;
}

export function deliveryQrPayload(donationId, orgId) {
  return JSON.stringify({ type: 'resqfood-delivery', v: 2, id: donationId, orgId });
}

export function parseDeliveryQr(text) {
  try {
    const data = JSON.parse(text);
    if (data?.type === 'resqfood-delivery' && data.id && data.orgId) return data;
  } catch {}
  return null;
}
