"""Tuile commune de l'outil ventes (chargée à la demande par index.html) : python3 construire_commune.py 92051
Sources brutes dans ../communes/<insee>/ (telecharger_commune.py) : geo-dvf 2021-2025, DVF+ Cerema 2014-2020, DVF DGFiP brute 2026 S1, cadastre Etalab, contour officiel geo.api.gouv.fr, DPE ADEME.
Même nettoyage que construire.py / dvf_nettoyage.py / dvf_2026.py (une seule maison ou un seul appartement, doublons retirés), avec des bornes €/m² propres à la commune (BORNES).
Sortie : tuiles/<insee>.json (format colonnaire compact, voir encoder()) + tuiles/index.json (registre des tuiles : bbox, taille, nb de ventes)."""
import os, sys, json, glob, io, gzip, uuid, urllib.request, datetime, numpy as np, pandas as pd, geopandas as gpd
from shapely.geometry import shape
O = os.path.dirname(os.path.abspath(__file__)); B = os.path.dirname(O)
C = sys.argv[1] if len(sys.argv) > 1 else "92051"
COM = {"92051": {"nom": "Neuilly-sur-Seine", "z": "neuilly", "court": "Neuilly"}}[C]
# bornes €/m² : [min, max] tous types ; maison >= 100 m² gardée jusqu'à max_maison (vrai haut de gamme). BC : 2 000 / 12 000 / 20 000.
BORNES = {"92051": (4000, 20000, 35000)}[C]
PMIN, PMAX, PMAXM = BORNES
D = os.path.join(B, "communes", C)
def ban_csv(df, url, extra):
    buf = io.StringIO(); df.to_csv(buf, index=False); bnd = uuid.uuid4().hex
    body = f"--{bnd}\r\nContent-Disposition: form-data; name=\"data\"; filename=\"a.csv\"\r\nContent-Type: text/csv\r\n\r\n{buf.getvalue()}\r\n"
    for k, v in extra: body += f"--{bnd}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n"
    body = (body + f"--{bnd}--\r\n").encode()
    for k in range(4):
        try: return pd.read_csv(io.StringIO(urllib.request.urlopen(urllib.request.Request(url, data=body, headers={"Content-Type": f"multipart/form-data; boundary={bnd}"}), timeout=600).read().decode()))
        except Exception as e: print("retry BAN", e, flush=True)
    raise SystemExit("BAN indisponible")
def borne_ok(t, s, p): return (p >= PMIN) & ((p <= PMAX) | ((t == "Maison") & (s >= 100) & (p <= PMAXM)))
# ---- 1. geo-dvf 2021-2025 (règles dvf_aberrantes.py + dvf_nettoyage.py)
raw = pd.concat([pd.read_csv(f, dtype=str) for f in sorted(glob.glob(os.path.join(D, "geodvf", "*.csv")))])
for c in ["valeur_fonciere", "surface_reelle_bati", "nombre_lots", "longitude", "latitude"]: raw[c] = pd.to_numeric(raw[c], errors="coerce")
raw["adr"] = (raw.adresse_numero.fillna("").str.replace(r"\.0$", "", regex=True) + " " + raw.adresse_suffixe.fillna("") + " " + raw.adresse_nom_voie.fillna("")).str.split().str.join(" ")
adr_parc = raw[raw.adr != ""].groupby("id_parcelle").adr.agg(lambda s: s.mode().iloc[0]).to_dict()
d = raw[raw.nature_mutation.isin(["Vente", "Vente en l'état futur d'achèvement"])]
loc = d[d.type_local.isin(["Maison", "Appartement"])]
g1 = loc.groupby("id_mutation")
m = g1.agg(date=("date_mutation", "first"), nature=("nature_mutation", "first"), num=("adresse_numero", "first"), voie=("adresse_nom_voie", "first"),
           type=("type_local", lambda s: "+".join(sorted(set(s)))), n_locaux=("type_local", "size"), surface=("surface_reelle_bati", "sum"), valeur=("valeur_fonciere", "first"),
           lots=("nombre_lots", "max"), lon=("longitude", "first"), lat=("latitude", "first"), parcelle=("id_parcelle", "first")).reset_index()
m["adresse"] = (m.num.fillna("").str.replace(r"\.0$", "", regex=True) + " " + m.voie.fillna("")).str.strip()
m["pm2"] = m.valeur / m.surface.replace(0, np.nan)
m["n_adr_jour"] = m.groupby(["adresse", "date"]).id_mutation.transform("nunique")
st = {"geodvf_mutations_logement": len(m)}
k = (m.n_locaux == 1) & (m.n_adr_jour == 1) & (m.surface >= 20) & m.valeur.notna() & ~((m.type == "Maison") & (m.lots.fillna(0) >= 2)) & m.lon.notna()
m = m[k]; m = m[borne_ok(m.type, m.surface, m.pm2)]; st["geodvf_gardees"] = len(m)
m = m.assign(source="geo-dvf", adresse_approx=False, annee=m.date.str[:4].astype(int))
cols = ["parcelle", "date", "annee", "adresse", "type", "surface", "valeur", "pm2", "nature", "lon", "lat", "source", "adresse_approx"]
t = [m[cols]]
# ---- 2. DVF+ Cerema 2014-2020 (règles construire.py)
H = []
for f in sorted(glob.glob(os.path.join(D, "cerema", "*.geojson"))):
    for ft in json.load(open(f))["features"]:
        p = ft["properties"]
        H.append({"date": p["datemut"], "annee": p["anneemut"], "nature": p["libnatmut"], "typ": p["libtypbien"], "valeur": float(p["valeurfonc"] or 0), "surface": float(p["sbati"] or 0),
                  "parcelles": "|".join(sorted(p["l_idpar"])), "par0": (p["l_idpar"] or [None])[0], "geom": shape(ft["geometry"]) if ft["geometry"] else None})
h = pd.DataFrame(H); st["cerema_brut"] = len(h)
h = h[h.nature.isin(["Vente", "Vente en l'état futur d'achèvement"])]
h = h[h.groupby(["parcelles", "date"]).date.transform("size") == 1]
h = h[h.typ.isin(["UNE MAISON", "UN APPARTEMENT"])]; h["type"] = h.typ.map({"UNE MAISON": "Maison", "UN APPARTEMENT": "Appartement"})
h = h[(h.valeur > 0) & (h.surface >= 20) & h.geom.notna()]; h["pm2"] = h.valeur / h.surface
h = h[borne_ok(h.type, h.surface, h.pm2)]
cpt = gpd.GeoSeries(h.geom.values, crs=4326).representative_point(); h["lon"] = cpt.x.values; h["lat"] = cpt.y.values
h["parcelle"] = h.par0; h["adresse"] = h.par0.map(adr_parc); h["adresse_approx"] = h.adresse.isna(); h["source"] = "DVF+ Cerema"
st["cerema_gardees"] = len(h); t.append(h[cols])
# ---- 3. DVF DGFiP brute 2026 S1 (règles dvf_2026.py)
r = pd.read_csv(os.path.join(D, "s1.txt"), sep="|", dtype=str).drop_duplicates()
num = lambda s: pd.to_numeric(s.str.replace(",", ".", regex=False), errors="coerce")
r["valeur"] = num(r["Valeur fonciere"]); r["surf"] = num(r["Surface reelle bati"]); r["lots"] = num(r["Nombre de lots"])
r["date"] = pd.to_datetime(r["Date mutation"], format="%d/%m/%Y").dt.strftime("%Y-%m-%d")
r["parcelle"] = C + r["Prefixe de section"].fillna("000").str.zfill(3) + r.Section.fillna("").str.zfill(2) + r["No plan"].fillna("").str.zfill(4)
r["id_mutation"] = r.groupby(["date", "Nature mutation", "Valeur fonciere", "No disposition"], dropna=False).ngroup()
r = r[r["Nature mutation"].isin(["Vente", "Vente en l'état futur d'achèvement"])]
l2 = r[r["Type local"].isin(["Maison", "Appartement"])].copy()
l2["adr"] = (l2["No voie"].fillna("") + " " + l2["B/T/Q"].fillna("") + " " + l2["Type de voie"].fillna("") + " " + l2.Voie.fillna("")).str.split().str.join(" ")
s = l2.groupby("id_mutation").agg(date=("date", "first"), nature=("Nature mutation", "first"), adresse=("adr", "first"), type=("Type local", lambda x: "+".join(sorted(set(x)))),
                                  n_locaux=("Type local", "size"), surface=("surf", "sum"), valeur=("valeur", "first"), lots=("lots", "max"), parcelle=("parcelle", "first")).reset_index()
s["pm2"] = s.valeur / s.surface.replace(0, np.nan)
s["n_adr_jour"] = s.groupby(["adresse", "date"]).id_mutation.transform("nunique"); s["n_parc_jour"] = s.groupby(["parcelle", "date"]).id_mutation.transform("nunique")
s = s[(s.n_locaux == 1) & (s.n_adr_jour == 1) & (s.n_parc_jour == 1) & (s.surface >= 20) & s.valeur.notna() & ~((s.type == "Maison") & (s.lots.fillna(0) >= 2))]
s = s[borne_ok(s.type, s.surface, s.pm2)].copy(); s["annee"] = 2026
if len(s):
    rv = ban_csv(s[["adresse"]].assign(citycode=C, i=s.index), "https://api-adresse.data.gouv.fr/search/csv/",
                 [("columns", "adresse"), ("citycode", "citycode"), ("result_columns", "longitude"), ("result_columns", "latitude"), ("result_columns", "result_score")]).set_index("i")
    ok = rv.result_score >= 0.5; s["lon"] = s.index.map(rv.longitude.where(ok)); s["lat"] = s.index.map(rv.latitude.where(ok))
s = s.assign(source="DVF DGFiP", adresse_approx=False); s["adresse"] = s.adresse.where(s.adresse.fillna("") != "", s.parcelle.map(adr_parc))
st["s1_2026_gardees"] = len(s); t.append(s[cols])
t = pd.concat(t, ignore_index=True)
# ---- 4. position = point représentatif de la parcelle cadastrale ; périmètre = contour officiel
cad = gpd.read_file(gzip.open(os.path.join(B, "cadastre", f"{C}-parcelles.json.gz"))).drop_duplicates("id").set_index("id")
cad = cad[cad.index.isin(set(t.parcelle.dropna()))]
rp = cad.geometry.representative_point()
t = t[t.parcelle.isin(rp.index) | t.lon.notna()].copy()
t["lon"] = t.parcelle.map(rp.x).fillna(t.lon); t["lat"] = t.parcelle.map(rp.y).fillna(t.lat)
contour = shape(json.load(open(os.path.join(D, "contour.json")))["geometry"])
g = gpd.GeoDataFrame(t, geometry=gpd.points_from_xy(t.lon, t.lat), crs=4326)
g = g[g.within(contour.buffer(0.0003))].copy()  # ~30 m de marge (parcelles en limite)
st["hors_contour"] = int(len(t) - len(g))
mq = g.adresse.isna() | (g.adresse.fillna("") == "")
if mq.any():
    rv = ban_csv(g.loc[mq, ["lat", "lon"]].assign(i=g.index[mq]), "https://api-adresse.data.gouv.fr/reverse/csv/", [("result_columns", "result_label")]).set_index("i").result_label
    g.loc[mq, "adresse"] = g.index[mq].map(lambda i: rv.get(i)); g.loc[mq, "adresse_approx"] = True
g = g.reset_index(drop=True)
g["adresse"] = g.adresse.fillna("adresse inconnue").str.title()
g["pm2"] = g.pm2.round(0).astype(int); g["valeur"] = g.valeur.round(0).astype(int); g["surface"] = g.surface.round(0).astype(int); g["annee"] = g.annee.astype(int)
g["nom_commune"] = COM["nom"]; g["zone"] = COM["z"]
# ---- 5. DPE ADEME croisé (dpe_joindre.py, cache ../dpe/dpe_<insee>.csv)
import shutil
fd = os.path.join(B, "dpe", f"dpe_{C}.csv")
if not os.path.exists(fd) and os.path.exists(os.path.join(D, "dpe.csv")): shutil.copy(os.path.join(D, "dpe.csv"), fd)
sys.path.insert(0, O); import dpe_joindre
dpe_joindre.INSEE = {COM["nom"]: C}
g, DPEA, stat_dpe = dpe_joindre.joindre(g)
g = g.sort_values(["date", "parcelle"], ascending=[False, True]).reset_index(drop=True)
g.drop(columns="geometry").to_csv(os.path.join(D, "ventes.csv"), index=False)
# ---- 6. encodage colonnaire compact
w, so, e, n = [round(x, 4) for x in contour.bounds]
X0, Y0 = round(w - 0.002, 3), round(so - 0.002, 3)
ix = lambda lon: int(round((lon - X0) * 1e6)); iy = lambda lat: int(round((lat - Y0) * 1e6))
A = sorted(set(g.adresse)); AI = {a: i for i, a in enumerate(A)}
Q = sorted(set(g.parcelle.dropna())); QI = {q: i for i, q in enumerate(Q)}
def nz(v, f=int, d=0): return d if v is None or (isinstance(v, float) and np.isnan(v)) or v is pd.NA else f(v)
col = {
 "q": [QI.get(q, -1) if isinstance(q, str) else -1 for q in g.parcelle],
 "d": [int(x[2:4] + x[5:7] + x[8:10]) for x in g.date],  # AAMMJJ
 "a": [AI[a] for a in g.adresse], "ax": "".join("1" if x else "0" for x in g.adresse_approx),
 "t": "".join("M" if x == "Maison" else "A" for x in g["type"]), "s": g.surface.tolist(), "v": g.valeur.tolist(),
 "f": "".join("0" if x == "Vente" else "1" for x in g.nature),
 "src": "".join("C" if x.startswith("DVF+") else ("D" if x == "DVF DGFiP" else "G") for x in g.source),
 "x": [ix(v) for v in g.lon], "y": [iy(v) for v in g.lat],
 "dpe": "".join(x if isinstance(x, str) else "-" for x in g.dpe), "dpe_g": "".join(x if isinstance(x, str) else "-" for x in g.dpe_g),
 "dpe_d": [int(x[2:4] + x[5:7] + x[8:10]) if isinstance(x, str) else 0 for x in g.dpe_d],
 "dpe_s": [nz(x) for x in g.dpe_s], "dpe_ax": "".join(str(int(x)) if pd.notna(x) else "-" for x in g.dpe_ax), "dpe_n": [nz(x) for x in g.dpe_n],
}
# contours des parcelles vendues, simplifiés, en entiers (1e-6 °) delta-encodés : [type, [anneau1], [anneau2]...] (polygone) ou [type, [[anneaux]]...] (multi)
pq = cad[cad.index.isin(set(Q))].geometry.simplify(0.000004)
def ring(cs):
    out, px, py = [], 0, 0
    for k, (lo, la) in enumerate(cs[:-1] if len(cs) > 1 and tuple(cs[0]) == tuple(cs[-1]) else cs):
        x, y = ix(lo), iy(la); out += [x - px, y - py] if k else [x, y]; px, py = x, y
    return out
P = []
for q in Q:
    if q not in pq.index: P.append(0); continue
    gm = pq[q].__geo_interface__
    P.append(["P"] + [ring(r) for r in gm["coordinates"]] if gm["type"] == "Polygon" else ["M"] + [[ring(r) for r in poly] for poly in gm["coordinates"]])
genere = datetime.date.today().strftime("%d/%m/%Y")
meta = {"n": len(g), "annees": [int(g.annee.min()), int(g.annee.max())], "date_max": g.date.max(), "genere_le": genere, "par_source": g.source.value_counts().to_dict(),
        "approx": int(g.adresse_approx.sum()), "bornes_pm2": {"min": PMIN, "max": PMAX, "max_maison_100m2": PMAXM}, "nettoyage": st,
        "dpe": {k: stat_dpe[k] for k in ["dpe_actifs", "match_strict", "match_approx", "match_immeuble", "sans_dpe", "taux_strict", "taux_tout"]},
        "par_annee": g.groupby("annee").size().to_dict(), "par_type": g["type"].value_counts().to_dict()}
tile = {"v": 1, "insee": C, "nom": COM["nom"], "court": COM["court"], "z": COM["z"], "o": [X0, Y0], "meta": meta,
        "contour": json.loads(gpd.GeoSeries([contour.simplify(0.00003)]).to_json())["features"][0]["geometry"],
        "A": A, "Q": Q, "P": P, "dpeA": {str(AI[a]): v for a, v in DPEA.items() if a in AI}, "c": col}
txt = json.dumps(tile, ensure_ascii=False, separators=(",", ":"), default=int)
fo = os.path.join(O, "tuiles", f"{C}.json"); os.makedirs(os.path.dirname(fo), exist_ok=True); open(fo, "w").write(txt)
gz = len(gzip.compress(txt.encode(), 9))
fi = os.path.join(O, "tuiles", "index.json")
reg = json.load(open(fi)) if os.path.exists(fi) else {"v": 1, "tuiles": []}
reg["tuiles"] = [x for x in reg["tuiles"] if x["insee"] != C] + [{"insee": C, "nom": COM["nom"], "court": COM["court"], "z": COM["z"], "bbox": [w, so, e, n], "url": f"tuiles/{C}.json",
                 "n": len(g), "octets": len(txt.encode()), "octets_gzip": gz, "genere_le": genere, "v": pd.Timestamp.now().strftime("%Y%m%d%H%M")}]
json.dump(reg, open(fi, "w"), ensure_ascii=False, indent=1)
print(json.dumps({"ventes": len(g), "octets": len(txt.encode()), "gzip": gz, "nettoyage": st, "dpe": meta["dpe"], "par_annee": meta["par_annee"], "par_type": meta["par_type"]}, ensure_ascii=False, default=int))
