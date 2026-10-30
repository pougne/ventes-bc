# Ventes DVF nettoyées : Bois-Colombes, quartier Bac, bande Flachat (+ couronne 92 et Paris à la demande)

Carte statique (Leaflet) des ventes DVF 2014 à juin 2026, publiée sur GitHub Pages : https://pougne.github.io/ventes-bc/

## Fichiers
- `index.html` : l’outil (tout le code client).
- `ventes.js` : données (`window.VENTES`), produit par `construire.py` (+ `dpe_joindre.py` pour le DPE ADEME).
- `annonces.js` + `annonces_calque.js` : calque facultatif des annonces en cours (localisation confirmée ou probable seulement), produit par `construire_annonces.py`.
- `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png` : application installable (PWA) et hors ligne.
- `ventes.csv`, `ventes.geojson`, `bilan.json` : exports.
- `tuiles/index.json` + `tuiles/<insee>.json` : autres communes, un fichier par commune (code INSEE), chargé seulement quand la carte affiche la commune (zoom 14 et plus, 15 et plus pour les arrondissements de Paris, plus denses, test sur le contour simplifié du registre). Communes : Neuilly (92051), Levallois (92044), Clichy (92024), Courbevoie (92026), Puteaux (92062), Suresnes (92073), Asnières hors périmètre de base (92004), Colombes hors frange (92025), La Garenne-Colombes (92035), Nanterre (92050). Paris : un fichier par arrondissement (75101 à 75120, contour officiel « arrondissement municipal » de geo.api.gouv.fr, cadastre Etalab et geo-dvf par arrondissement). Bois-Colombes reste dans `ventes.js` (zones tracées à la main) ; les ventes déjà dans `ventes.js` sont retirées des tuiles. Produit par `telecharger_commune.py <insee>` puis `construire_commune.py <insee>`.

## Tuiles communes (format)
- Registre `tuiles/index.json` : pour chaque commune, bbox, URL, nombre de ventes, tailles brute et gzip, version (cache-busting).
- `tuiles/<insee>.json` : format colonnaire (une liste par champ au lieu d'un objet par vente), adresses et parcelles en dictionnaires, positions et contours de parcelles en entiers (1e-6 °, delta-encodés), dates AAMMJJ ; €/m² et année recalculés côté client. Environ 70 octets par vente au lieu de 350 en GeoJSON.
- Zone = contour officiel de la commune (geo.api.gouv.fr), pas de tracé à la main. Bornes €/m² propres à la commune (table `COMS` de `construire_commune.py` : BC / Asnières / Colombes / La Garenne / Nanterre 2 000 à 12 000 ; Clichy, Courbevoie, Puteaux, Suresnes 2 500 à 15 000 ; Levallois 3 000 à 17 000 ; Neuilly 4 000 à 20 000 ; Paris 1er à 9e et 14e à 17e 5 000 à 28 000, autres arrondissements 3 500 à 22 000 ; maisons de 100 m² et plus tolérées plus haut).
- « € 2026 » et couleur relative : indices calculés par groupe (BC d'un côté, chaque commune de l'autre), BC n'est pas modifié par le chargement des communes.
- Lien partageable : zones des tuiles décochées dans `zx=` (une commune pas encore chargée reste visible par défaut).

## Fonctions
- Couleur des points : écart à la médiane €/m² de la zone (même type, fenêtre d’années, comparaison en € de l’année la plus récente), ou échelle absolue, ou DPE.
- Puce « Ici » en haut : médianes maisons / apparts de la zone visible (n.d. sous 10 ventes, n toujours affiché).
- Mode balade (🚶) : cercle de 100, 250 ou 500 m autour de ma position (ou du centre de la carte), nombre de ventes, médianes, fourchette 10 % à 90 %.
- Tiroir liste (bas de l’écran sur mobile, panneau flottant sur ordinateur) : ventes du rayon ou de la zone visible, tri date / €/m² / distance / DPE, tap = zoom + fiche, export CSV de la liste.
- Évolution par zone : courbe SVG des médianes annuelles 2014 à 2026 + nombre de ventes par an.
- Zoom 17 et plus : parcelles vendues teintées selon la dernière vente (pâles = vente remontée hors fenêtre).
- Prix en € 2026 : €/m² × (médiane annuelle 2026 / médiane de l’année de vente), même type ; par zone si au moins 30 ventes chaque année, sinon tout le périmètre. 2026 = premier semestre seulement.
- Fiche parcelle : liens DVF data.gouv (parcelle), Géorisques (point), recherche DPE ADEME (ou lien direct si `dpe_id` est exporté un jour), Street View.
- Lien partageable : l’état (années, types, zones, filtres, couleur, € 2026, balade, position, zoom) est dans le `#` de l’URL ; bouton « Copier le lien ».

## Hors ligne / écran d’accueil
Sur iPhone : Safari → Partager → « Sur l’écran d’accueil ». Sur Android : Chrome → menu → « Installer l’application ».
Le service worker (`sw.js`, actif en https uniquement) garde en cache la page, `ventes.js`, Leaflet et les tuiles déjà vues (400 max). Les fichiers communes (`tuiles/*.json`) ne sont pas préchargés : ils entrent en cache seulement après avoir été consultés.
Page et données : réseau d’abord, cache si pas de réseau. Pour forcer une mise à jour du cache après un gros changement, incrémenter `V` dans `sw.js`.
