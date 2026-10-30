# Carte des ventes immobilières — Bois-Colombes

Carte Leaflet des ventes de maisons et d’appartements à Bois-Colombes : quartier Bac, ouest de la mairie, frange Agnettes et reste de la commune. Un point = une parcelle ; le clic affiche son historique (prix, surface, €/m²).

**Adresse du site :** https://pougne.github.io/ventes-bc/

## Usage

Ouvrir le lien ci-dessus, sur ordinateur ou sur téléphone. Sur mobile, **☰ Filtres** ouvre le panneau (années, type, zone, surface, fourchette €/m², neuf VEFA, clusters, heat map). **◎ Ma position** recentre la carte (la géolocalisation demande une page en HTTPS). Une ligne de la liste zoome sur la vente. **Exporter CSV** télécharge uniquement les ventes filtrées.

## Données

Jeu nettoyé (une maison ou un appartement par vente, doublons et prix aberrants retirés), embarqué dans `ventes.js`. Bilan du 30/10/2026 : 11 642 ventes, 2014–2025 (`bilan.json`).

Sources en **Licence Ouverte** :

- **DVF** (DGFiP), via geo-dvf (Etalab), années 2021–2025
- **DVF+** open data (Cerema), années 2014–2020

2010–2013 ne sont pas publiées en open data. Le fond de carte est © OpenStreetMap.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` | Page de la carte |
| `ventes.js` | Données lues par la page |
| `ventes.csv` | Même export, pour un tableur |
| `bilan.json` | Métadonnées du jeu |
| `construire.py` | Régénération des fichiers (pipeline locale) |

`construire.py` dépend du projet d’origine (`zones_geo`, CSV et GeoJSON DVF). Il ne se relance pas depuis ce dépôt seul.
