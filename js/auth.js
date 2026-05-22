import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { auth, db } from './firebase-config.js';

const USERS = 'users';

let currentUser = null;
let currentProfile = null;
const listeners = new Set();

let authReadyResolve;
export const authReady = new Promise((resolve) => {
  authReadyResolve = resolve;
});

function notify() {
  listeners.forEach((fn) => fn(currentUser, currentProfile));
}

export function onAuthChange(callback) {
  listeners.add(callback);
  callback(currentUser, currentProfile);
  return () => listeners.delete(callback);
}

export function getCurrentUser() {
  return currentUser;
}

export function getProfile() {
  return currentProfile;
}

export function normalizeRole(role) {
  const r = (role || '').toLowerCase();
  if (r === 'donor') return 'donor';
  if (r === 'volunteer') return 'volunteer';
  if (r === 'beneficiary') return 'org-admin';
  if (r.includes('lgu')) return 'lgu-admin';
  if (r === 'admin') return 'lgu-admin';
  return null;
}

export function getRoleViewId(role) {
  return normalizeRole(role);
}

export function hasRole(...roles) {
  const profile = getProfile();
  if (!profile) return false;
  const normalized = normalizeRole(profile.role);
  return roles.some((r) => normalizeRole(r) === normalized || profile.role === r);
}

async function loadProfile(uid) {
  const snap = await getDoc(doc(db, USERS, uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function register(name, email, password, role) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const profile = {
    name,
    email,
    role,
    onboardingComplete: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, USERS, cred.user.uid), profile);
  currentProfile = { id: cred.user.uid, ...profile };
  return currentProfile;
}

export async function login(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  await signOut(auth);
}

export async function updateProfile(uid, data) {
  await setDoc(
    doc(db, USERS, uid),
    { ...data, onboardingComplete: true, updatedAt: serverTimestamp() },
    { merge: true }
  );
  currentProfile = await loadProfile(uid);
  notify();
  return currentProfile;
}

export function mapAuthError(err) {
  const map = {
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/invalid-email': 'Please enter a valid email.',
    'auth/weak-password': 'Password must be at least 8 characters.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
  };
  return map[err?.code] || err.message || 'Authentication failed.';
}

let firstAuthEvent = true;

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  currentProfile = user ? await loadProfile(user.uid) : null;
  notify();
  if (firstAuthEvent) {
    firstAuthEvent = false;
    authReadyResolve();
  }
});
