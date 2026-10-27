// public/js/core/offline.js — re-export of the single connection watcher.
// Offline detection lives in data.js (watchConnection); this module keeps the
// PROD.MD /core import surface stable: `import { ... } from './offline.js'`.
export { watchConnection, watchConnection as watchOnline } from './data.js';

export function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

