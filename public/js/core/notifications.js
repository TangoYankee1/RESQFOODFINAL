// public/js/core/notifications.js
// In-app notification helpers. Reads go through core/data.js; writes are
// server-only (Cloud Function sendNotification). No direct Firestore writes.
import { watchQuery, notificationsQuery } from './data.js';
import { handleError } from './errors.js';

/** Subscribe to my notifications → { next(list), error(err) }. */
export function watchMyNotifications(uid, handlers) {
  try {
    return watchQuery(notificationsQuery(uid), handlers);
  } catch (err) {
    handlers.error && handlers.error(handleError(err, { scope: 'notifications.watch' }).raw);
    return () => {};
  }
}

