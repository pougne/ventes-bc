# Ventes DVF nettoyées : Bois-Colombes, quartier Bac, bande Flachat

Carte statique (Leaflet) des ventes DVF 2014 à juin 2026, publiée sur GitHub Pages : https://pougne.github.io/ventes-bc/

## Fichiers
- `index.html` : l’outil (tout le code client).
- `ventes.js` : données (`window.VENTES`), produit par `construire.py` (+ `dpe_joindre.py` pour le DPE ADEME).
- `annonces.js` + `annonces_calque.js` : calque facultatif des annonces en cours (localisation confirmée ou probable seulement), produit par `construire_annonces.py`.
- `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png` : application installable (PWA) et hors ligne.
- `ventes.csv`, `ventes.geojson`, `bilan.json` : exports.

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
Le service worker (`sw.js`, actif en https uniquement) garde en cache la page, `ventes.js`, Leaflet et les tuiles déjà vues (400 max).
Page et données : réseau d’abord, cache si pas de réseau. Pour forcer une mise à jour du cache après un gros changement, incrémenter `V` dans `sw.js`.
