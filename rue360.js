// Vue rue 360° (Panoramax, sans clé) + pastilles des ventes collées dans la photo, synchronisée avec la carte.
// Module isolé : rien n'est chargé tant qu'on n'ouvre pas la vue (Photo Sphere Viewer + three.js via jsDelivr, import map dans index.html).
// Lit les globales de index.html : map, mk (marqueurs filtrés, m.q / m.p / couleur), BYQ, openParc, fmt, toast.
(() => {
const API = "https://api.panoramax.xyz/api/search";
const RV = 80, NMAX = 40, HCAM = 2.3, HFAC = 5; // rayon des pastilles (m), nb max, hauteur caméra et du point visé sur la façade (m)
const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI, n360 = a => ((a % 360) + 360) % 360;
const dist = (a, b) => { const x = rad(b[1] - a[1]) * Math.cos(rad((a[0] + b[0]) / 2)), y = rad(b[0] - a[0]); return Math.sqrt(x * x + y * y) * 6371000; }; // [lat, lon]
const cap = (a, b) => { const f1 = rad(a[0]), f2 = rad(b[0]), dl = rad(b[1] - a[1]);
  return n360(deg(Math.atan2(Math.sin(dl) * Math.cos(f2), Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl)))); };
const css = document.createElement("style");
css.textContent = `#r360{position:absolute;z-index:1150;left:0;right:0;bottom:0;height:60%;background:#111;display:flex;flex-direction:column;box-shadow:0 -2px 14px #0005}
@media(min-width:801px){#r360{left:auto;top:0;height:auto;width:55%}}
#r360 .rh{display:flex;gap:6px;align-items:center;padding:6px 8px;background:#1f2a37;color:#fff;font-size:12.5px;flex:none;flex-wrap:wrap}
#r360 .rh button{background:#fff;color:#1f2a37;border:0;border-radius:16px;min-height:34px;padding:0 12px;font-weight:600}
#r360 .rh a{color:#cfe0ef;font-size:12px}#r360 .rt{flex:1;min-width:120px;line-height:1.25}
#r360 .rv{flex:1;position:relative;min-height:0}
.r3p{transform:translateY(-4px);background:#fff;border-radius:12px;padding:2px 7px;font:600 12px/1.25 system-ui,-apple-system,sans-serif;color:#1f2a37;white-space:nowrap;box-shadow:0 1px 4px #0008;border-left:6px solid var(--c);cursor:pointer}
.r3p small{font-weight:400;color:#555}
.r3cone{pointer-events:none}`;
document.head.appendChild(css);
let PSV = null, MP = null, V = null, MKP = null, el = null, cur = null, cand = [], coneM = null, raf = 0, cible = null;
const $r = s => el.querySelector(s);
async function lib() { if (!PSV) { const [c, m] = await Promise.all([import("@photo-sphere-viewer/core"), import("@photo-sphere-viewer/markers-plugin")]); PSV = c; MP = m;
  for (const u of ["https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/core@5.15.1/index.css", "https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/markers-plugin@5.15.1/index.css"]) {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = u; document.head.appendChild(l); } } }
// photos 360° Panoramax autour d'un point
async function autour(ll, m) { const dy = m / 111000, dx = m / (111000 * Math.cos(rad(ll[0])));
  const r = await fetch(`${API}?bbox=${ll[1] - dx},${ll[0] - dy},${ll[1] + dx},${ll[0] + dy}&limit=300`); if (!r.ok) throw new Error("Panoramax " + r.status);
  const j = await r.json();
  return (j.features || []).filter(f => f.properties?.["pers:interior_orientation"]?.field_of_view === 360 && f.assets?.sd?.href).map(f => ({id: f.id, ll: [f.geometry.coordinates[1], f.geometry.coordinates[0]],
    az: +f.properties["view:azimuth"] || 0, d: (f.properties.datetime || "").slice(0, 10), url: f.assets.sd.href})); }
function ouvrirPanneau() { if (el) return;
  el = document.createElement("div"); el.id = "r360";
  el.innerHTML = `<div class="rh"><button data-a="b" title="Reculer">◀</button><button data-a="f" title="Avancer dans la direction regardée">Avancer ▶</button><div class="rt">Vue rue 360°…</div><button data-a="x" aria-label="Fermer la vue rue">✕</button></div><div class="rv"></div>`;
  $("mw").appendChild(el);
  el.querySelector(".rh").onclick = e => { const a = e.target.closest("button")?.dataset.a; if (a === "x") fermer(); else if (a === "f") bouger(0); else if (a === "b") bouger(180); };
  document.addEventListener("keydown", esc); }
const esc = e => { if (e.key === "Escape" && el) fermer(); };
function fermer() { cancelAnimationFrame(raf); try { V?.destroy(); } catch (e) {} V = null; MKP = null; el?.remove(); el = null; cur = null; cand = [];
  if (coneM) { map.removeLayer(coneM); coneM = null; } document.removeEventListener("keydown", esc); }
const yawDe = b => rad(n360(b - cur.az)); // cap monde -> yaw de la photo (centre de l'image = view:azimuth)
const capVu = () => V && cur ? n360(deg(V.getPosition().yaw) + cur.az) : 0;
function cone() { if (!cur) return; const h = capVu();
  const svg = `<svg width="90" height="90" viewBox="-45 -45 90 90" style="transform:rotate(${h}deg)"><path d="M0 0 L-26 -40 A48 48 0 0 1 26 -40 Z" fill="#2c6fa8" fill-opacity=".28" stroke="#2c6fa8" stroke-width="1.5"/><circle r="7" fill="#2c6fa8" stroke="#fff" stroke-width="2.5"/></svg>`;
  const ic = L.divIcon({className: "r3cone", html: svg, iconSize: [90, 90], iconAnchor: [45, 45]});
  if (!coneM) coneM = L.marker(cur.ll, {icon: ic, interactive: false, zIndexOffset: 5000}).addTo(map); else { coneM.setLatLng(cur.ll); coneM.setIcon(ic); } }
function centrer() { const s = map.getSize(), mob = window.innerWidth <= 800, z = Math.max(map.getZoom(), 17);
  map.setView(cur.ll, z, {animate: false}); map.panBy(mob ? [0, s.y * .3] : [s.x * .275, 0], {animate: false}); }
function pastilles() { if (!MKP || !cur) return; const L2 = [];
  for (const m of mk) { const p = m.p, d = dist(cur.ll, p.ll); if (d > RV || d < 2) continue; L2.push([d, m]); }
  L2.sort((a, b) => a[0] - b[0]);
  MKP.setMarkers(L2.slice(0, NMAX).map(([d, m]) => { const p = m.p, s = Math.max(.7, Math.min(1.15, 1.25 - d / 120));
    const e = document.createElement("div"); e.className = "r3p"; e.style.setProperty("--c", m.options.fillColor || "#888"); e.style.transform = `scale(${s.toFixed(2)})`; if (m.options.dashArray) e.style.opacity = .7; const vise = cible && dist(cible, p.ll) < 1; if (vise) { e.style.outline = "3px solid #facc15"; e.style.transform = "scale(1.2)"; }
    e.innerHTML = `${fmt(p.p)} €/m² <small>${p.t === "M" ? "maison" : "appt"} ${p.s} m² · ${p.y}</small>`;
    return {id: m.q, element: e, position: {yaw: yawDe(cap(cur.ll, p.ll)), pitch: Math.atan2(HFAC - HCAM, Math.max(d, 4))}, anchor: "bottom center", zIndex: Math.round(1000 - d) + (cible && dist(cible, m.p.ll) < 1 ? 2000 : 0), data: {q: m.q}}; })); }
function titre() { const n = (MKP?.getNbMarkers?.() ?? 0);
  $r(".rt").innerHTML = `Photo du ${cur.d.split("-").reverse().join("/")}${cible ? ` · parcelle à ${Math.round(dist(cur.ll, cible))} m` : ""} · ${n} vente${n > 1 ? "s" : ""} &lt; ${RV} m<br><a target="_blank" rel="noopener" href="https://api.panoramax.xyz/#focus=pic&pic=${cur.id}">Panoramax ↗</a> · <a target="_blank" rel="noopener" href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${cur.ll[0].toFixed(6)},${cur.ll[1].toFixed(6)}&heading=${Math.round(capVu())}">Google Street View ↗</a>`; }
function precharger() { const h = capVu(); for (const b of [0, 180]) { const c = suivante(n360(h + b)); if (c) (new Image()).src = c.url; } }
function suivante(h) { let best = null, bd = 1e9;
  for (const c of cand) { if (c.id === cur.id) continue; const d = dist(cur.ll, c.ll); if (d < 4 || d > 45) continue;
    const da = Math.abs(((cap(cur.ll, c.ll) - h + 540) % 360) - 180); if (da > 50) continue; const sc = d + da * .4; if (sc < bd) { bd = sc; best = c; } }
  return best; }
async function montrer(ph, capVoulu) { cur = ph; const pos = {yaw: yawDe(capVoulu), pitch: rad(2)};
  if (!V) { const box = $r(".rv");
    V = new PSV.Viewer({container: box, panorama: ph.url, defaultYaw: pos.yaw, defaultPitch: pos.pitch, navbar: ["zoom", "caption"], defaultZoomLvl: 10, loadingTxt: "Chargement de la photo…", touchmoveTwoFingers: false, mousewheelCtrlKey: false, plugins: [[MP.MarkersPlugin, {}]]});
    MKP = V.getPlugin(MP.MarkersPlugin);
    MKP.addEventListener("select-marker", ({marker}) => { const q = marker.data?.q; if (q && BYQ[q]) openParc(q); });
    V.addEventListener("position-updated", () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(cone); });
    V.addEventListener("panorama-error", () => toast("Photo Panoramax illisible"));
    await new Promise(r => V.addEventListener("ready", r, {once: true}));
  } else await V.setPanorama(ph.url, {position: pos, transition: 600, showLoader: true});
  pastilles(); cone(); titre(); centrer();
  try { cand = await autour(ph.ll, 50); precharger(); } catch (e) {} }
async function bouger(off) { if (!cur) return; const h = n360(capVu() + off);
  if (!cand.length) try { cand = await autour(cur.ll, 50); } catch (e) {}
  const c = suivante(h); if (!c) { toast("Pas d'autre photo 360° dans cette direction"); return; }
  await montrer(c, capVu()); }
window.rue360 = async function (lat, lon) {
  const ll = [lat, lon]; cible = ll; map.closePopup(); ouvrirPanneau(); $r(".rt").textContent = "Recherche d'une photo 360° Panoramax proche…";
  try { await lib(); } catch (e) { $r(".rt").innerHTML = `Vue 360° non disponible sur ce navigateur (iOS 16.4+ requis). <a target="_blank" rel="noopener" href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}">Google Street View ↗</a>`; return; }
  let L1 = []; try { L1 = await autour(ll, 45); if (!L1.length) L1 = await autour(ll, 120); } catch (e) {}
  if (!L1.length) { $r(".rt").innerHTML = `Aucune photo 360° Panoramax à moins de 120 m. <a target="_blank" rel="noopener" href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}">Google Street View ↗</a>`; return; }
  L1.forEach(c => c.dd = dist(ll, c.ll)); L1.sort((a, b) => (a.dd - b.dd) || (a.d < b.d ? 1 : -1));
  const ph = L1[0]; cand = L1;
  try { await montrer(ph, ph.dd > 3 ? cap(ph.ll, ll) : ph.az); } catch (e) { $r(".rt").textContent = "Erreur de chargement de la vue 360° : " + (e.message || e); }
};
})();
