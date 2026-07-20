/* LittleBowl Admin PWA service worker — scope /admin */
const CACHE = 'littlebowl-admin-v2';
const PRECACHE = [
  '/static/css/style.css',
  '/static/css/admin.css',
  '/static/js/admin-dashboard.js',
  '/static/js/admin-content.js',
  '/static/js/a2hs-admin-prompt.js',
  '/static/manifest-admin.json',
  '/static/icons/icon-192.png',
  '/static/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;

  // Always network for admin HTML + APIs (fresh login/session)
  if (url.pathname.startsWith('/api/') || req.mode === 'navigate' || url.pathname.startsWith('/admin')) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  if (url.pathname.startsWith('/static/')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => null);
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
  }
});
