# Plan 04 (umbrella) — Scale aux 11 cours, self-contained, décomposé en A/B/C/D

## Contexte

POC (Plan 03) validé + UAT utilisateur OK. Scaler le pipeline aux **11 cours** de
Maker School (Life Optimization = WIP vide → skip). Chiffres exacts (comptés depuis
`_raw/course_trees.json`) :

| Cours | key | sections | leçons | Loom | YouTube | sans-vidéo |
|---|---|---:|---:|---:|---:|---:|
| Pre-Program: Start Here | ab5cf4d1 | 3 | 15 | 15 | 0 | 0 | *(DONE Plan 03)* |
| Resource Library | 167a7888 | 9 | 147 | 16 | 99 | 32 |
| Automation Tutorials | 3dda44a2 | 5 | 51 | 39 | 0 | 12 |
| Month 1 | 9376603b | 32 | 107 | 14 | 0 | 93 |
| Month 2 | c99d54b4 | 32 | 83 | 78 | 1 | 4 |
| Month 3 | a6afd77f | 32 | 62 | 56 | 0 | 6 |
| Month 4 | db24b2b4 | 32 | 98 | 98 | 0 | 0 |
| Month 5 | 4bdb7bc2 | 32 | 97 | 97 | 0 | 0 |
| Month 6 | bd0b6818 | 9 | 24 | 0 | 0 | 24 |
| Building Wealth (Bonus) | d4455aa2 | 2 | 11 | 0 | 0 | 11 |
| Building a Brand (Bonus) | 3b373ec8 | 2 | 16 | 0 | 0 | 16 |
| Life Optimization (WIP) | 2d7de359 | 0 | 0 | 0 | 0 | 0 | *(skip — vide)* |
| **TOTAL** | | **190** | **711** | **413** | **100** | **198** |

## Décision d'architecture — 100% self-contained, zéro ré-hébergement

Cohérent avec la décision « pas de ré-hébergement vidéo » : **rien n'est ré-hébergé**.

| Contenu | Source | Hébergement |
|---|---|---|
| Structure (cours/sections/leçons) | `course_trees.json` | tpb-lms D1 (via API) |
| Texte de leçon | `classroom/**/*.md` (header strippé) | inline `content_md` (D1) |
| Vidéos (Loom + YouTube) | `videoLink` | embed direct (URL publique) |
| Cover de cours | `course.coverImage` | URL Skool CDN publique |
| Images de corps | `asset_url_to_local.json` reverse-map | **URL Skool CDN publique** |

Skool CDN vérifié public (HTTP 200 sans auth) sur cover **et** image de corps.
Le data-URI base64 du POC est **remplacé** par l'URL CDN (04a) — pas de bloat D1,
scale à 900 leçons. **Tradeoff assumé** (identique aux vidéos Loom) : si une URL CDN
Skool rot un jour, l'asset se casse — même risque que les embeds Loom, accepté par
la doctrine « référence les URLs publiques, ne ré-héberge pas ».

## Décomposition — 4 sessions (plans 05→08)

### 05 (session A) — Durcissement importer + assets self-contained (CODE, pas d'upload de masse)
- Images relatives → URL Skool CDN via reverse-map `asset_url_to_local.json` (remplace
  le data-URI). Fallback fail-loud si un asset n'est pas dans la map.
- Path **YouTube** validé (99 leçons Resource Library) — media VIDEO url youtube.
- Mapping **tree↔disk robuste** (Month 1 = 32 sections) : match par slug + fallback ordre,
  log les mismatches. Dry-run des 11 cours → 0 erreur de mapping.
- Throttle + retry transitoire + reporting structuré par cours.
- `scripts/skool-import/import_all.py` (batch driver : `--dry-run`, `--only`, `--skip`,
  `--from`, skip auto des cours vides).
- Re-import du POC (images via CDN) + **vérif live** (§ PLAN FRONTEND DONE).

### 06 (session B) — Upload cohorte 1 + vérif live
Resource Library, Automation Tutorials, Month 1, Month 2 (~388 leçons — stress-test
YouTube + text-only + deep nesting). Vérif live 2 cours.

### 07 (session C) — Upload cohorte 2 + vérif live
Month 3, Month 4, Month 5, Month 6, Building Wealth, Building a Brand (~308 leçons —
Loom-heavy + bonus). Vérif live 2 cours.

### 08 (session D) — Sweep + bilan + finalisation
- Sweep oEmbed des 413 Loom (+ 100 YT) → ratio public/privé, fallback lien-only documenté.
- Idempotence : 2e run global = 0 création.
- Vérif live : 11 cartes Classroom, échantillon rendu.
- Bilan `_evidence/scale-report.md`.

## Critères d'ensemble

- 11 cours + 711 leçons uploadés **100% API, zéro push externe**, idempotent.
- Assets (cover + corps) via URL Skool CDN publique ; vidéos embed ; texte inline.
- Live : 11 cartes Classroom, échantillon (texte/images/vidéos) rendu, 0 erreur console.
- Tous cours en nav `free`. Loom privés (si présents) en fallback lien-only documenté.
