/* ============================================================
   Service Worker — معهد سبيطلة 2 | التوزيع البيداغوجي
   الإصدار: 1.0.0
   الوظيفة: تخزين مؤقت شامل لتشغيل التطبيق بدون إنترنت
============================================================ */

const CACHE_NAME   = 'sbeitla2-v1';
const CACHE_STATIC = 'sbeitla2-static-v1';

/* جميع الملفات المطلوب تخزينها مسبقاً */
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&family=Cairo:wght@300;400;600;700&display=swap'
];

/* ============================================================
   حدث التثبيت — Install
   يُشغَّل مرة واحدة عند تثبيت الـ SW لأول مرة
============================================================ */
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => {
        console.log('[SW] Pre-caching app shell...');
        // نحاول تخزين كل ملف منفرداً حتى لو فشل بعضها
        return Promise.allSettled(
          PRECACHE_URLS.map(url =>
            cache.add(url).catch(err => console.warn('[SW] Failed to cache:', url, err))
          )
        );
      })
      .then(() => self.skipWaiting()) // تفعيل فوري
  );
});

/* ============================================================
   حدث التفعيل — Activate
   يُشغَّل بعد التثبيت، يحذف الكاش القديم
============================================================ */
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_STATIC && name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    ).then(() => self.clients.claim()) // تولِّي التحكم في الفور
  );
});

/* ============================================================
   حدث الطلب — Fetch
   استراتيجية: Cache First ثم الشبكة كبديل
============================================================ */
self.addEventListener('fetch', event => {
  const { request } = event;

  // تجاهل طلبات غير GET وطلبات Chrome الداخلية
  if (request.method !== 'GET') return;
  if (request.url.startsWith('chrome-extension://')) return;

  event.respondWith(
    caches.match(request).then(cachedResponse => {
      // إذا وُجد في الكاش → إرجاعه مباشرة
      if (cachedResponse) {
        // تحديث الكاش في الخلفية (stale-while-revalidate)
        event.waitUntil(updateCache(request));
        return cachedResponse;
      }
      // غير موجود → جلب من الشبكة وتخزينه
      return fetchAndCache(request);
    })
  );
});

/* ============================================================
   دوال مساعدة
============================================================ */

/** جلب من الشبكة وحفظ في الكاش */
async function fetchAndCache(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type !== 'opaque') {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // في حالة عدم الاتصال، ارجع الصفحة الرئيسية
    const cached = await caches.match('./index.html');
    return cached || new Response('لا يوجد اتصال بالإنترنت', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

/** تحديث الكاش في الخلفية */
async function updateCache(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_STATIC);
      await cache.put(request, response);
    }
  } catch { /* بدون إنترنت — لا بأس */ }
}

/* ============================================================
   رسالة من التطبيق — Message Handler
============================================================ */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_STATIC });
  }
});
