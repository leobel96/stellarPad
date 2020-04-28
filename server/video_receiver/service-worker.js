var cacheName = "StellarPad6";
var contentToCache = [
  "/",
  "/index.html",
  "/css/style.css",
  "/js/main.js",
  "/images/PWA-icons/icon-72x72.png",
  "/images/PWA-icons/icon-96x96.png",
  "/images/PWA-icons/icon-128x128.png",
  "/images/PWA-icons/icon-144x144.png",
  "/images/PWA-icons/icon-152x152.png",
  "/images/PWA-icons/icon-192x192.png",
  "/images/PWA-icons/icon-384x384.png",
  "/images/PWA-icons/icon-512x512.png",
  "/images/PWA-icons/maskable_icon196x196.png"
];

self.addEventListener("install", e => {
  console.log("[Service Worker] Install");
  e.waitUntil(
    caches.open(cacheName).then(cache => {
      console.log("[Service Worker] Caching all: app shell and content");
      return cache.addAll(contentToCache);
    })
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(r => {
      return (
        r ||
        fetch(e.request).then(response => {
          return caches.open(cacheName).then(cache => {
            cache.put(e.request, response.clone());
            return response;
          });
        })
      );
    })
  );
});

self.addEventListener('message', function (event) {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== cacheName) {
          return }
      }));
    })
  );
});