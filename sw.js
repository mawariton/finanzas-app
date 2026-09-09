const CACHE_NAME = 'finanzas-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/db.js',
  '/js/gold.js',
  '/js/budget.js',
  '/js/csv.js',
  '/js/charts.js',
  '/js/income.js',
  '/js/expenses.js',
  '/js/investments.js',
  '/js/loans.js',
  '/js/dashboard.js',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-cuarzo.png',
  '/icons/icon-esmeralda.png',
  '/icons/icon-zafiro.png'
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
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});