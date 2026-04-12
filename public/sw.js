// TFT Clash Service Worker — offline shell caching
var CACHE_NAME = 'tftclash-v1';
var SHELL_URLS = [
  '/',
  '/manifest.json',
  '/icon.png',
  '/icon-border.png',
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(SHELL_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
          .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // Only cache same-origin GET requests
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Network-first for API and Supabase calls
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/rest') || url.pathname.startsWith('/auth')) return;

  // For navigation requests (HTML pages), try network first, fall back to cached shell
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(function() {
        return caches.match('/');
      })
    );
    return;
  }

  // For static assets: cache-first, network fallback
  if (url.pathname.match(/\.(js|css|png|jpg|svg|woff2?|ttf)$/)) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        return fetch(event.request).then(function(response) {
          if (response.ok) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
      })
    );
    return;
  }
});
