import { auth } from '../core/firebaseConfig.js?v=app-admin-v1';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const signOutButton = document.getElementById('btn-signout');
const updateOnline = () => document.body.classList.toggle('offline', !navigator.onLine);

window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);
updateOnline();

signOutButton?.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = '/index.html#signin';
});

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = '/app-admin/login.html';
    return;
  }
  user.getIdTokenResult().then((token) => {
    const role = token.claims.role;
    if (role !== 'systemAdmin') window.location.href = '/register/index.html';
  });
});
