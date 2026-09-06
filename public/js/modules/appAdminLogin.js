import { auth } from '../core/firebaseConfig.js?v=app-admin-login-v1';
import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const $ = (id) => document.getElementById(id);
const updateOnline = () => document.body.classList.toggle('offline', !navigator.onLine);
window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);
updateOnline();

$('admin-login-button')?.addEventListener('click', async () => {
  const username = $('admin-email').value.trim();
  const email = username.includes('@') ? username : `${username}@resqfood.local`;
  const password = $('admin-password').value;
  $('admin-login-error').classList.remove('visible');
  $('admin-login-button').disabled = true;

  if (!email || !password) {
    $('admin-login-error').textContent = 'Ilagay ang email at password.';
    $('admin-login-error').classList.add('visible');
    $('admin-login-button').disabled = false;
    return;
  }

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const token = await credential.user.getIdTokenResult(true);
    if (token.claims.role !== 'systemAdmin') {
      await auth.signOut();
      throw new Error('not_system_admin');
    }
    window.location.href = '/app-admin/index.html';
  } catch (error) {
    console.error('App Admin login failed', error);
    $('admin-login-error').textContent = error.message === 'not_system_admin'
      ? 'Ang account na ito ay hindi App Admin.'
      : 'Hindi valid ang local App Admin credentials.';
    $('admin-login-error').classList.add('visible');
    $('admin-login-button').disabled = false;
  }
});
