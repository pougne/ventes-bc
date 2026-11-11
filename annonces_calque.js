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
.ann span i,.ann-leg i,.ann-pop .dr{display:inline-block;flex:none;width:16px;height:16px;border-radius:50%;font:0/0 a;color:transparent;vertical-align:-3px;box-shadow:0 0 0 1.5px #fff;background:var(--drop) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M5 5l6 6M11 6.5V11H6.5' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/16px no-repeat}
.ann span i{position:absolute;top:-8px;right:-8px}
.ann span i.s,.ann-leg i.s,.ann-pop .dr.s{box-shadow:0 0 0 1.5px var(--drop),0 0 0 3px #fff;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M5 5l6 6M11 6.5V11H6.5' fill='none' stroke='%23c62828' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/16px no-repeat}
.ann-pop{font-variant-numeric:tabular-nums}.ann-pop .approx{color:#5b6472;font-size:11.5px}.ann-pop .nw{white-space:nowrap}
.ann-pop .px{margin-top:4px;line-height:1.35}.ann-pop .px>b:first-child{font-size:16px}
.ann-pop .bx{display:flex;gap:8px;align-items:center;margin-top:6px;padding:6px 8px;border-radius:8px;background:#fdecea;color:#8e1b1b;font-size:12.5px;line-height:1.3}
.ann-pop .bx b{font-size:14.5px;white-space:nowrap}.ann-pop .bx.s{background:#f3f4f6;color:#4b5563}
.ann-pop details{margin-top:2px}
.ann-pop summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:6px;padding:8px 0;font-size:12px;color:#5b6472}
.ann-pop summary::-webkit-details-marker{display:none}
.ann-pop summary:before{content:"›";width:10px;font-size:15px;line-height:1;transition:transform .15s}
.ann-pop details[open] summary:before{transform:rotate(90deg)}
.ann-pop .hp{display:grid;grid-template-columns:max-content max-content 1fr;gap:3px 12px;margin:0 0 6px 16px;font-size:12px;color:#4b5563}
.ann-pop .hp b{text-align:right;font-weight:500}.ann-pop .hp b:nth-last-child(2){font-weight:700;color:var(--ink)}.ann-pop .hp em{font-style:normal;color:#8e1b1b}.ann-pop .hp em.up{color:#4b5563}
.ann-pop .lv{margin-top:4px}
.ann-pop .warn{margin-top:6px;font-size:11.5px;color:#5b6472}`;
  document.head.appendChild(css);
  const NIV = {C: "Adresse confirmée", P: "parcelle de cette surface dans la zone de l’annonce, non vérifiée sur place, adresse non publiée"};
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
    return `<div style="margin-top:4px">Repère DVF ${a.t === "M" ? "maisons" : "appartements"} à moins de 300 m (${y0}–${ymax}) : médiane <b>${fmt(med)} €/m²</b> <span class="approx">(${v.length} ventes)</span>${e != null ? ` · annonce <b class="nw">${e > 0 ? "+" : e < 0 ? "−" : ""}${Math.abs(e)} %</b>` : ""}</div>`;
  }
  function pop(a) {
    const loc = a.typ === "L";
    let h = `<div class="ann-pop"><div class="pop-t"><span class="badge" style="background:#e8f0fe;border-color:#0d47a1">Annonce · prix demandé</span> <b>${esc(a.titre)}</b></div>`;
    h += `<div class="px"><b class="nw">${fmt(a.prix)} €${loc ? " CC / mois" : ""}</b> demandés${a.m2 ? ` · <span class="nw">${fmt(a.m2)} m²</span>` : ""}${a.pm2 ? ` · <b class="nw">${loc ? String(a.pm2).replace(".", ",") : fmt(a.pm2)} €/m²${loc ? "/mois" : ""}</b>` : ""}${a.ter ? ` · <span class="nw">terrain ${fmt(a.ter)} m²</span>` : ""}${a.dpe ? ` · <span class="nw">DPE ${a.dpe}</span>` : ""}</div>`;
    // baisse de prix (toutes, même sous 5 %) : plein = chiffrée, creux = signalée ; historique en grille, toujours replié (revue graphisme 11/11/2026)
    const an = a.hp && a.hp.length > 1 && a.hp[0][0].slice(0, 4) !== a.hp[a.hp.length - 1][0].slice(0, 4); // année affichée si l'historique chevauche janvier
    const dc = d => an ? dfr(d) : dfr(d).slice(0, 5);
    if (a.bp && a.hp && a.hp.length) h += `<div class="bx"><i class="dr">↘</i><b>−${Math.abs(a.bp)} %</b><span>${fmt(a.hp[0][1])} € → <span class="nw">${fmt(a.prix)} €</span> · <span class="nw">premier relevé le ${dc(a.hp[0][0])}</span></span></div>`;
    else if (a.bp) h += `<div class="bx"><i class="dr">↘</i><b>−${Math.abs(a.bp)} %</b></div>`;
    else if (a.bs) h += `<div class="bx s"><i class="dr s">↘</i><span>Baisse signalée par Bien’ici avant notre suivi, montant inconnu</span></div>`;
    if (a.hp && a.hp.length > 1) h += `<details><summary>Historique du prix (${a.hp.length} relevés)</summary><div class="hp">${a.hp.map((e, i) => {
      const d = i ? Math.round((e[1] / a.hp[i - 1][1] - 1) * 1000) / 10 : 0;
      return `<span>${dc(e[0])}</span><b>${fmt(e[1])} €</b><em${d > 0 ? ' class="up"' : ""}>${d ? (d < 0 ? "−" : "+") + String(Math.abs(d)).replace(".", ",") + " %" : ""}</em>`;
    }).join("")}</div></details>`;
    h += `<div class="lv">${a.niv === "C" ? "✅" : "≈"} <b>${a.niv === "C" ? "Confirmée" : "Probable"}</b> : <span class="approx">${NIV[a.niv]}</span></div>`;
    if (a.niv === "C" && a.adr) h += `<div>${esc(a.adr)}</div>`; // adresse déduite (probable) jamais affichée
    if (a.niv === "C" && a.parc) h += `<div class="approx">Parcelle ${esc(a.parc)}${a.pid ? ` (${esc(String(a.pid).slice(0, 5))})` : ""}</div>`;
    h += dvfAutour(a);
    if (urlSure(a.url)) h += `<div style="margin-top:6px"><a href="${esc(a.url)}" target="_blank" rel="noopener">Voir l’annonce${a.src ? " (" + esc(a.src) + ")" : ""} ↗</a>${a.dep ? ` <span class="approx">en ligne depuis le ${dfr(a.dep)}</span>` : ""}</div>`;
    h += `<div class="warn">Prix <b>demandé</b>, pas une vente DVF (hors échelle de couleur).</div></div>`;
    return wrap(h);
  }
  const grp = L.layerGroup();
  for (const a of A.features) {
    const ic = L.divIcon({className: `ann ${a.niv === "C" ? "c" : "p"}${a.typ === "L" ? " l" : ""}`, html: `<span>${a.typ === "L" ? fmt(a.prix) + " €/m" : k(a.prix)}${a.bp ? `<i data-p="−${Math.abs(a.bp)} %" title="Baisse de ${Math.abs(a.bp)} %">↘</i>` : a.bs ? `<i class="s" title="Baisse signalée, montant inconnu">↘</i>` : ""}</span>`, iconSize: [0, 0], iconAnchor: [0, 6], popupAnchor: [0, -22]});
    L.marker([a.lat, a.lon], {icon: ic, zIndexOffset: (a.niv === "C" ? 1000 : 500) + (a.bp || a.bs ? 200 : 0), title: String(a.titre || ""), keyboard: false}).bindPopup(() => pop(a), PO()).addTo(grp);
  }
  // bloc dans le panneau, juste avant « Liste »
  const nBp = A.features.filter(a => a.bp).length, nBs = A.features.filter(a => !a.bp && a.bs).length;
  const box = document.createElement("div");
  box.innerHTML = `<h2>Annonces en cours</h2><label><input type="checkbox" id="annOn" checked> <b>Annonces en ligne (localisation sûre)</b></label>
<div class="sub ann-leg"><b class="c">850 k€</b> adresse confirmée (${A.meta.confirmee}) · <b class="p">850 k€</b> parcelle probable (${A.meta.probable})${nBp ? ` · <i>↘</i> baisse chiffrée (${nBp})` : ""}${nBs ? ` · <i class="s">↘</i> baisse signalée, montant inconnu (${nBs})` : ""}. ${A.meta.exclues && A.meta.exclues.approximative ? `${A.meta.exclues.approximative} annonces à position approximative masquées. ` : ""}Prix demandés, pas des ventes DVF. Veille du ${A.meta.veille ? dfr(A.meta.veille) : "?"}.</div>`;
  const side = document.getElementById("side");
  const evol = [...side.querySelectorAll("h2")].find(h => /Évolution/i.test(h.textContent));
  if (evol) side.insertBefore(box, evol); else side.appendChild(box);
  const cb = box.querySelector("#annOn");
  const sync = () => cb.checked ? grp.addTo(map) : map.removeLayer(grp);
  cb.addEventListener("change", sync); sync();
  window.ANN_LAYER = grp;
})();
