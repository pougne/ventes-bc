// Service worker minimal : coquille + données en cache pour l'usage hors ligne / écran d'accueil.
// Page et données : réseau d'abord, mais au bout de 3 s sans réponse on sert le cache (la réponse réseau, si elle arrive, met le cache à jour).
// Bibliothèques CDN : cache d'abord. Tuiles de carte : cache des tuiles déjà vues (plafonné).
// Tuiles communes (tuiles/<insee>.json?v=…, URL versionnée) : cache d'abord, ancienne version purgée ; jamais préchargées (ni tout le 92 ni tout Paris).
// Purge à l'activation limitée aux caches ventes-bc-* (d'autres pages de pougne.github.io partagent l'origine).
const V = "ventes-bc-v5", TU = "ventes-bc-tuiles-v1", CO = "ventes-bc-communes-v1", MAXT = 400, DELAI = 3000;
const SHELL = ["./", "./index.html", "./ventes.js", "./annonces.js", "./annonces_calque.js", "./rue360.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
const CDN = ["https://unpkg.com/leaflet@1.9.4/dist/leaflet.css", "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css", "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css",
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js", "https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"];
self.addEventListener("install", e => e.waitUntil((async () => { const c = await caches.open(V);
  await c.addAll(SHELL); await Promise.all(CDN.map(u => c.add(new Request(u, {mode: "cors"})).catch(() => {}))); self.skipWaiting(); })()));
self.addEventListener("activate", e => e.waitUntil((async () => { const garde = [V, TU, CO];
  for (const k of await caches.keys()) if (k.startsWith("ventes-bc-") && !garde.includes(k)) await caches.delete(k);
  await self.clients.claim(); })()));
async function reseauDabord(e) { const req = e.request, c = await caches.open(V);
  const net = fetch(req).then(r => { if (r.ok) { const cl = r.clone(); e.waitUntil(c.put(req, cl)); } return r; });
  e.waitUntil(net.catch(() => {}));
  const repli = async () => (await c.match(req, {ignoreSearch: true})) || (req.mode === "navigate" ? c.match("./index.html") : null);
  let t; const delai = new Promise(r => { t = setTimeout(r, DELAI); });
  try {
    const gagnant = await Promise.race([net, delai.then(() => "delai")]);
    if (gagnant !== "delai") { clearTimeout(t); return gagnant; }
    const m = await repli(); if (m) return m; // réseau lent : cache tout de suite, mise à jour en arrière-plan
    return await net;
  } catch (err) { clearTimeout(t); return (await repli()) || Response.error(); } }
async function cacheDabord(req, nom, max) { const c = await caches.open(nom), m = await c.match(req); if (m) return m;
  const r = await fetch(req); if (r.ok || r.type === "opaque") { c.put(req, r.clone()); if (max) { const k = await c.keys(); if (k.length > max) for (const x of k.slice(0, k.length - max)) c.delete(x); } } return r; }
async function communeVersionnee(req) { const c = await caches.open(CO), m = await c.match(req); if (m) return m; // URL exacte, version comprise
  const r = await fetch(req); if (r.ok) { const u = new URL(req.url); await c.put(req, r.clone());
    for (const k of await c.keys()) { const x = new URL(k.url); if (x.pathname === u.pathname && x.search !== u.search) c.delete(k); } } // ancienne version de la même commune
  return r; }
self.addEventListener("fetch", e => { const u = new URL(e.request.url); if (e.request.method !== "GET") return;
  if (u.origin === location.origin) {
    if (/\/tuiles\/[^/]+\.json$/.test(u.pathname) && !u.pathname.endsWith("/index.json") && u.searchParams.has("v")) e.respondWith(communeVersionnee(e.request));
    else e.respondWith(reseauDabord(e)); }
  else if (u.hostname === "unpkg.com") e.respondWith(cacheDabord(e.request, V));
  else if (u.hostname === "tile.openstreetmap.org" || u.hostname === "data.geopf.fr") e.respondWith(cacheDabord(e.request, TU, MAXT)); });
