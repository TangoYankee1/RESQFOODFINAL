// public/js/core/i18n.js
// Single i18n layer. Tagalog (tl) is the default locale; English (en) exists
// for developer/reference use. No user-facing string may be hardcoded in
// feature modules — call t('key') instead.

import { config } from './config.js';

const STRINGS = {
  tl: {
    'common.loading': 'Sine-load…',
    'common.retry': 'Subukan muli',
    'common.cancel': 'Kanselahin',
    'common.confirm': 'Kumpirmahin',
    'common.save': 'I-save',
    'common.error': 'Nagkaroon ng problema.',
    'common.offline': 'Offline ka ngayon. Ilang features ay hindi available.',
    'common.online': 'Bumalik ang koneksyon.',
    'common.signOut': 'Mag-sign out',
    'common.required': 'Kailangan ang field na ito.',
    'common.emptyState': 'Wala pang laman.',
    'auth.loginRequired': 'Kailangan mong mag-sign in bago magpatuloy.',
    'auth.wrongRole': 'Wala kang access sa pahinang ito.',
    'auth.suspended': 'Nasuspen ang iyong account. Makipag-ugnayan sa admin.',
    'auth.noRole': 'Wala ka pang naatasang role. Hintayin ang approval ng admin.',
    'auth.otpInvalid': 'Hindi valid ang code. Subukan muli.',
    'auth.otpExpired': 'Nag-expire na ang code. Mag-request ng bago.',
    'auth.otpLocked': 'Masyadong maling pagkakasunod-sunod. Maghintay bago subukan ulit.',
    'auth.otpSent': 'Naipadala ang OTP sa iyong numero.',
    'auth.otpResend': 'Magpadala ulit',
    'auth.otpExpiresIn': 'Mag-expire sa {s}s',
    'verify.valid': '✓ Valid na Delivery',
    'verify.invalid': '✕ Hindi Valid',
    'verify.pending': 'Sinusuri ang QR sa server…',
    'verify.serverUnreachable': 'Hindi ma-verify offline. Kailangan ng koneksyon.',
    'verify.pinInvalid': 'Maling PIN. Subukan muli o humingi ng bagong PIN sa donor.',
    'verify.pinExpired': 'Nag-expire ang PIN. Humingi ng bago sa donor/volunteer.',
    'verify.pinUsed': 'Nagamit na ang PIN na ito dati.',
    'verify.pinLocked': 'Masyadong maling PIN. Naka-lock na — humingi ng bago.',
    'verify.replayed': 'Nagamit na ang QR na ito dati.',
    'verify.signatureBad': 'Hindi tamang lagda ang QR na ito.',
    'verify.qrExpired': 'Nag-expire na ang QR code. Humingi ng bago sa donor.',
    'verify.qrCancelled': 'Nakansela ang donation na ito.',
    'verify.qrNotFound': 'Hindi mahanap ang donation na ito.',
    'verify.qrUnsupported': 'Hindi suportado ang format ng QR na ito.',
    'reg.step': 'Hakbang {n} sa {total}',
    'reg.recovery': 'Nagkaroon ng problema sa pagsave. Pindutin para subukan muli.',
    'error.network': 'Hindi ma-abot ang server. I-check ang iyong koneksyon.',
    'error.permission': 'Hindi ka awtorisado para dito.',
    'error.notFound': 'Hindi mahanap ang hinahanap mo.',
    'error.rateLimited': 'Masyadong mabilis ang mga request. Maghintay ng ilang segundo.',
    'error.unknown': 'Inaasahang error. Subukan muli.',
  },
  en: {
    'common.loading': 'Loading…',
    'common.retry': 'Retry',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.save': 'Save',
    'common.error': 'Something went wrong.',
    'common.offline': 'You are offline. Some features are unavailable.',
    'common.online': 'Connection restored.',
    'common.signOut': 'Sign out',
    'common.required': 'This field is required.',
    'common.emptyState': 'Nothing here yet.',
    'auth.loginRequired': 'Please sign in to continue.',
    'auth.wrongRole': 'You do not have access to this page.',
    'auth.suspended': 'Your account is suspended. Contact an admin.',
    'auth.noRole': 'You have no assigned role yet. Wait for admin approval.',
    'auth.otpInvalid': 'Invalid code. Try again.',
    'auth.otpExpired': 'Code expired. Request a new one.',
    'auth.otpLocked': 'Too many wrong attempts. Wait before trying again.',
    'auth.otpSent': 'OTP sent to your number.',
    'auth.otpResend': 'Resend',
    'auth.otpExpiresIn': 'Expires in {s}s',
    'verify.valid': '✓ Valid Delivery',
    'verify.invalid': '✕ Invalid',
    'verify.pending': 'Verifying QR with server…',
    'verify.serverUnreachable': 'Cannot verify while offline. Connection required.',
    'verify.pinInvalid': 'Wrong PIN. Try again or ask the volunteer for a new one.',
    'verify.pinExpired': 'PIN expired. Ask the donor/volunteer for a new one.',
    'verify.pinUsed': 'This PIN was already used.',
    'verify.pinLocked': 'Too many wrong PINs. Locked — ask for a new one.',
    'verify.replayed': 'This QR was already used.',
    'verify.signatureBad': 'This QR has an invalid signature.',
    'verify.qrExpired': 'This QR code has expired. Ask the donor for a new one.',
    'verify.qrCancelled': 'This donation was cancelled.',
    'verify.qrNotFound': 'This donation could not be found.',
    'verify.qrUnsupported': 'This QR format is not supported.',
    'reg.step': 'Step {n} of {total}',
    'reg.recovery': 'Saving failed. Press to retry.',
    'error.network': 'Cannot reach the server. Check your connection.',
    'error.permission': 'You are not authorized for this.',
    'error.notFound': 'What you asked for was not found.',
    'error.rateLimited': 'Too many requests. Wait a few seconds.',
    'error.unknown': 'Unexpected error. Please retry.',
  },
};

let current = config.defaultLocale;

export function setLocale(locale) {
  if (STRINGS[locale]) current = locale;
}

export function getLocale() {
  return current;
}

/** Translate a key. `{name}` placeholders are replaced from params. */
export function t(key, params = {}) {
  const table = STRINGS[current] || STRINGS[config.defaultLocale];
  let text = table[key] ?? STRINGS[config.defaultLocale][key] ?? key;
  for (const [name, value] of Object.entries(params)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

/** Auto-detect locale from browser on first load (Tagalog-first defaults). */
export function initLocale() {
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'tl').toLowerCase();
  setLocale(nav.startsWith('en') ? 'en' : 'tl');
}
