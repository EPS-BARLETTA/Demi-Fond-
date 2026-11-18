# Demi-fond EPS

Une seule application, de la classe à la note.

## Le parcours (accueil)
1. **Mes classes** : la classe est créée une seule fois (CSV PRONOTE, ou liste collée « NOM Prénom F/G »).
   Elle est recopiée automatiquement dans Scan CCF, PhotoFinish et ScanDocument.
   Les classes qui existaient déjà dans un outil peuvent être reprises d'un toucher.
2. **Nouvelle séance** : classe → épreuve (entraînement, CCF 2 × 800, examen 3 × 500) → qui relève les temps
   (élèves sur iPad, fiches papier, ou vidéo), avec en option « filmer aussi l'arrivée ».
3. **Les étapes s'affichent dans l'ordre** et chaque bouton ouvre le bon outil au bon écran :
   - iPad : Chrono Carnet dans le bon mode → QR de séance (avec la liste de la classe : chaque élève choisit son nom) → scan des QR dans Scan CCF (séance déjà créée) → résultats et notes.
   - Papier : impression des fiches (classe et fiche déjà choisies) → photo des fiches → résultats et notes.
   - Vidéo : PhotoFinish sur la bonne classe → classement.
4. **Contrôle des temps** (si l'arrivée est filmée, ou 2 × 800 sur fiches) : temps du QR élève ou de la fiche ↔ arrivée PhotoFinish à 2 s près, avec la photo d'arrivée ; estimation écrite sur la fiche ↔ estimation annoncée (notée dans Scan CCF via l'écran « Estimations annoncées »). Imprimable en PDF.
5. **Trombinoscope** : à la création de la classe, une capture du trombinoscope PRONOTE ajoute les photos (ou crée la liste). Un élève sans photo reste dans la liste.
6. Un bouton en bas à gauche de chaque outil ramène aux étapes de la séance.

## Dossiers
| Dossier | Outil |
|---|---|
| `scan/` | Scan CCF (DemiFond_Scan_CFF) |
| `chrono/` | Chrono Carnet |
| `docs/` | ScanDocument EPS (fiches papier) |
| `video/` | PhotoFinish (VideoEPS) |
| `eleve/` | espace élève (Chrono Carnet + carnet de suivi) |
| `hub/` | accueil : classes partagées, séance guidée, liste des élèves dans le QR Chrono |

Chaque outil garde son fonctionnement hors ligne et ses propres données ; l'accueil ne fait que les relier.

## Déploiement
Site statique : importer le dépôt dans Vercel, sans réglage.
