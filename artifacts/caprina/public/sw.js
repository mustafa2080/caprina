// ─── CAPRINA OS — Service Worker ──────────────────────────────────────────────
// Strategy:
//   • JS/CSS (hashed assets) → Network First → Cache Fallback
//   • Images/fonts          → Cache First
//   • Navigation (HTML)     → Network First → fallback to cache
//   • API calls (/api/*)    → Network Only (never cache)

const CACHE_VERSION = "caprina-v5";
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const NAV_CACHE     = `${CACHE_VERSION}-nav`;
const ALL_CACHES    = [STATIC_CACHE, NAV_CACHE];

const PRECACHE_URLS = ["./"];

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

  // 2. API calls → Network Only
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: "لا يوجد اتصال بالسيرفر" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // 3. JS & CSS (Vite hashed files) → Network First → Cache Fallback
  //    عشان لما يتغير الـ hash بعد build جديد يجيب الجديد دايماً
  if (url.pathname.match(/\.(js|css)$/)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) => cached ?? new Response("", { status: 404 })
          )
        )
    );
    return;
  }

  // 4. Images & fonts → Cache First (بيتغيروش كتير)
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?|ttf|eot|webp|gif)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => new Response("", { status: 404 }));
      })
    );
    return;
  }

  // 5. Navigation (HTML) → always serve index.html (SPA routing)
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch("/index.html")
        .then((response) => {
          const clone = response.clone();
          caches.open(NAV_CACHE).then((cache) => cache.put("/index.html", clone));
          return response;
        })
        .catch(() =>
          caches.match("/index.html").then((cached) => cached ?? caches.match("./"))
        )
    );
    return;
  }

  // 6. Everything else → Network First
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then(
          (cached) => cached ?? new Response("", { status: 404 })
        )
      )
  );
});

// ─── Message handler ──────────────────────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
