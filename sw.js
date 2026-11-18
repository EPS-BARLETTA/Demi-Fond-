/* Service worker de l'accueil uniquement.
   Les trois outils (scan/, video/, chrono/) ont chacun le leur, à leur propre portée. */
const CACHE = "eps-hub-v1";
const FILES = [
  "./",
  "./index.html",
  "./hub.css?v=1",
  "./hub-home.js?v=1",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./eleve/",
  "./eleve/index.html",
  "./chrono/js/qrcode.min.js?v=1"
];
const OWN = new Set(FILES.map(f => new URL(f, self.location).href));

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("eps-hub-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || !OWN.has(req.url)) return; // tout le reste : pas touché
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
