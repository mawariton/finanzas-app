const CACHE_NAME = 'finanzas-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/db.js',
  '/js/gold.js',
  '/js/income.js',
  '/js/expenses.js',
  '/js/investments.js',
  '/js/loans.js',
  '/js/charts.js',
  '/js/app.js',
  '/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
