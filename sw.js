const CACHE_NAME = 'bhatkhande-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './app.html',
  './layakari.html',
  './manifest.json',
  './css/styles.css',
  './css/layakari.css',
  './js/app.js',
  './js/bol-input.js',
  './js/composition.js',
  './js/layakari-app.js',
  './js/layakari-core.js',
  './js/library-data.js',
  './js/notation-grid.js',
  './js/pdf-export.js',
  './js/pdf-import.js',
  './js/taal-data.js',
  './assets/icons/icon-192x192.svg',
  './assets/icons/icon-512x512.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});
