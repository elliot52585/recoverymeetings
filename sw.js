// Offline support. Someone looking for tonight's meeting on a dead spot of
// signal still gets the last-known schedule.
//
// Strategy: network-first for everything — online visitors always get the
// latest app and data; the cache is an offline-only fallback. (Cache-first
// caused a "stale until you refresh twice" problem.)
const VERSION = "rm-v14";
const SHELL = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "icon.svg",
  "registry/fellowships.json",
  "vendor/leaflet.js",
  "vendor/leaflet.css",
  "vendor/leaflet.markercluster.js",
  "vendor/MarkerCluster.css",
  "vendor/MarkerCluster.Default.css",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first for everything: online visitors always get the latest app
// and data; the cache is purely an offline fallback. This avoids the
// cache-first "stale until you refresh twice" problem.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(networkFirst(e.request));
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    // Offline: fall back to cache (ignore ?city= etc. for navigations).
    const hit = await cache.match(req, { ignoreSearch: req.mode === "navigate" });
    if (hit) return hit;
    throw new Error("offline and not cached");
  }
}
