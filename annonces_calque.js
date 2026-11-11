// Calque « annonces en cours » (localisation sûre seulement) — données : annonces.js (construire_annonces.py)
// Dépend des globales de index.html : map, PO, wrap, fmt, P (toutes les ventes DVF chargées : base + communes). Indépendant des filtres DVF.
// Adresse, parcelle et identifiant affichés seulement si la position est confirmée (niv C) ; textes tiers échappés.
(function () {
  const A = window.ANNONCES; if (!A || typeof map === "undefined") return;
  const css = document.createElement("style");
  css.textContent = `:root{--ann:#0d47a1;--ann-l:#6a1b9a;--drop:#c62828}
.ann{background:none;border:0}.ann.l{--ann:var(--ann-l)}
.ann span{position:absolute;left:0;bottom:0;transform:translate(-50%,0);white-space:nowrap;font:700 12px/1 system-ui,-apple-system,sans-serif;font-variant-numeric:tabular-nums;padding:4px 7px;border-radius:6px;border:1.5px solid var(--ann);box-shadow:0 0 0 2px #fffc,0 2px 5px #0005}
.ann span:after{content:"";position:absolute;left:50%;bottom:-6px;margin-left:-5px;border:5px solid transparent;border-bottom:0;border-top-color:var(--ann)}
.ann span:before{content:"";position:absolute;inset:-9px -6px -13px}
.ann.c span{background:var(--ann);color:#fff}.ann.p span{background:#fff;color:var(--ann)}
.ann-leg b.c,.ann-leg b.p{display:inline-block;font-size:10.5px;padding:1px 4px;border-radius:5px;margin-right:3px;border:1.5px solid var(--ann)}.ann-leg b.c{background:var(--ann);color:#fff}.ann-leg b.p{color:var(--ann);background:#fff}
.ann span i{font-style:normal;margin-left:3px;padding:0 3px;border-radius:3px;background:#c62828;color:#fff}
.ann-pop details{margin-top:3px}.ann-pop summary{cursor:pointer}.ann-leg i{font-style:normal;padding:0 3px;border-radius:3px;background:#c62828;color:#fff}
.ann-pop .warn{margin-top:6px;padding:4px 6px;background:#e8f0fe;border-radius:6px;font-size:11.5px}`;
  document.head.appendChild(css);
  const NIV = {C: "Adresse confirmée", P: "Position probable (parcelle cadastre de cette surface dans la zone de l’annonce, non vérifiée sur place ; adresse non publiée)"};
  const k = v => v >= 1e6 ? (v / 1e6).toFixed(2).replace(/0$/, "").replace(".", ",") + " M€" : Math.round(v / 1000) + " k€";
  const dfr = d => d.split("-").reverse().join("/");
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const urlSure = u => /^https?:\/\//i.test(u || "") ? u : null;
  // médiane DVF de même type à moins de 300 m, 3 dernières années de données (repère, pas une estimation)
  function dvfAutour(a) {
    if (typeof P === "undefined" || a.typ !== "V") return "";
    const ll = L.latLng(a.lat, a.lon), ymax = typeof YR !== "undefined" ? YR : Math.max(...P.map(p => p.y || 0)), y0 = ymax - 2;
    const pres = P.filter(p => p.ll && ll.distanceTo(p.ll) <= 300);
    if (!pres.length) return `<div class="approx">Repère DVF : ventes de la commune pas encore chargées (zoome sur la carte pour les charger).</div>`;
    const v = pres.filter(p => p.t === a.t && p.y >= y0).map(p => p.p).sort((x, y) => x - y);
    if (v.length < 5) return `<div class="approx">Ventes DVF ${a.t === "M" ? "maisons" : "appartements"} à moins de 300 m (${y0}–${ymax}) : ${v.length}, trop peu pour une médiane.</div>`;
    const m = v.length >> 1, med = v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2, e = a.pm2 ? Math.round((a.pm2 / med - 1) * 100) : null;
    return `<div style="margin-top:4px">Repère DVF ${a.t === "M" ? "maisons" : "appartements"} à moins de 300 m (${y0}–${ymax}) : médiane <b>${fmt(med)} €/m²</b> <span class="approx">(${v.length} ventes)</span>${e != null ? ` · annonce <b>${e > 0 ? "+" : ""}${e} %</b>` : ""}</div>`;
  }
  function pop(a) {
    const loc = a.typ === "L";
    let h = `<div class="pop-t ann-pop"><span class="badge" style="background:#e8f0fe;border-color:#0d47a1">Annonce en ligne</span> <b>${esc(a.titre)}</b><br>`;
    h += `<div style="margin-top:4px"><b>${fmt(a.prix)} €${loc ? " CC / mois" : ""}</b> demandés${a.m2 ? ` · ${fmt(a.m2)} m²` : ""}${a.pm2 ? ` · <b>${loc ? String(a.pm2).replace(".", ",") : fmt(a.pm2)} €/m²${loc ? "/mois" : ""}</b>` : ""}${a.ter ? ` · terrain ${fmt(a.ter)} m²` : ""}${a.dpe ? ` · DPE ${a.dpe}` : ""}</div>`;
    // baisse de prix (toutes, même sous 5 %) et historique compact, pliable (11/11/2026)
    if (a.bp) h += `<div style="margin-top:4px;color:#c62828"><b>↘ −${Math.abs(a.bp)} %</b> depuis le ${dfr(a.hp[0][0])} (${fmt(a.hp[0][1])} € → ${fmt(a.prix)} €)</div>`;
    else if (a.bs) h += `<div style="margin-top:4px;color:#c62828"><b>↘</b> Baisse signalée par Bien’ici avant notre suivi (montant inconnu)</div>`;
    if (a.hp && a.hp.length > 1) h += `<details${a.hp.length > 2 ? "" : " open"}><summary class="approx">Historique du prix (${a.hp.length} relevés)</summary><div class="approx">${a.hp.map(e => dfr(e[0]).slice(0, 5) + " : " + fmt(e[1]) + " €").join(" → ")}</div></details>`;
    h += `<div style="margin-top:4px">${a.niv === "C" ? "✅" : "≈"} <b>${a.niv === "C" ? "Confirmée" : "Probable"}</b> : <span class="approx">${NIV[a.niv]}</span></div>`;
    if (a.niv === "C" && a.adr) h += `<div>${esc(a.adr)}</div>`; // adresse déduite (probable) jamais affichée
    if (a.niv === "C" && a.parc) h += `<div class="approx">Parcelle ${esc(a.parc)}${a.pid ? ` (${esc(String(a.pid).slice(0, 5))})` : ""}</div>`;
    h += dvfAutour(a);
    if (urlSure(a.url)) h += `<div style="margin-top:6px"><a href="${esc(a.url)}" target="_blank" rel="noopener">Voir l’annonce${a.src ? " (" + esc(a.src) + ")" : ""} ↗</a>${a.dep ? ` <span class="approx">en ligne depuis le ${dfr(a.dep)}</span>` : ""}</div>`;
    h += `<div class="warn">Prix <b>demandé</b> dans une annonce, <b>pas une vente DVF</b> (pas sur l’échelle de couleur €/m² des ventes).</div></div>`;
    return wrap(h);
  }
  const grp = L.layerGroup();
  for (const a of A.features) {
    const ic = L.divIcon({className: `ann ${a.niv === "C" ? "c" : "p"}${a.typ === "L" ? " l" : ""}`, html: `<span>${a.typ === "L" ? fmt(a.prix) + " €/m" : k(a.prix)}${a.bp || a.bs ? "<i>↘</i>" : ""}</span>`, iconSize: [0, 0], iconAnchor: [0, 6], popupAnchor: [0, -22]});
    L.marker([a.lat, a.lon], {icon: ic, zIndexOffset: (a.niv === "C" ? 1000 : 500) + (a.bp || a.bs ? 200 : 0), title: String(a.titre || ""), keyboard: false}).bindPopup(() => pop(a), PO()).addTo(grp);
  }
  // bloc dans le panneau, juste avant « Liste »
  const box = document.createElement("div");
  box.innerHTML = `<h2>Annonces en cours</h2><label><input type="checkbox" id="annOn" checked> <b>Annonces en ligne (localisation sûre)</b></label>
<div class="sub ann-leg"><b class="c">850 k€</b> adresse confirmée (${A.meta.confirmee}) · <b class="p">850 k€</b> parcelle probable (${A.meta.probable})${A.meta.baisses ? ` · <i>↘</i> prix en baisse (${A.meta.baisses})` : ""}. ${A.meta.exclues && A.meta.exclues.approximative ? `${A.meta.exclues.approximative} annonces à position approximative masquées. ` : ""}Prix demandés, pas des ventes DVF. Veille du ${A.meta.veille ? dfr(A.meta.veille) : "?"}.</div>`;
  const side = document.getElementById("side");
  const evol = [...side.querySelectorAll("h2")].find(h => /Évolution/i.test(h.textContent));
  if (evol) side.insertBefore(box, evol); else side.appendChild(box);
  const cb = box.querySelector("#annOn");
  const sync = () => cb.checked ? grp.addTo(map) : map.removeLayer(grp);
  cb.addEventListener("change", sync); sync();
  window.ANN_LAYER = grp;
})();
