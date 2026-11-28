// ============================================================
// WeatherIQ — Service Worker
// Caches app shell and provides offline fallback.
// ============================================================

const CACHE_NAME   = 'weatheriq-v2.7';
const SHELL_ASSETS = [
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
  './images/icons/icon-192.png',
  './images/icons/icon-512.png',
  './images/icons/icon-maskable-512.png',
  './images/icons/temperature.png',
  './images/icons/wind_speed.png',
  './images/icons/rainfall.png',
  './images/icons/aqi.png',
  './images/icons/air_quality.png',
  './images/icons/uv_index.png',
  './images/icons/air_pressure.png',
  './images/icons/visibility.png',
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
  if (event.request.method !== 'GET') return;

  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Skip /api/ routes and third-party APIs/CDNs — always network only (never cache live telemetry)
  if (
    url.pathname === '/api' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/api/') ||
    url.hostname.includes('open-meteo.com') ||
    url.hostname.includes('openweather') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('unpkg.com')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request, { ignoreSearch: true }).then(cached => {
          if (cached) return cached;
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
    console.log('[SW] Background sync triggered');
  }
});
