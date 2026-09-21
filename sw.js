const CACHE_NAME = 'zinger-cache-v1';

// الملفات الأساسية لتشغيل التطبيق أوفلاين وفورياً
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './images/logoz.png',
  './images/default.jpg'
];

// 1. تثبيت الـ Service Worker وحفظ الملفات الثابتة في الكاش
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. تنظيف الإصدارات القديمة من الكاش عند التحديث
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. الاستجابة للطلبات مع استراتيجية ذكية للسرعة وتحديث الأسعار
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // إذا كان الطلب لشيت جوجل (الأسعار والمنيو): نحاول الاتصال بالإنترنت أولاً لضمان أحدث سعر
  if (url.origin.includes('google') || url.origin.includes('googleusercontent')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // بالنسبة للصور والملفات الثابتة: البحث في الكاش أولاً للسرعة القصوى، ثم الشبكة
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // إذا كان هناك خطأ أو انقطاع إنترنت في تحميل صورة الصنف
        if (request.destination === 'image') {
          return caches.match('./images/default.jpg');
        }
      });
    })
  );
});
