// Service Worker for Toddler Meal Planner PWA
const CACHE_NAME = 'littlebowl-v4';
const STATIC_URLS = [
  '/static/css/style.css',
  '/static/js/app.js',
  '/static/js/a2hs-prompt.js',
  '/static/manifest.json',
  '/static/icons/icon-192.png'
];

// Install event - cache static assets only (never HTML pages)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_URLS))
      .catch(err => console.log('Cache install error:', err))
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for pages/API so onboarding & dashboard never stick on stale HTML
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') {
    return;
  }

  const url = new URL(req.url);

  // Always network for API
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req).catch(() => new Response(
        JSON.stringify({ error: 'You are offline. Please check your connection.' }),
        { headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  // Navigations / HTML: network-first, do not cache
  const isNavigate = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isNavigate) {
    event.respondWith(
      fetch(req).catch(() => caches.match('/') || caches.match('/static/js/app.js'))
    );
    return;
  }

  // Static assets: cache-first with network update
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener('sync', event => {
  if (event.tag === 'sync-meals') {
    event.waitUntil(Promise.resolve());
  }
});

self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'Time to log a meal!',
    icon: '/static/icons/icon-192.png',
    badge: '/static/icons/icon-72.png',
    vibrate: [100, 50, 100],
    data: { dateOfArrival: Date.now(), primaryKey: 1 },
    actions: [
      { action: 'log', title: 'Log Meal' },
      { action: 'close', title: 'Dismiss' }
    ]
  };
  event.waitUntil(self.registration.showNotification('LittleBowl', options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'log') {
    event.waitUntil(clients.openWindow('/'));
  }
});
