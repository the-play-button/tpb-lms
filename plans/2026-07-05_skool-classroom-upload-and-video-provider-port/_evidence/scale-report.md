# Scale report — Nick Saraev « Maker School » → tpb-lms

**Date** : 2026-07-05 · **Initiative** : `2026-07-05_skool-classroom-upload-and-video-provider-port`

## Résultat global

Les **11 cours non-vides** de Maker School sont uploadés dans tpb-lms **100% via l'API,
self-contained, zéro ré-hébergement, zéro erreur, idempotent**. (Life Optimization (WIP) =
0 leçon → skippé.)

| Métrique | Valeur |
|---|---:|
| Cours | 11 |
| Sections | 190 |
| Leçons | 711 |
| Vidéos Loom (embed direct) | 413 |
| Vidéos YouTube (embed direct) | 100 |
| Leçons text-only (sans vidéo) | 198 |
| Refs images → URL Skool CDN | 101 |
| Refs images non-mappées | 0 |
| Erreurs d'upload | 0 |

## Détail par cours

| key | cours | sections | leçons | loom | youtube | text-only | img CDN |
|---|---|---:|---:|---:|---:|---:|---:|
| ab5cf4d1 | Pre-Program: Start Here | 3 | 15 | 15 | 0 | 0 | 1 |
| 167a7888 | Resource Library | 9 | 147 | 16 | 99 | 32 | 1 |
| 3dda44a2 | Automation Tutorials | 5 | 51 | 39 | 0 | 12 | 1 |
| 9376603b | Month 1 | 32 | 107 | 14 | 0 | 93 | 40 |
| c99d54b4 | Month 2 | 32 | 83 | 78 | 1 | 4 | 4 |
| a6afd77f | Month 3 | 32 | 62 | 56 | 0 | 6 | 2 |
| db24b2b4 | Month 4 | 32 | 98 | 98 | 0 | 0 | 0 |
| 4bdb7bc2 | Month 5 | 32 | 97 | 97 | 0 | 0 | 0 |
| bd0b6818 | Month 6 | 9 | 24 | 0 | 0 | 24 | 7 |
| d4455aa2 | Building Wealth (Bonus) | 2 | 11 | 0 | 0 | 11 | 14 |
| 3b373ec8 | Building a Brand (Bonus) | 2 | 16 | 0 | 0 | 16 | 31 |
| **TOTAL** | | **190** | **711** | **413** | **100** | **198** | **101** |

Comptes vérifiés via `GET /api/courses/{id}` pour les 11 cours (leçons + sections + `progression_mode=free`).

## Architecture (self-contained, zéro ré-hébergement)

| Contenu | Source | Hébergement |
|---|---|---|
| Structure | `course_trees.json` | tpb-lms D1 (API) |
| Texte de leçon | `classroom/**/*.md` (header strippé) | inline `content_md` (D1), rendu inline par le viewer |
| Vidéos (Loom + YouTube) | `videoLink` | embed direct (URL publique, VideoProvider hexa) |
| Cover + images de corps | `coverImage` + `asset_url_to_local.json` reverse-map | **URL Skool CDN publique** |

## Sweep vidéos — 513/513 publiques

`sweep_videos.py` (oEmbed) sur les 513 vidéos → `_evidence/video-sweep.json` :

| Provider | Public | Privé/indisponible | Erreur probe |
|---|---:|---:|---:|
| Loom | **413** | 0 | 0 |
| YouTube | **100** | 0 | 0 |

**Zéro vidéo privée/DRM** → aucun fallback lien-only nécessaire. La stratégie « embed direct,
pas de re-host » couvre 100% du catalogue.

## Idempotence

Re-import de Building Wealth (2e run) → **11 leçons / 2 sections inchangés** (ids déterministes
`course_/sec_/les_<skoolid>` + `INSERT OR IGNORE` → zéro doublon). Tout re-run est safe.

## Robustesse (durcissements découverts au scale)

- **Slug-matching** sections/leçons ↔ disque (fallback ordre) — a corrigé les 2 cours bonus
  dont le disque a un dossier `about` sans set dans l'arbre (Plan 05).
- **Backoff 429** respectant `Retry-After` — le LMS limite `POST /api/classes` à 100/min par
  IP ; le premier run cohorte 1 avait échoué à 366 erreurs, corrigé at-source (Plan 06).
- **Images non-mappées** laissées visibles (jamais droppées) — quantifié à 0 sur tout le catalogue.

## Vérif live (§ PLAN FRONTEND DONE)

- **11 cartes Classroom** listées (+ 2 cours TPB préexistants).
- Échantillon ouvert : Pre-Program (Loom + image), Resource Library (**YouTube joue**, text-only),
  Month 1 (**32 sections**, 17 images CDN sur une leçon), Month 4 (Loom-heavy), Building Wealth
  (text-only, section « Principles » slug-fixée). **0 erreur console**, fresh + reload.

## Limitation connue (non-régression)

Le viewer liste les cours en **texte** dans « MON PARCOURS » — il ne rend pas la cover dans la
liste (le `coverImage` est stocké en media IMAGE, dispo pour une future vue grille-cover). Ce
n'est pas une régression (la classroom était déjà une liste texte) ; les 11 cours sont listés
et ouvrables, et à l'ouverture tout rend (texte + images CDN + vidéos).

## Doctrine

Gating futur d'un cours (ex : Maker School derrière un entitlement) = flip `progression_mode`
via l'API (Plan 02) + gate d'accès bastion — **zéro refacto**. Le port vidéo hexa (Plan 01)
rend l'ajout d'un provider (Vimeo/Wistia via player.js) trivial.
