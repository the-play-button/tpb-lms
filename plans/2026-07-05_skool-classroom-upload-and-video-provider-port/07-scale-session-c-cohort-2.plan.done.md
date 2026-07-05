# Plan 07 (session C) — Upload cohorte 2 + vérif live — DONE (2026-07-05)

## Résultat

Cohorte 2 (6 cours, 308 leçons) uploadée 100% API, **0 erreur, 0 attente rate-limit**
(le throttle `--sleep-ms 300` + backoff 429 du Plan 06 a tenu sous la limite), comptes
exacts, rendue live sans régression. **Les 11 cours non-vides sont désormais dans tpb-lms.**

## Ce qui a été fait

### Upload cohorte 2
`import_all.py --only a6afd77f --only db24b2b4 --only 4bdb7bc2 --only bd0b6818 --only d4455aa2 --only 3b373ec8 --sleep-ms 300` :

| key | cours | sec | les | loom | none | imgCdn | err |
|---|---|---:|---:|---:|---:|---:|---:|
| a6afd77f | Month 3 | 32 | 62 | 56 | 6 | 2 | 0 |
| db24b2b4 | Month 4 | 32 | 98 | 98 | 0 | 0 | 0 |
| 4bdb7bc2 | Month 5 | 32 | 97 | 97 | 0 | 0 | 0 |
| bd0b6818 | Month 6 | 9 | 24 | 0 | 24 | 7 | 0 |
| d4455aa2 | Building Wealth | 2 | 11 | 0 | 11 | 14 | 0 |
| 3b373ec8 | Building a Brand | 2 | 16 | 0 | 16 | 31 | 0 |
| **TOTAL** | 6 cours | **109** | **308** | **251** | **57** | **54** | **0** |

Comptes vérifiés via l'API : lessons 62/98/97/24/11/16 = **exacts**, sections
32/32/32/9/2/2, tous `progression_mode=free`. 0 warning (le slug-matching du Plan 05
a résolu proprement les 2 bonus).

### Vérif live (§ PLAN FRONTEND DONE)

**Month 4** (`course_233136fb…`, 98 Loom) :
- Arbre 98 leçons, step 1 « 1. More of what works » → `<iframe data-provider="loom"
  data-loom-id="7d050366…">` rend + texte. Loom-heavy month OK.

**Building Wealth** (`course_46479cbf…`, bonus text-only, cours slug-fixé Plan 05) :
- step 1 « Money over time » sous la section **« Principles »** → le slug-matching a bien
  rattaché le contenu (dossier `02_principles`, pas le `01_about` vide). Texte rend
  (5337c), **aucun lecteur vidéo fantôme** (`anyVideoIframe=false`) — text-only propre.

**0 erreur console** sur tous les steps testés.

### Gates
- Upload idempotent. Comptes API exacts pour les 6 cours.

## Fichiers

- Aucun code nouveau (consomme l'importer durci des Plans 05-06).

## État après cette session

**11 / 11 cours non-vides uploadés** (Pre-Program + cohorte 1 + cohorte 2 ;
Life Optimization = WIP vide, skippé). Prêt pour **08 (session D)** — sweep vidéos
(413 Loom + 100 YT), idempotence globale, vérif 11 cartes Classroom, bilan `_evidence/`.
