# Demi-fond EPS

Une seule application qui réunit trois outils :

| Dossier | Outil | Ancienne adresse |
|---|---|---|
| `scan/` | Scan CCF | demi-fond-scan-cff.vercel.app |
| `video/` | PhotoFinish (vidéo) | eps-barletta.github.io/VideoEPS |
| `chrono/` | Chrono Carnet | chrono-carnet-eps.vercel.app |

- `/` : accueil professeur (les 3 outils + QR code pour les élèves)
- `/eleve/` : espace élève (Chrono Carnet + carnet de suivi carnetentrainementv2.vercel.app)
- Un bouton maison en bas à gauche de chaque outil ramène à l'accueil (ou à l'espace élève).

Chaque outil garde son propre fonctionnement hors ligne et ses propres données.

## Déploiement
Site statique : importer le dépôt dans Vercel, sans réglage (pas de commande de build).
