// public/js/core/analytics.js
// Privacy-respecting event logging (RA 10173 minimization):
//  - no names, phone numbers, addresses, or any PII ever leaves this module
//  - events are coarse product actions only
//  - disabled until the user has a recorded consent (see consent gate below)
// Events go to console sink in dev; in production set
// window.__RESQFOOD_ANALYTICS_SINK__ = (events) => ... (e.g. Firebase
// Performance/Analytics wrapper) at deploy time.

import { config } from './config.js';

const ALLOWED_EVENTS = new Set([
  'page_view', 'login', 'logout', 'registration_started', 'registration_completed',
  'donation_created', 'mission_claimed', 'status_transition', 'qr_verified',
  'pin_verified', 'verify_failed', 'export_csv', 'error', 'otp_sent', 'otp_verified',
]);

const PII_PATTERN = /\+?\d{9,11}|\b09\d{9}\b|@[\w.]+/; // phone/email guard

let consented = false;
const queue = [];

function sink(events) {
  if (typeof window !== 'undefined' && typeof window.__RESQFOOD_ANALYTICS_SINK__ === 'function') {
    window.__RESQFOOD_ANALYTICS_SINK__(events);
  } else if (config.env !== 'production') {
    console.debug('[analytics]', events);
  }
}

function assertNoPii(payload) {
  const flat = JSON.stringify(payload || {});
  if (PII_PATTERN.test(flat)) {
    console.warn('[analytics] dropped event containing possible PII');
    return false;
  }
  return true;
}

export const analytics = {
  /** Called once a consent record exists for this user (registration.js). */
  grantConsent() {
    consented = true;
    if (queue.length) {
      sink(queue.splice(0));
    }
  },

  /** Track a coarse product event. Never pass user identifiers. */
  track(name, payload = {}) {
    if (!config.features.analytics) return;
    if (!ALLOWED_EVENTS.has(name)) {
      console.warn(`[analytics] unknown event "${name}" ignored`);
      return;
    }
    if (!assertNoPii(payload)) return;
    const event = {
      name,
      payload,
      ts: new Date().toISOString(),
      locale: typeof navigator !== 'undefined' ? navigator.language : 'tl',
      env: config.env,
    };
    if (!consented) {
      queue.push(event);
      if (queue.length > 50) queue.shift();
      return;
    }
    sink([event]);
  },
};

if (typeof window !== 'undefined') window.__RESQFOOD_ANALYTICS__ = analytics;
