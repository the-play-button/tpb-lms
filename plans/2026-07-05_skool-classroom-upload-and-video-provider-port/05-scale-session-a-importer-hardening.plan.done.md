# Plan 05 (session A) — Durcissement importer + assets self-contained — DONE (2026-07-05)

## Résultat

Importer durci + batch driver, validés par un **dry-run propre des 11 cours**
(totaux exacts, 0 erreur, 0 image non-mappée) + le **re-import live du POC** avec
images via URL CDN. Aucun upload de masse (POC uniquement). Commit `dd2bd62`.

## Ce qui a été fait

### 1. `_asset_urls.py` (nouveau) + `test_asset_urls.py` (4 pytest verts)
Reverse-map `asset_url_to_local.json` (`cdn_url → local_path`) → résout un ref image
relatif markdown vers l'**URL Skool CDN publique** (vérifiée HTTP 200 sans auth, 132 KB).
Retourne `None` si l'asset n'est pas dans la map (l'appelant décide, jamais de fabrication
d'URL — § ALWAYS FAIL HARD).

### 2. `import_course.py` (refactor)
- **Images → URL CDN** : `rewrite_images_to_cdn` remplace le data-URI base64 (dette POC :
  leçon 6 passait de ~179 KB à ~2 KB de `content_md`). Un ref non-mappé est **laissé
  visible avec WARNING**, jamais droppé.
- **`classify_video`** : loom | youtube | other | None (miroir `parseMediaUrl` frontend).
- **Mapping robuste par slug** : `align()` slug-matche les sets↔dirs et modules↔fichiers,
  avec fallback ordre + log. **Corrige les 2 cours bonus** (Building Wealth / Building a
  Brand) dont le disque a un dossier `01_about-how-to-use` sans set correspondant dans
  l'arbre → l'ancien mapping par index était décalé (tree=2 sets ↔ disk=3 dirs). Le
  slug-match rattache « Principles » → `02_principles`, « Personal finance » →
  `03_personal-finance`, et ignore le dossier `about`.
- **Throttle + retry** (2×) sur erreurs transitoires (timeout / 5xx), `--sleep-ms`.
- **`import_one_course(...)` importable** retournant un report structuré.
- Faux-positif « ordinal drift » ($5,500 → `_lead_num` grabbait « 5 » vs fichier « 5500 »)
  supprimé (remplacé par le slug-match + count implicite).

### 3. `import_all.py` (nouveau)
Batch driver : walk les course keys (skip auto les cours vides), `--dry-run` / `--only` /
`--skip` / `--from` / `--sleep-ms` / `--progression-mode`, tableau de report agrégé.

### 4. `README.md` (nouveau)
Doctrine self-contained + usage + idempotence/robustesse.

## Validation

### Dry-run des 11 cours (totaux = umbrella, exacts)
```
key       course                  sec  les loom  yt oth none imgC imgU warn err
ab5cf4d1  Pre-Program               3   15   15   0   0    0    1    0    0   0
167a7888  Resource Library          9  147   16  99   0   32    1    0    3   0
3dda44a2  Automation Tutorials      5   51   39   0   0   12    1    0    0   0
9376603b  Month 1                  32  107   14   0   0   93   40    0    0   0
c99d54b4  Month 2                  32   83   78   1   0    4    4    0    0   0
a6afd77f  Month 3                  32   62   56   0   0    6    2    0    0   0
db24b2b4  Month 4                  32   98   98   0   0    0    0    0    0   0
4bdb7bc2  Month 5                  32   97   97   0   0    0    0    0    0   0
bd0b6818  Month 6                   9   24    0   0   0   24    7    0    0   0
d4455aa2  Building Wealth           2   11    0   0   0   11   14    0    0   0
3b373ec8  Building a Brand          2   16    0   0   0   16   31    0    0   0
TOTAL                             190  711  413 100   0  198  101    0    3   0
```
- Totaux **exacts** vs l'umbrella (190 sec / 711 les / 413 loom / 100 yt / 198 no-vid).
- **0 erreur · 0 image non-mappée** (101 images résolues en URL CDN).
- **3 warnings** résiduels, tous « matched by ORDER » sur Resource Library : le titre de
  l'arbre et le nom de fichier divergent dans la data source (« What is all of this? » ↔
  `the-content-explained.md`), le fallback ordre atterrit sur le fichier **position-correct**.
  Bénin (pas une erreur de mapping).

### POC re-importé (images via CDN) + live (§ PLAN FRONTEND DONE)
- `import_all.py --only ab5cf4d1` → 0 erreur.
- tpb-browser, leçon 6 : `<img src="https://assets.skool.com/f/6a13d5c6…">` (isCdn=true,
  naturalWidth 1440, complete) — **plus de data-URI**. Loom embed + texte 2386c intacts.
  **0 erreur console** (fresh + deep-link).

### Gates
- `pytest test_asset_urls.py` 4/4 · entropy RATCHET OK.

## Fichiers

- `scripts/skool-import/_asset_urls.py` + `test_asset_urls.py` (nouveaux)
- `scripts/skool-import/import_course.py` (refactor)
- `scripts/skool-import/import_all.py` + `README.md` (nouveaux)

## Suite

Prêt pour **06 (session B)** — upload cohorte 1 (Resource Library, Automation Tutorials,
Month 1, Month 2). Commit `dd2bd62`.
