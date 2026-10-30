"""Téléchargement des sources brutes d'une commune (tuile de l'outil ventes) dans ../communes/<insee>/ : python3 telecharger_commune.py 92051
Cerema DVF+ 2014-2020, geo-dvf 2021-2025, DGFiP 2026 S1 (depuis dvf_brut/s1.zip), cadastre Etalab, contour officiel, DPE ADEME."""
import json, os, sys, time, io, zipfile, urllib.request, urllib.parse, gzip
C = sys.argv[1]; B = "/workspace/immo"; D = os.path.join(B, "communes", C); os.makedirs(D, exist_ok=True)
UA = {"User-Agent": "outil-ventes-bc (lecture seule)"}
def get(u, js=True, t=180):
    for k in range(5):
        try:
            r = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=t).read()
            return json.loads(r) if js else r
        except Exception as e: print("retry", u, e, flush=True); time.sleep(5 * (k + 1))
    raise SystemExit("échec " + u)
which = sys.argv[2:] or ["contour", "cadastre", "geodvf", "s1", "cerema", "dpe"]
if "contour" in which:
    f = os.path.join(D, "contour.json")
    if not os.path.exists(f): open(f, "w").write(json.dumps(get(f"https://geo.api.gouv.fr/communes/{C}?format=geojson&geometry=contour")))
    print("contour ok", flush=True)
if "cadastre" in which:
    f = os.path.join(B, "cadastre", f"{C}-parcelles.json.gz")
    if not os.path.exists(f): open(f, "wb").write(get(f"https://cadastre.data.gouv.fr/data/etalab-cadastre/latest/geojson/communes/92/{C}/cadastre-{C}-parcelles.json.gz", js=False))
    print("cadastre ok", flush=True)
if "geodvf" in which:
    os.makedirs(os.path.join(D, "geodvf"), exist_ok=True)
    for y in range(2021, 2026):
        f = os.path.join(D, "geodvf", f"{y}.csv")
        if not os.path.exists(f): open(f, "wb").write(get(f"https://files.data.gouv.fr/geo-dvf/latest/csv/{y}/communes/92/{C}.csv", js=False))
    print("geodvf ok", flush=True)
if "s1" in which:
    f = os.path.join(D, "s1.txt")
    if not os.path.exists(f):
        with zipfile.ZipFile(os.path.join(B, "dvf_brut", "s1.zip")) as zf, zf.open(zf.namelist()[0]) as fi, open(f, "w", encoding="utf-8") as o:
            for i, l in enumerate(io.TextIOWrapper(fi, encoding="utf-8", errors="replace")):
                p = l.split("|")
                if i == 0 or (p[18] == C[:2] and p[19] == str(int(C[2:]))): o.write(l)
    print("s1 ok", flush=True)
if "cerema" in which:
    os.makedirs(os.path.join(D, "cerema"), exist_ok=True)
    for y in range(2014, 2021):
        f = os.path.join(D, "cerema", f"{y}.geojson")
        if os.path.exists(f) and os.path.getsize(f) > 1000: continue
        u = f"https://apidf-preprod.cerema.fr/dvf_opendata/geomutations/?code_insee={C}&anneemut={y}&page_size=500"; feats = []
        while u:
            d = get(u.replace("http://", "https://")); feats += d["features"]; u = d["next"]; time.sleep(.3)
        json.dump({"type": "FeatureCollection", "features": feats}, open(f, "w")); print("cerema", y, len(feats), d.get("count"), flush=True)
if "dpe" in which:
    f = os.path.join(D, "dpe.csv")
    if not os.path.exists(f):
        sys.path.insert(0, os.path.join(B, "dpe")); import pandas as pd
        SEL = ["numero_dpe", "numero_dpe_remplace", "etiquette_dpe", "etiquette_ges", "date_etablissement_dpe", "date_fin_validite_dpe", "surface_habitable_logement",
               "type_batiment", "methode_application_dpe", "adresse_ban", "numero_voie_ban", "nom_rue_ban", "code_insee_ban", "identifiant_ban", "score_ban", "statut_geocodage",
               "_geopoint", "numero_etage_appartement", "complement_adresse_logement", "periode_construction", "adresse_brut"]
        u = "https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines?" + urllib.parse.urlencode({"size": 5000, "qs": f"code_insee_ban:{C}", "select": ",".join(SEL)})
        rows = []
        while u:
            j = get(u); rows += j["results"]; u = j.get("next") if j["results"] else None; print("dpe", len(rows), "/", j.get("total"), flush=True)
        pd.DataFrame(rows).reindex(columns=SEL).drop_duplicates("numero_dpe").to_csv(f, index=False)
    print("dpe ok", flush=True)
