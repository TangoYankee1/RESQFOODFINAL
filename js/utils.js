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
import { db } from './firebase-config.js';

const DONATIONS = 'donations';

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatDate(value) {
  if (!value) return '—';
  const d = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
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
    /* fallback */
  }
  const trimmed = text.trim();
  if (/^[a-zA-Z0-9]{10,}$/.test(trimmed)) return trimmed;
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

export async function createDonation(donorId, data) {
  const ref = await addDoc(collection(db, DONATIONS), {
    ...data,
    donorId,
    status: 'open',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getDonation(id) {
  const snap = await getDoc(doc(db, DONATIONS, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
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

export async function listDonationsByStatus(status) {
  const q = query(
    collection(db, DONATIONS),
    where('status', '==', status),
    orderBy('createdAt', 'desc')
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

export async function verifyDonationHandoff(id, verifiedBy) {
  await updateDoc(doc(db, DONATIONS, id), {
    status: 'verified',
    verifiedBy,
    verifiedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
