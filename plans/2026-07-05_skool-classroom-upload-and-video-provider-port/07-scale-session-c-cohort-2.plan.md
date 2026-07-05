# Plan 07 (session C) — Upload cohorte 2 + vérif live (Session C)

## Contexte

Cohorte 1 uploadée + validée (04b). Uploader la **cohorte 2** — les mois Loom-heavy +
les bonus text-only.

Cohorte 2 (~308 leçons) :
- Month 3 (a6afd77f) — 62 leçons, 56 Loom.
- Month 4 (db24b2b4) — 98 leçons, **98 Loom** (100%).
- Month 5 (4bdb7bc2) — 97 leçons, **97 Loom** (100%).
- Month 6 (bd0b6818) — 24 leçons, text-only (0 vidéo).
- Building Wealth (d4455aa2) — 11 leçons, text-only.
- Building a Brand (3b373ec8) — 16 leçons, text-only.

## Objectif

Cohorte 2 uploadée 100% API (idempotent), rendue live sans régression. Après 04c, les
11 cours non-vides sont dans tpb-lms.

## Étapes

### 1. Dry-run ciblé
`import_all.py --dry-run --only a6afd77f --only db24b2b4 --only 4bdb7bc2 --only bd0b6818 --only d4455aa2 --only 3b373ec8`
→ compteurs = umbrella, 0 erreur de mapping.

### 2. Upload réel
Même commande sans `--dry-run` (throttle actif). Reporting par cours.

### 3. Vérif live (§ PLAN FRONTEND DONE) — 2 cours
tpb-browser sur `lms-viewer` :
- **Month 4** (98 Loom) : arbre complet, une leçon Loom joue, texte rend.
- **Building Wealth** (text-only bonus) : leçons sans vidéo → texte propre, pas de lecteur fantôme.
- Nav libre, 0 erreur console, fresh + reload.

## Fichiers

- Aucun code nouveau (consomme 04a). Rapport intermédiaire dans le done.md.

## Critères

- 6 cours cohorte 2 uploadés, compteurs = umbrella, idempotent.
- Les 11 cours non-vides présents dans tpb-lms après cette session.
- Live : Loom-heavy month OK, bonus text-only propre, 0 erreur console.

## Risques

- **Volume Loom** (Month 4/5 = 195 leçons Loom) : throttle + idempotence ; sweep privés
  reporté à 04d (ici on upload, on ne bloque pas sur un éventuel privé).
