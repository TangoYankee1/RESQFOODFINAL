const CACHE_NAME = 'resqfood-v3';
const PRECACHE = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/router.js',
  '/js/firebase-config.js',
  '/js/auth.js',
  '/js/utils.js',
  '/js/donor.js',
  '/js/volunteer.js',
  '/js/org-admin.js',
  '/js/lgu-admin.js',
  '/js/qr-generator.js',
  '/js/qr-scanner.js',
  '/js/notifications.js',
  '/manifest.json',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin.includes('firestore.googleapis.com') || url.origin.includes('firebase.googleapis.com')) {
    return;
  }

  if (url.origin.includes('gstatic.com') || url.origin.includes('cdnjs') || url.origin.includes('jsdelivr')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  if (request.method !== 'GET') return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request).then((r) => r || caches.match('/index.html')))
  );
});
