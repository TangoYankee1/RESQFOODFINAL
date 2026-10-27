import { sendOTP, confirmOTP, consumeIntent, signOutCurrentUser } from '../core/auth.js';
import { fetchDoc } from '../core/data.js';
import { isLocalDev } from '../core/firebaseConfig.js';

const phone = document.getElementById('login-phone'), code = document.getElementById('login-code');
const send = document.getElementById('login-send'), confirm = document.getElementById('login-confirm');
const message = document.getElementById('login-message');
let pending, cooldown;
send.addEventListener('click', async () => {
  send.disabled = true; confirm.disabled = true;
  try {
    pending = await sendOTP(phone.value, 'recaptcha-container');
    message.textContent = isLocalDev ? 'Tingnan ang OTP sa emulator terminal. Walang SMS na ipinadala.' : 'Ilagay ang OTP.';
    confirm.disabled = false; phone.disabled = true; code.focus();
    cooldown = setTimeout(() => { send.disabled = false; send.textContent = 'Kunin ang Bagong OTP'; }, 60000);
  } catch (error) {
    message.textContent = error.code === 'auth/invalid-phone-number' ? 'Maglagay ng valid na Philippine mobile number.' : 'Hindi makuha ang OTP. Subukan muli.';
    send.disabled = false;
  }
});
document.getElementById('volunteer-login-form').addEventListener('submit', async event => {
  event.preventDefault(); if (!pending || confirm.disabled) return;
  confirm.disabled = true;
  try {
    const signed = await confirmOTP(pending, code.value);
    const profile = await fetchDoc(`users/${signed.user.uid}`);
    if (!profile || profile.role !== 'volunteer' || profile.status === 'suspended') {
      await signOutCurrentUser(); pending = null; phone.disabled = false; send.disabled = false; clearTimeout(cooldown);
      message.textContent = profile?.status === 'suspended' ? 'Naka-suspend ang account. Makipag-ugnayan sa admin.' : 'Walang volunteer account sa numerong ito. Magrehistro o piliin ang tamang role.';
      return;
    }
    await signed.user.getIdToken(true);
    const queryNext = new URLSearchParams(location.search).get('next');
    const savedNext = consumeIntent('/volunteer/index.html');
    const target = new URL(queryNext || savedNext, location.origin);
    location.replace(target.origin === location.origin && target.pathname.startsWith('/volunteer/') && !target.pathname.startsWith('/volunteer/login')
      ? target.pathname + target.search + target.hash : '/volunteer/index.html');
  } catch (error) {
    message.textContent = error.code === 'auth/code-expired' ? 'Expired ang OTP. Kumuha ng bagong code.'
      : error.code === 'auth/too-many-requests' ? 'Naabot ang attempt limit. Kumuha ng bagong code pagkaraan ng cooldown.' : 'Hindi ma-sign in. Suriin ang code o subukan muli.';
    confirm.disabled = false;
  }
});
window.addEventListener('pagehide', () => clearTimeout(cooldown), { once: true });
