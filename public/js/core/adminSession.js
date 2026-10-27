import { fetchDoc } from './data.js';
import { signOutCurrentUser } from './auth.js';

// Pending applicants may read their own application, never operational data.
export async function loadAdminSession(session) {
  const profile = await fetchDoc(`users/${session.user.uid}`);
  const active = profile?.status === 'active' && ['lguAdmin', 'systemAdmin'].includes(profile.role);
  if (active) return true;
  const main = document.querySelector('main');
  main.replaceChildren();
  const message = document.createElement('p');
  message.setAttribute('role', 'status');
  message.textContent = profile?.status === 'rejected'
    ? 'Hindi naaprubahan ang application. Makipag-ugnayan sa system administrator.'
    : 'Pending ang authorization review. I-refresh pagkatapos ng approval.';
  const button = document.createElement('button');
  button.className = 'btn btn-primary';
  button.textContent = 'Mag-sign out';
  button.onclick = async () => { await signOutCurrentUser(); location.replace('/admin/login.html'); };
  main.append(message, button);
  document.querySelectorAll('#btn-signout').forEach(el => { el.onclick = button.onclick; });
  return false;
}
