# Demi-fond EPS

À installer sur l’écran d’accueil de l’iPad (Safari : Partager, puis « Sur l’écran d’accueil ») : l’appli installée s’ouvre en plein écran et a sa propre mémoire, séparée des autres applis de eps-barletta.github.io.

Tout se passe dans une seule fenêtre : une barre en haut (Séance, Classes, Outils). Les outils s’ouvrent sous une barre « ‹ Séance · Étape n sur N · Étape suivante » et restent ouverts en arrière-plan (une course PhotoFinish en cours n’est pas perdue).

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

## Fille / garçon
À l’import (liste sans colonne Sexe, trombinoscope), le sexe est déduit du prénom quand il est sans ambiguïté (`hub/prenoms.js`). Pour les prénoms mixtes ou inconnus, l’appli demande au professeur avant d’enregistrer la classe.

## Trombinoscope
Les photos sont rattachées aux élèves de la liste par le nom lu sous la photo, sinon dans l’ordre alphabétique (ordre du trombinoscope PRONOTE). Un écran « Vérifie les photos » permet de corriger chaque photo.

## Mémoire
Scan CCF garde ses copies de secours (3 versions + avant import) dans IndexedDB et non plus dans localStorage. L’onglet Outils affiche la mémoire utilisée par chaque outil.

## Séance libre (entraînement)

Dans « Nouvelle séance », **Séance libre** : l'enseignant écrit ses courses (`4x100`, `500 1000 500`, `1000`…) et, s'il veut, un temps de passage tous les … m.

- **Sur iPad** : Chrono Carnet s'ouvre déjà réglé sur ces courses ; le contrôle compare chaque course à PhotoFinish (2 s).
- **Sur fiche** : on choisit la fiche à imprimer, soit une fiche faite automatiquement avec les courses (une partie par course, passages cumulés, ligne « Estimation » en option, aperçu dans l'assistant), soit une fiche de ScanDocument (Mission 1000 pour les 6e, 3 × 500, 2 × 800, ou les fiches créées par l'enseignant). Pour un 1000 m avec passage à 500 m, la fiche Mission 1000 (S5 · S6) est proposée d'office.
