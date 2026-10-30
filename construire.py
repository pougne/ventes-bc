"""Construit l'outil carte cliquable des ventes (outil-ventes/index.html + ventes.csv).
Périmètre : points dans le quartier Bac, l'ouest mairie ou le contour de Bois-Colombes.
Sources : dvf_clean.csv (geo-dvf 2021-2025 nettoyé) + DVF+ open-data Cerema 2014-2020 (dvf_hist/*.geojson), même nettoyage.
2010-2013 : pas en open data (DV3F réservé aux acteurs publics)."""
import os, sys, json, glob, io, urllib.request, uuid, pandas as pd, geopandas as gpd
from shapely.geometry import shape
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from zones_geo import ZONES, zone_bac, zone_ouest, bc, B
O = os.path.join(B, "outil-ventes")
# 1. 2021-2025 nettoyé
d = pd.read_csv(os.path.join(B, "dvf_clean.csv")); d = d[d.lon.notna()]
d = d.assign(source="geo-dvf", adresse_approx=False)[["id_mutation", "date", "annee", "nom_commune", "adresse", "type", "surface", "valeur", "pm2", "nature", "lon", "lat", "source", "adresse_approx"]]
# adresse par parcelle (toutes lignes geo-dvf brutes) pour les ventes anciennes
raw = pd.concat([pd.read_csv(f, dtype=str, usecols=["id_mutation", "id_parcelle", "type_local", "adresse_numero", "adresse_suffixe", "adresse_nom_voie"]) for f in glob.glob(os.path.join(B, "dvf", "*.csv"))])
raw["adr"] = (raw.adresse_numero.fillna("") + " " + raw.adresse_suffixe.fillna("") + " " + raw.adresse_nom_voie.fillna("")).str.split().str.join(" ")
# parcelle de chaque mutation geo-dvf : celle de la ligne du logement (maison / appartement), sinon la première
rl = raw[raw.type_local.isin(["Maison", "Appartement"])]
mut_parc = rl.groupby("id_mutation").id_parcelle.first().combine_first(raw.groupby("id_mutation").id_parcelle.first())
d["parcelle"] = d.id_mutation.map(mut_parc); d = d.drop(columns="id_mutation")
adr_parc = raw[raw.adr != ""].groupby("id_parcelle").adr.agg(lambda s: s.mode().iloc[0]).to_dict()
# 2. 2014-2020 Cerema, même nettoyage
H = []; stat_h = {"brut": 0}
for f in sorted(glob.glob(os.path.join(B, "dvf_hist", "*.geojson"))):
    for ft in json.load(open(f))["features"]:
        p = ft["properties"]; stat_h["brut"] += 1
        H.append({"date": p["datemut"], "annee": p["anneemut"], "nature": p["libnatmut"], "typ": p["libtypbien"], "valeur": float(p["valeurfonc"] or 0),
                  "surface": float(p["sbati"] or 0), "parcelles": "|".join(sorted(p["l_idpar"])), "par0": (p["l_idpar"] or [None])[0],
                  "insee": p["l_codinsee"][0], "geom": shape(ft["geometry"]) if ft["geometry"] else None})
h = pd.DataFrame(H)
if len(h):
    h = h[h.nature.isin(["Vente", "Vente en l'état futur d'achèvement"])]
    n0 = len(h)
    k = h.groupby(["parcelles", "date"]).date.transform("size"); stat_h["meme_parcelle_meme_jour"] = int((k > 1).sum()); h = h[k == 1]
    h = h[h.typ.isin(["UNE MAISON", "UN APPARTEMENT"])]; stat_h["un_seul_logement"] = len(h)
    h["type"] = h.typ.map({"UNE MAISON": "Maison", "UN APPARTEMENT": "Appartement"})
    h = h[(h.valeur > 0) & (h.surface >= 20) & h.geom.notna()]; h["pm2"] = h.valeur / h.surface
    ok = h.pm2.between(2000, 12000) | ((h["type"] == "Maison") & (h.surface >= 100) & h.pm2.between(12000, 20000))
    stat_h["hors_bornes_ou_sous_20m2"] = int(stat_h["un_seul_logement"] - ok.sum()); h = h[ok]
    c = gpd.GeoSeries(h.geom.values, crs="EPSG:4326").representative_point(); h["lon"] = c.x.values; h["lat"] = c.y.values
    h["nom_commune"] = h.insee.map({"92009": "Bois-Colombes", "92004": "Asnières"})
    h["adresse"] = h.par0.map(adr_parc); h["adresse_approx"] = h.adresse.isna(); h["source"] = "DVF+ Cerema"
    h["parcelle"] = h.par0
    h = h[["parcelle", "date", "annee", "nom_commune", "adresse", "type", "surface", "valeur", "pm2", "nature", "lon", "lat", "source", "adresse_approx"]]
    stat_h["gardees"] = len(h)
t = pd.concat([d, h]) if len(h) else d
# position unifiée : point représentatif de la parcelle cadastrale (Etalab), pour que toutes les ventes d'une parcelle tombent au même endroit
import gzip
cad = gpd.GeoDataFrame(pd.concat([gpd.read_file(gzip.open(f)) for f in glob.glob(os.path.join(B, "cadastre", "*-parcelles.json.gz"))]), crs="EPSG:4326")
cad = cad[cad["id"].isin(set(t.parcelle.dropna()))].drop_duplicates("id").set_index("id")
rp = cad.geometry.representative_point()
t["lon"] = t.parcelle.map(rp.x).fillna(t.lon); t["lat"] = t.parcelle.map(rp.y).fillna(t.lat)
g = gpd.GeoDataFrame(t, geometry=gpd.points_from_xy(t.lon, t.lat), crs="EPSG:4326")
per = zone_bac.union(zone_ouest).union(bc); g = g[g.within(per)].copy()
g["zone"] = "Reste de Bois-Colombes"
for n in ["Frange Agnettes / BC nord", "Ouest mairie BC", "Quartier Bac"]: g.loc[g.within(ZONES[n]), "zone"] = n
# 3. adresses manquantes : géocodage inverse BAN (adresse la plus proche du point de parcelle, marquée « approx. »)
m = g.adresse.isna()
if m.any():
    buf = io.StringIO(); g.loc[m, ["lat", "lon"]].assign(i=g.index[m]).to_csv(buf, index=False)
    bnd = uuid.uuid4().hex; body = (f"--{bnd}\r\nContent-Disposition: form-data; name=\"data\"; filename=\"p.csv\"\r\nContent-Type: text/csv\r\n\r\n{buf.getvalue()}\r\n"
        f"--{bnd}\r\nContent-Disposition: form-data; name=\"result_columns\"\r\n\r\nresult_label\r\n--{bnd}--\r\n").encode()
    r = urllib.request.urlopen(urllib.request.Request("https://api-adresse.data.gouv.fr/reverse/csv/", data=body, headers={"Content-Type": f"multipart/form-data; boundary={bnd}"}), timeout=300).read().decode()
    rv = pd.read_csv(io.StringIO(r)).set_index("i").result_label
    g.loc[m, "adresse"] = g.index[m].map(lambda i: rv.get(i))
g = g.reset_index(drop=True)
g["adresse"] = g.adresse.fillna("adresse inconnue").str.title().str.replace(" 922", " 922", regex=False)
g["pm2"] = g.pm2.round(0).astype(int); g["valeur"] = g.valeur.round(0).astype(int); g["surface"] = g.surface.round(0).astype(int); g["annee"] = g.annee.astype(int)
cols = ["parcelle", "date", "annee", "zone", "nom_commune", "adresse", "adresse_approx", "type", "surface", "valeur", "pm2", "nature", "lat", "lon", "source"]
g = g.sort_values("date", ascending=False)
g[cols].to_csv(os.path.join(O, "ventes.csv"), index=False)
zg = {n: json.loads(gpd.GeoSeries([ZONES[n] if n != "Reste de Bois-Colombes" else bc], crs="EPSG:4326").to_json())["features"][0]["geometry"] for n in ZONES}
ZC = {"Quartier Bac": "bac", "Ouest mairie BC": "ouest", "Frange Agnettes / BC nord": "frange", "Reste de Bois-Colombes": "bc"}
feats = [{"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(r.lon, 6), round(r.lat, 6)]},
          "properties": {"q": r.parcelle if isinstance(r.parcelle, str) else "", "d": r.date, "y": int(r.annee), "z": ZC[r.zone], "c": "BC" if r.nom_commune == "Bois-Colombes" else "AS", "a": r.adresse, "ax": int(bool(r.adresse_approx)),
                         "t": "M" if r.type == "Maison" else "A", "s": int(r.surface), "v": int(r.valeur), "p": int(r.pm2), "f": int(r.nature != "Vente"), "src": "C" if r.source.startswith("DVF+") else "G"}}
         for r in g.itertuples()]
meta = {"genere_le": pd.Timestamp.now().strftime("%d/%m/%Y"), "n": len(g), "annees": [int(g.annee.min()), int(g.annee.max())], "hist": stat_h,
        "par_source": g.source.value_counts().to_dict(), "approx": int(g.adresse_approx.sum()),
        "cles": {"d": "date", "y": "année", "z": "zone (bac, ouest, frange, bc)", "c": "commune", "a": "adresse", "ax": "adresse approchée (géocodage inverse)", "t": "M maison / A appartement",
                 "s": "surface bâtie m²", "v": "prix €", "p": "€/m²", "f": "VEFA (neuf)", "src": "G geo-dvf / C DVF+ Cerema"}}
# contours des parcelles ayant au moins une vente (cliquables au zoom fort), simplifiés
pq = cad[cad.index.isin(set(g.parcelle.dropna()))].geometry.simplify(0.000004)
parc = {i: json.loads(json.dumps(gm.__geo_interface__, default=list))["coordinates"] for i, gm in pq.items()}
def rnd(x): return [rnd(v) for v in x] if isinstance(x, (list, tuple)) and x and isinstance(x[0], (list, tuple)) else [round(x[0], 6), round(x[1], 6)]
parc = {i: {"t": pq[i].geom_type, "c": rnd(c)} for i, c in parc.items()}
meta["parcelles"] = len(parc); meta["sans_parcelle"] = int(g.parcelle.isna().sum())
meta["cles"]["q"] = "id parcelle cadastrale"
gj = {"type": "FeatureCollection", "meta": meta, "zones": zg, "parcelles": parc, "features": feats}
txt = json.dumps(gj, ensure_ascii=False, separators=(",", ":"), default=int)
open(os.path.join(O, "ventes.geojson"), "w").write(txt)
open(os.path.join(O, "ventes.js"), "w").write("window.VENTES=" + txt + ";")
json.dump(meta, open(os.path.join(O, "bilan.json"), "w"), ensure_ascii=False, indent=1, default=int)
print(json.dumps(meta, ensure_ascii=False, default=int)); print(g.groupby(["annee", "zone"]).size().unstack().fillna(0).astype(int))
