/* Service worker for the Riftbound Table Companion.
   Strategy: network-first for the app shell (so deploys land on next open,
   falling back to cache when offline at the table), cache-first for card
   art from the image CDNs (immutable content, capped to keep quota sane). */

var SHELL_CACHE = 'rb-companion-shell-v2';
var ART_CACHE = 'rb-companion-art-v1';
var ART_LIMIT = 400;
var SHELL_URLS = ['/riftbound/companion.html', '/riftbound/companion.webmanifest'];
var ART_HOSTS = ['cmsassets.rgpub.io', 'cdn.riftscribe.gg', 'assetcdn.rgpub.io'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SHELL_CACHE).then(function (c) { return c.addAll(SHELL_URLS); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k !== SHELL_CACHE && k !== ART_CACHE && k.indexOf('rb-companion-') === 0;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function trimCache(name, max) {
  return caches.open(name).then(function (c) {
    return c.keys().then(function (keys) {
      if (keys.length <= max) return undefined;
      return c.delete(keys[0]).then(function () { return trimCache(name, max); });
    });
  });
}

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);

  // Card art: cache-first with a size cap; failures never break the page
  // (the app has embedded blur placeholders as its offline art fallback).
  if (ART_HOSTS.indexOf(url.hostname) !== -1) {
    e.respondWith(
      caches.open(ART_CACHE).then(function (c) {
        return c.match(e.request).then(function (hit) {
          if (hit) return hit;
          return fetch(e.request).then(function (res) {
            if (res && (res.ok || res.type === 'opaque')) {
              c.put(e.request, res.clone()).then(function () { return trimCache(ART_CACHE, ART_LIMIT); }).catch(function () {});
            }
            return res;
          });
        });
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navigations under our scope: network-first, cached shell when offline.
  // Matching on request mode (not exact URL) keeps query strings working.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(function (res) {
        if (res && res.ok && SHELL_URLS.indexOf(url.pathname) !== -1) {
          var copy = res.clone();
          caches.open(SHELL_CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match('/riftbound/companion.html');
      })
    );
    return;
  }

  // Non-navigation shell assets (manifest): network-first with cache fallback.
  if (SHELL_URLS.indexOf(url.pathname) !== -1) {
    e.respondWith(
      fetch(e.request).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(SHELL_CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(e.request);
      })
    );
  }
});
