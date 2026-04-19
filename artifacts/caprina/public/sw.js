// ─── CAPRINA OS — Service Worker ──────────────────────────────────────────────
// Strategy:
//   • Static assets (JS/CSS/fonts/images) → Cache First
//   • Navigation (HTML) → Network First → fallback to cache
//   • API calls (/api/*) → Network Only (never cache)

const CACHE_VERSION = "caprina-v1";
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const NAV_CACHE     = `${CACHE_VERSION}-nav`;
const ALL_CACHES    = [STATIC_CACHE, NAV_CACHE];

// Assets to pre-cache on install
const PRECACHE_URLS = [
  "./",
  "./manifest.json",
  "./logo.jpg",
  "./icon-maskable.svg",
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate — clean old caches ─────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !ALL_CACHES.includes(key))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Skip non-GET and cross-origin requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // 2. API calls → Network Only (always fresh data from server)
  if (url.pathname.includes("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  // 3. Static assets (JS, CSS, images, fonts) → Cache First
  const isStaticAsset =
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?|ttf|eot|webp|gif)$/);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (!response.ok) return response;
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // 4. Navigation (HTML pages) → Network First → Cache Fallback
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(NAV_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached ?? caches.match("./")))
    );
    return;
  }

  // 5. Everything else → Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      });
      return cached ?? networkFetch;
    })
  );
});

// ─── Background sync (push notifications placeholder) ─────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
