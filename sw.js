// ============================================================
// WeatherIQ — Service Worker
// Caches app shell and provides offline fallback.
// ============================================================

const CACHE_NAME    = 'weatheriq-v2.2';
const SHELL_ASSETS  = [
  './',
  './index.html',
  './css/style.css',
  './css/animations.css',
  './js/lucide.js',
  './js/mock-data.js',
  './js/charts.js',
  './js/api.js',
  './js/app.js',
  './js/features/notifications.js',
  './js/features/export.js',
  './js/features/pwa.js',
  './manifest.json',
];

// ── Install: cache app shell ──────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(SHELL_ASSETS).catch(err => {
        // Non-fatal: continue even if some assets fail
        console.warn('[SW] Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first with cache fallback ──────────────────
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip API calls — always network only (don't cache live data)
  if (event.request.url.includes('localhost:8000') ||
      event.request.url.includes('api.openweather') ||
      event.request.url.includes('fonts.googleapis') ||
      event.request.url.includes('unpkg.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline: serve from cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Last resort: serve index.html for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});

// ── Background sync (placeholder for future) ─────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-sensor-data') {
    // Future: sync buffered readings when back online
    console.log('[SW] Background sync triggered');
  }
});
