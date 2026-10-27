// public/js/core/config.js
// Env-driven configuration. No secrets live here — Firebase web config is
// public-by-design (guarded by Firestore/Storage rules + App Check), and all
// server secrets (QR HMAC key, SMS provider keys) live in Cloud Functions
// runtime config only. Values are injected at deploy time via
// window.__RESQFOOD_ENV__ (see docs/OPERATIONS.md §Environments).

const injected = (typeof window !== 'undefined' && window.__RESQFOOD_ENV__) || {};

const defaults = {
  env: 'production',              // 'production' | 'staging' | 'development'
  apiUrl: '',                     // reserved for future external integrations
  otp: {
    codeLength: 6,
    maxAttempts: 3,               // lockout after 3 wrong codes
    ttlSeconds: 300,              // 5-minute code window (client display/lock)
    resendCooldownSeconds: 60,
  },
  pin: {
    ttlSeconds: 900,              // 15-minute single-use PIN (server-enforced)
    length: 4,
  },
  qr: {
    schemaVersion: 2,
    maxAgeSeconds: 86400,         // signed payload hard expiry
  },
  consent: {
    version: 'v1-2026-10',        // bump whenever consent text changes
    textPath: '/legal/consent-v1-2026-10.txt',
  },
  locales: ['tl', 'en'],
  defaultLocale: 'tl',            // Tagalog-first product requirement
  features: {
    analytics: true,              // still PII-free; see analytics.js
    offlineBanner: true,
  },
  retention: {
    auditLogDays: 3650,           // 10 years — audit must outlive accounts
    notificationDays: 90,
    qrNonceDays: 30,
  },
};

function deepMerge(base, override) {
  const out = { ...base };
  for (const [k, v] of Object.entries(override || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof base[k] === 'object'
      ? deepMerge(base[k], v)
      : v;
  }
  return out;
}

export const config = deepMerge(defaults, injected);

/** True only when explicitly set to development/staging. Production default. */
export const isDev = config.env !== 'production';

/** Throws if a required deploy-time value is missing (fail fast, not silent). */
export function requireConfig(keyPath) {
  const value = keyPath.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), config);
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required config: ${keyPath}`);
  }
  return value;
}
