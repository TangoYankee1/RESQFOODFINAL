import { sendOTP, confirmOTP, consumeIntent, signOutCurrentUser } from '../core/auth.js';
import { fetchDoc } from '../core/data.js';
import { isLocalDev } from '../core/firebaseConfig.js';

const phone = document.getElementById('login-phone'), code = document.getElementById('login-code');
const send = document.getElementById('login-send'), confirm = document.getElementById('login-confirm');
const message = document.getElementById('login-message');
let pending, cooldown, busy = false;
const digits = [...document.querySelectorAll('.otp-input')];
function syncCode() {
  code.value = digits.map(input => input.value).join('');
  confirm.disabled = busy || !pending || !/^\d{6}$/.test(code.value);
}
digits.forEach((input,index) => {
  input.setAttribute('aria-label', 'Digit '+(index+1)+' ng 6-digit code');
  input.autocomplete = index === 0 ? 'one-time-code' : 'off';
  input.addEventListener('input', () => {
    input.value=input.value.replace(/\D/g,'').slice(-1);
    if(input.value && index<5) digits[index+1].focus();
    syncCode();
  });
  input.addEventListener('keydown', event => { if(event.key==='Backspace' && !input.value && index>0) digits[index-1].focus(); });
  input.addEventListener('paste', event => {
    const pasted=event.clipboardData.getData('text').replace(/\D/g,'').slice(0,6);
    if(!pasted)return;
    event.preventDefault();digits.forEach((digit,i)=>digit.value=pasted[i]||'');syncCode();digits[Math.min(pasted.length,5)].focus();
  });
});
document.getElementById('login-otp-section').hidden = true;
send.disabled = false;
document.documentElement.dataset.loginReady = '1';
send.addEventListener('click', async () => {
  if(busy)return;
  busy=true; pending=null; clearTimeout(cooldown);
  digits.forEach(input=>input.value=''); syncCode();
  send.textContent='Ipinapadala ang Code…';
  message.textContent='Ipinapadala ang verification code…';
  send.disabled = true; confirm.disabled = true;
  try {
    pending = await sendOTP(phone.value, 'recaptcha-container');
    message.textContent = isLocalDev ? 'Tingnan ang OTP sa emulator terminal. Walang SMS na ipinadala.' : 'Ilagay ang OTP.';
    phone.disabled = true;
    document.getElementById('login-otp-section').hidden = false;
    document.getElementById('login-otp-phone').textContent = phone.value;
    digits[0].focus();
    send.textContent='Magpadala ulit pagkatapos ng 60 segundo';
    cooldown = setTimeout(() => { cooldown=null; send.disabled = busy; send.textContent = 'Kunin ang Bagong OTP'; }, 60000);
  } catch (error) {
    message.textContent = error.code === 'auth/invalid-phone-number' ? 'Maglagay ng valid na Philippine mobile number.' : 'Hindi makuha ang OTP. Subukan muli.';
    send.disabled = false; send.textContent='Magpadala ng Code';
  } finally { busy=false; syncCode(); }
});
document.getElementById('volunteer-login-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy || !pending || confirm.disabled) return;
  busy=true; confirm.textContent='Nagsa-sign in…'; send.disabled=true;
  confirm.disabled = true;
  try {
    const signed = await confirmOTP(pending, code.value);
    const profile = await fetchDoc(`users/${signed.user.uid}`);
    if (!profile || profile.role !== 'volunteer' || profile.status === 'suspended') {
      await signOutCurrentUser(); pending = null; phone.disabled = false; send.disabled = false; clearTimeout(cooldown); cooldown=null;
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
  } finally {
    busy=false; syncCode(); confirm.textContent='Mag-sign In';
    send.disabled=Boolean(cooldown);
    if(!pending)send.textContent='Magpadala ng Code';
  }
});
window.addEventListener('pagehide', () => clearTimeout(cooldown), { once: true });
