# Plan 06 (session B) — Upload cohorte 1 + vérif live — DONE (2026-07-05)

## Résultat

Cohorte 1 (4 cours, 388 leçons) uploadée 100% API, **0 erreur**, comptes exacts,
rendue live sans régression (YouTube + text-only + deep nesting + images CDN). Commits
`2be3612` (fix) + ce done.

## Ce qui a été fait

### Upload cohorte 1
`import_all.py --only 167a7888 --only 3dda44a2 --only 9376603b --only c99d54b4 --sleep-ms 300` :

| key | cours | sec | les | loom | yt | none | imgCdn | err |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 167a7888 | Resource Library | 9 | 147 | 16 | 99 | 32 | 1 | 0 |
| 3dda44a2 | Automation Tutorials | 5 | 51 | 39 | 0 | 12 | 1 | 0 |
| 9376603b | Month 1 | 32 | 107 | 14 | 0 | 93 | 40 | 0 |
| c99d54b4 | Month 2 | 32 | 83 | 78 | 1 | 4 | 4 | 0 |
| **TOTAL** | 4 cours | **78** | **388** | **147** | **100** | **141** | **141** | **0** |

Comptes vérifiés via l'API (`GET /api/courses/{id}`) : lessons 147/51/107/83 = exacts,
sections 9/5/32/32, tous `progression_mode=free`.

### Blocker rencontré + fix at-source — rate limiter 429 (commit `2be3612`)
Le premier run a échoué (366 erreurs) : le LMS a un rate limiter **100 req/min par IP**
sur le path partagé `POST /api/classes` (`backend/middleware/rateLimit.js`). La couche
retry ne gérait que 5xx/timeout, pas 429. **Fix** : `_req` back-off sur 429 (respecte
`Retry-After`, jusqu'à 12 attentes) → self-pace au débit autorisé. Re-run idempotent →
0 erreur. (Les PATCH `/api/classes/{id}` ont un path unique par id → jamais limités ;
seul le POST collection est le goulot.)

### Vérif live (§ PLAN FRONTEND DONE)

**Resource Library** (`course_0e147351…`) :
- Leçon YouTube (step 26 « Monthly Community Call #1 ») → `<iframe data-provider="youtube"
  src="youtube.com/embed/6vL7PgLe19w">` rend (path YouTube validé end-to-end via le
  VideoProvider hexa du Plan 01).
- Leçon text-only (step 1) → texte rend, pas de lecteur vidéo fantôme.

**Month 1** (`course_6b2f399e…`) :
- Arbre **32 sections** rendu (« About & how to use », « Day 1 »…« Day 31 ») + 107 leçons.
- Leçon riche en images (step 13 « 3. Create Upwork profile ») → **17 images, toutes via
  Skool CDN** (`assets.skool.com`, toutes `complete`, 234–1440px). Texte 17 KB.

**0 erreur console** sur tous les steps testés, fresh + reload.

### Gates
- `pytest test_asset_urls.py` 4/4. Upload idempotent (re-run PATCH only).

## Fichiers

- `scripts/skool-import/import_course.py` (`_req` 429 backoff) — commit `2be3612`.
- Aucun autre code (consomme l'importer du Plan 05).

## Suite

Prêt pour **07 (session C)** — upload cohorte 2 (Month 3-6, Building Wealth, Building a
Brand, ~308 leçons Loom-heavy + bonus). Après 07, les 11 cours non-vides seront dans tpb-lms.
