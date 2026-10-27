// public/js/core/data.js
// The single data access layer. No feature module may import Firestore
// directly — everything goes through here so queries, error mapping, and
// offline behaviour are consistent and testable.

import { db, storage } from './firebaseConfig.js';
import {
  collection, doc, getDoc, setDoc, updateDoc, addDoc,
  query, where, orderBy, limit, onSnapshot, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { classify } from './errors.js';
import { createDonorDonation, cancelDonorDonation } from './callables.js';

/**
 * Subscribe to a query with normalized error surfacing.
 * Returns the unsubscribe function. `handlers = { next(docs), error(err) }`.
 * docs is an array of { id, ...data }.
 */
export function watchQuery(q, handlers) {
  return onSnapshot(
    q,
    (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      handlers.next?.(docs, snap.metadata);
    },
    (err) => handlers.error?.(classify(err)),
  );
}

/** Fetch one document → { id, ...data } or null. */
export async function fetchDoc(path) {
  try {
    const snap = await getDoc(doc(db, ...path.split('/')));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    throw classify(err);
  }
}

/** Create a document with an auto id. */
export async function addDocument(path, data) {
  try {
    const colRef = collection(db, ...path.split('/'));
    const newRef = await addDoc(colRef, { ...data, createdAt: serverTimestamp() });
    return newRef.id;
  } catch (err) {
    throw classify(err);
  }
}

/** Create/overwrite a document at an explicit path (e.g. users/{uid}). */
export async function setDocument(path, data, options = {}) {
  try {
    await setDoc(doc(db, ...path.split('/')), { ...data, updatedAt: serverTimestamp() }, options);
  } catch (err) {
    throw classify(err);
  }
}

/** Patch a document. */
export async function patchDocument(path, data) {
  try {
    await updateDoc(doc(db, ...path.split('/')), { ...data, updatedAt: serverTimestamp() });
  } catch (err) {
    throw classify(err);
  }
}

// ── Domain queries ────────────────────────────────────────────────────────────

export function donationsQuery(filters = {}) {
  const clauses = [];
  if (filters.donorId) clauses.push(where('donorId', '==', filters.donorId));
  if (filters.volunteerId) clauses.push(where('volunteerId', '==', filters.volunteerId));
  if (filters.orgId) clauses.push(where('orgId', '==', filters.orgId));
  if (filters.status) clauses.push(where('status', '==', filters.status));
  if (filters.statusIn) clauses.push(where('status', 'in', filters.statusIn));
  clauses.push(orderBy(filters.orderBy || 'createdAt', filters.orderDir || 'desc'));
  if (filters.max) clauses.push(limit(filters.max));
  return query(collection(db, 'donations'), ...clauses);
}

/** Mission board: unclaimed donations. */
export function pendingDonationsQuery(max = 50) {
  return query(
    collection(db, 'donations'),
    where('status', '==', 'pending'),
    where('pickupWindowEnd', '>', new Date()),
    orderBy('pickupWindowEnd', 'asc'),
    limit(max),
  );
}

export function usersQuery(filters = {}) {
  const clauses = [];
  if (filters.role) clauses.push(where('role', '==', filters.role));
  if (filters.barangay) clauses.push(where('barangay', '==', filters.barangay));
  clauses.push(orderBy('createdAt', 'desc'));
  if (filters.max) clauses.push(limit(filters.max));
  return query(collection(db, 'users'), ...clauses);
}

export function auditLogsQuery(filters = {}) {
  if (filters.includeLegacy) return query(collection(db, 'auditLogs'));
  const clauses = [orderBy('createdAt', 'desc')];
  if (filters.max) clauses.push(limit(filters.max));
  return query(collection(db, 'auditLogs'), ...clauses);
}

/** Validated server create; caller supplies an idempotent requestId. */
export async function createDonation(payload) {
  const result = await createDonorDonation({ ...payload,
    pickupWindowStart: payload.pickupWindowStart.toISOString(),
    pickupWindowEnd: payload.pickupWindowEnd.toISOString(),
  });
  return result.donationId;
}

/** Server enforces ownership, pending-only cancellation, and an atomic audit. */
export async function cancelDonation(donationId) {
  return cancelDonorDonation(donationId);
}

export function watchDocument(path, handlers) {
  return onSnapshot(doc(db, ...path.split('/')), { includeMetadataChanges: true }, snap => handlers.next?.(snap.exists() ? { id: snap.id, ...snap.data() } : null, snap.metadata), err => handlers.error?.(classify(err)));
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB after client compression

/** Upload an image under users/{uid}/… or donations/{id}/… and return URL. */
export async function uploadImage(storagePath, blob) {
  if (!ALLOWED_IMAGE_TYPES.includes(blob.type)) {
    throw classify({ code: 'invalid-argument', message: `Unsupported type: ${blob.type}` });
  }
  if (blob.size > MAX_IMAGE_BYTES) {
    throw classify({ code: 'invalid-argument', message: 'File too large' });
  }
  try {
    const r = ref(storage, storagePath);
    await uploadBytes(r, blob, { contentType: blob.type });
    return await getDownloadURL(r);
  } catch (err) {
    throw classify(err);
  }
}

// ── Offline detection ────────────────────────────────────────────────────────

export function watchConnection(onChange) {
  const update = () => onChange(navigator.onLine);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
  return () => {
    window.removeEventListener('online', update);
    window.removeEventListener('offline', update);
  };
}

export { db };

export function notificationsQuery(uid, max = 50) {
  return query(
    collection(db, 'notifications'),
    where('recipientUid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(max),
  );
}
