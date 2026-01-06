const CACHE_NAME = "pwa-cache-v1";

// Add all your app shell files here
const ASSETS_TO_CACHE = [
  "/",               // index.html
  "/index.html",
  "/offline.html",
  "/manifest.json",
  "/logo192.png",
  "/logo512.png",
  "/favicon.ico",
];

// Install Service Worker
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching files");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Service Worker
self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activated");

  event.waitUntil(
    caches.keys().then((keyList) =>
      Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Removing old cache", key);
            return caches.delete(key);
          }
        })
      )
    )
  );

  self.clients.claim();
});

// Fetch Handler
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached response if available
      if (cachedResponse) {
        return cachedResponse;
      }

      // Else fetch from network
      return fetch(event.request)
        .then((networkResponse) => {
          // Save a copy in the cache
          return caches.open(CACHE_NAME).then((cache) => {
            // Only cache GET requests
            if (event.request.method === "GET") {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
        })
        .catch(() => {
          // Fallback for offline (only for pages)
          if (event.request.destination === "document") {
            return caches.match("/offline.html");
          }
        });
    })
  );
});
