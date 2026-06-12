const CACHE_NAME = "rpt-product-search-auto-v8";
const ASSETS = ["./","./index.html?v=7","./manifest.json?v=7","./icons/icon-180.png?v=7","./icons/icon-192.png?v=7","./icons/icon-512.png?v=7"];
self.addEventListener("install", event => {event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))); self.skipWaiting();});
self.addEventListener("activate", event => {event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))); self.clients.claim();});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (url.pathname.endsWith("/products.json")) {
    event.respondWith(fetch(event.request,{cache:"no-store"}).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
