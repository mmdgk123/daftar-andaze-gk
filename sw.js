/* کش نگه‌داشتن برنامه برای استفاده‌ی آفلاین */

const CACHE = 'kanaf-v3-1';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icon.svg',
  './js/app.js',
  './js/store.js',
  './js/util.js',
  './js/geometry.js',
  './js/render.js',
  './js/ui.js',
  './js/list.js',
  './js/sheet.js',
  './fonts/Vazirmatn.woff2'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(ASSETS.map(url => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== location.origin) return;

  event.respondWith((async () => {
    try {
      /* اول شبکه تا نسخه‌ی تازه همیشه بیاید، بعد کش برای حالت آفلاین */
      const res = await fetch(req);
      if (res && res.ok){
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    } catch (e) {
      const cached = await caches.match(req);
      if (cached) return cached;
      const fallback = await caches.match('./index.html');
      return fallback || Response.error();
    }
  })());
});
