var cacheName = "StellarPad";
var contentToCache = [
    "/",
    "/index.html",
    "/images/PWA-icons/icon-72x72.png",
    "/images/PWA-icons/icon-96x96.png",
    "/images/PWA-icons/icon-128x128.png",
    "/images/PWA-icons/icon-144x144.png",
    "/images/PWA-icons/icon-152x152.png",
    "/images/PWA-icons/icon-192x192.png",
    "/images/PWA-icons/icon-384x384.png",
    "/images/PWA-icons/icon-512x512.png",
    "/images/PWA-icons/maskable_icon196x196.png",
    "/css/style.css",
    "/js/main.js"
];

self.addEventListener('install', function(e) {
    console.log('[Service Worker] Install');
    e.waitUntil(
      caches.open(cacheName).then(function(cache) {
        console.log('[Service Worker] Caching all: app shell and content');
        return cache.addAll(contentToCache);
      })
    );
  });

self.addEventListener('fetch', function(e) {
    e.respondWith(
      caches.match(e.request).then(function(r) {
        return r || fetch(e.request).then(function(response) {
          return caches.open(cacheName).then(function(cache) {
            cache.put(e.request, response.clone());
            return response;
          });
        });
      })
    );
  });