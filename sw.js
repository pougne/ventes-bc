// Service worker minimal : coquille + données en cache pour l'usage hors ligne / écran d'accueil.
// Réseau d'abord pour la page et les données (mise à jour dès qu'il y a du réseau), cache sinon.
// Bibliothèques CDN : cache d'abord. Tuiles de carte : cache des tuiles déjà vues (plafonné).
// Tuiles communes (tuiles/*.json) : pas dans la coquille ; mises en cache par reseauDabord seulement quand on les a chargées (on ne précharge jamais tout le 92 ni tout Paris).
const V = "ventes-bc-v3", TU = "ventes-bc-tuiles-v1", MAXT = 400;
const SHELL = ["./", "./index.html", "./ventes.js", "./annonces.js", "./annonces_calque.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
const CDN = ["https://unpkg.com/leaflet@1.9.4/dist/leaflet.css", "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css", "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css",
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js", "https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"];
self.addEventListener("install", e => e.waitUntil((async () => { const c = await caches.open(V);
  await c.addAll(SHELL); await Promise.all(CDN.map(u => c.add(new Request(u, {mode: "cors"})).catch(() => {}))); self.skipWaiting(); })()));
self.addEventListener("activate", e => e.waitUntil((async () => { for (const k of await caches.keys()) if (k !== V && k !== TU) await caches.delete(k); await self.clients.claim(); })()));
async function reseauDabord(req) { const c = await caches.open(V);
  try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; }
  catch (e) { return (await c.match(req, {ignoreSearch: true})) || (req.mode === "navigate" ? c.match("./index.html") : Response.error()); } }
async function cacheDabord(req, nom, max) { const c = await caches.open(nom), m = await c.match(req); if (m) return m;
  const r = await fetch(req); if (r.ok || r.type === "opaque") { c.put(req, r.clone()); if (max) { const k = await c.keys(); if (k.length > max) for (const x of k.slice(0, k.length - max)) c.delete(x); } } return r; }
self.addEventListener("fetch", e => { const u = new URL(e.request.url); if (e.request.method !== "GET") return;
  if (u.origin === location.origin) e.respondWith(reseauDabord(e.request));
  else if (u.hostname === "unpkg.com") e.respondWith(cacheDabord(e.request, V));
  else if (u.hostname === "tile.openstreetmap.org" || u.hostname === "data.geopf.fr") e.respondWith(cacheDabord(e.request, TU, MAXT)); });
