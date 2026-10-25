/*
  オフライン対応（ホーム画面に追加したとき用）

  - サイト内のページ・CSS・JS は「まずネットから取り、失敗したら保存済みのものを出す」
    → ネットにつながっていれば常に最新。圏外でも一度開いたページは表示できる
  - Googleフォント・Supabase SDK は保存済みのものを先に出し、裏で更新する
  - Supabase への通信（ログイン・回答記録）は保存しない

  中身を大きく変えたときは VERSION を上げると、古い保存分が消える。
*/
const VERSION = "v19";
const CACHE = `site-${VERSION}`;
const CORE = [
  "./",
  "index.html",
  "login.html",
  "manifest.webmanifest",
  "assets/css/theme.css",
  "assets/css/components.css",
  "assets/css/site.css",
  "assets/css/content.css",
  "assets/css/note.css",
  "assets/css/terms.css",
  "assets/js/catalog.js",
  "assets/js/site.js",
  "assets/js/study-sync.js",
  "assets/icons/icon-192.png",
];
const SHARED_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

const networkFirst = async (request) => {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: request.mode === "navigate" });
    if (cached) return cached;
    if (request.mode === "navigate") {
      return new Response(
        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
          '<title>オフライン</title><body style="margin:0;padding:40px 20px;background:#fff;color:#1d1d1f;font-family:-apple-system,sans-serif;text-align:center">' +
          "<h1>オフラインです</h1><p>このページはまだ保存されていません。電波のある場所で一度開くと、次からは圏外でも見られます。</p></body>",
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }
    throw error;
  }
};

const staleWhileRevalidate = async (request) => {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const fresh = fetch(request)
    .then((response) => {
      if (response.ok || response.type === "opaque") cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || fresh;
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const target = new URL(request.url);
  if (target.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  } else if (SHARED_HOSTS.includes(target.hostname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
