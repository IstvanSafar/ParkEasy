// ParkEasy Service Worker — offline mukodes.
// Statikus assetek: cache-first. Zonaadat: network-first (frissulhet).

const CACHE_NAME = 'parkeasy-v10';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/app.js',
  './js/geo.js',
  './js/map.js',
  './js/notifications.js',
  './js/parking.js',
  './js/settings.js',
  './js/sms.js',
  './js/storage.js',
  './js/zones.js',
  './data/zones.geojson',
  './data/config.json',
  './vendor/bootstrap.min.css',
  './vendor/bootstrap.bundle.min.js',
  './vendor/leaflet.css',
  './vendor/leaflet.js',
  './vendor/images/marker-icon.png',
  './vendor/images/marker-icon-2x.png',
  './vendor/images/marker-shadow.png',
  './vendor/images/layers.png',
  './vendor/images/layers-2x.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // OSM csempeket es mas kulso keresek nem cache-eljuk
  if (url.origin !== location.origin) return;

  // zonaadat: network-first, hogy frissulhessen; offline a cache-elt valtozat
  if (url.pathname.endsWith('zones.geojson')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // minden mas sajat asset: cache-first
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true })
      .then((cached) => cached || fetch(event.request))
  );
});
