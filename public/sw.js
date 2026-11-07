// Mindnote PWA Offline Service Worker
const CACHE_NAME = 'mindnote-offline-v2';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

// 1. Cài đặt Service Worker và nạp sẵn tài nguyên cốt lõi vào bộ nhớ đệm
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Dang nap bo nho dem offline...');
      return cache.addAll(CORE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. Kích hoạt và dọn dẹp các cache cũ nếu có phiên bản mới
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Xoa cache cu:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Đón các yêu cầu tải trang & tài nguyên: Cache-First + Network-Fallback
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Không cache các yêu cầu API bên ngoài (Supabase, OpenAI/Gemini, Google API)
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('api.xah.io') ||
    url.pathname.startsWith('/api/') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Nếu đã có sẵn trong bộ nhớ đệm, trả về ngay lập tức (chạy offline siêu tốc)
      if (cachedResponse) {
        // Cập nhật ngầm từ mạng nếu có kết nối (Stale-While-Revalidate)
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      // Nếu chưa có trong cache, tải từ mạng và tự động lưu vào cache cho lần sau
      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          // Khi rớt mạng hoàn toàn: Nếu là yêu cầu tải trang HTML, trả về index.html từ cache
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('./');
          }
        });
    })
  );
});
