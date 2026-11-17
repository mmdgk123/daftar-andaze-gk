const CACHE = 'daftar-andaze-v18';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    /* خودترمیمی: اگه کش خالی یا ناقص شده بود، دوباره پرش کن */
    try {
      const c = await caches.open(CACHE);
      if (!(await c.match('./index.html'))) await c.addAll(ASSETS);
    } catch (err) {}
    await self.clients.claim();
  })());
});

/* network-first: همیشه تازه‌ترین نسخه، آفلاین از کش */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith((async () => {
    try {
      const res = await fetch(e.request);
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    } catch (err) {
      const hit = await caches.match(e.request, { ignoreSearch: true });
      if (hit) return hit;
      /* باز شدن برنامه: هر طور شده پوسته‌ی ذخیره‌شده رو بده */
      if (e.request.mode === 'navigate') {
        const shell = (await caches.match('./index.html', { ignoreSearch: true })) ||
                      (await caches.match('./', { ignoreSearch: true }));
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
