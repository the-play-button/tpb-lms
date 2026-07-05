# Plan 06 (session B) — Upload cohorte 1 + vérif live (Session B)

## Contexte

Importer durci + validé en dry-run (04a). Uploader la **cohorte 1** — les cours qui
stressent le plus les chemins non couverts par le POC (YouTube, text-only, deep nesting).

Cohorte 1 (~388 leçons) :
- Resource Library (167a7888) — 147 leçons, **99 YouTube** + 32 text-only.
- Automation Tutorials (3dda44a2) — 51 leçons, 39 Loom + 12 text-only.
- Month 1 (9376603b) — 107 leçons, **32 sections** (deep nesting) + 93 text-only.
- Month 2 (c99d54b4) — 83 leçons, 78 Loom.

## Objectif

Cohorte 1 uploadée 100% API (idempotent), rendue live sans régression.

## Étapes

### 1. Dry-run ciblé
`import_all.py --dry-run --only 167a7888 --only 3dda44a2 --only 9376603b --only c99d54b4`
→ compteurs = umbrella, 0 erreur de mapping, imgUnmapped quantifié.

### 2. Upload réel
`import_all.py --only 167a7888 --only 3dda44a2 --only 9376603b --only c99d54b4`
(throttle actif). Reporting : sections/leçons/loom/youtube/imgCdn créés par cours.

### 3. Vérif live (§ PLAN FRONTEND DONE) — 2 cours
tpb-browser sur `lms-viewer` :
- **Resource Library** : ouvrir une leçon **YouTube** → l'embed YouTube joue ; une leçon
  text-only → texte rend, pas de lecteur vidéo fantôme.
- **Month 1** : arbre 32 sections déplié correctement ; une leçon avec image → rend via CDN.
- Nav libre (free), 0 erreur console, fresh + reload.

### 4. Compteurs
Vérifier via `GET /api/courses` (ou course detail) que chaque cours a le bon nb de leçons.

## Fichiers

- Aucun code nouveau (consomme 04a). Rapport intermédiaire dans le done.md.

## Critères

- 4 cours cohorte 1 uploadés, compteurs = umbrella, idempotent.
- Live : YouTube joue, text-only propre, deep nesting Month 1 OK, images CDN, 0 erreur console.

## Risques

- **YouTube embed** : path non couvert par le POC — c'est LE point à valider ici.
- **32 sections Month 1** : rendu de l'arbre profond à confirmer visuellement.
