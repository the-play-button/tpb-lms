# Plan 05 (session A) — Durcissement importer + assets self-contained (Session A)

## Contexte

Le POC (Plan 03) a prouvé le pipeline sur `01_pre-program-start-here` (15 leçons,
tout Loom), mais avec deux dettes à lever avant le scale :

1. **Images inlinées en data-URI** (leçon 6 = ~179 KB de `content_md`) — ne scale pas.
   Fix : référencer l'**URL Skool CDN publique** via reverse-map `asset_url_to_local.json`
   (vérifié HTTP 200 sans auth sur cover ET image de corps).
2. **Path YouTube non exercé** (le POC est 100% Loom ; Resource Library a 99 YouTube).
3. **Mapping tree↔disk par ordre** non validé sur les cours à nesting profond
   (Month 1 = 32 sections).

Cette session durcit le code (robuste + élégant) et le valide **sans upload de masse**
(seul le POC est re-importé pour prouver le nouvel arbre bout-en-bout).

## Objectif

Un importer robuste + un batch driver `import_all.py`, prouvés par un **dry-run propre
des 11 cours** (0 erreur de mapping) + le **re-import live** du POC avec images via CDN.

## Étapes

### 1. Helper résolution d'assets — `scripts/skool-import/_asset_urls.py`
- Charge `_raw/asset_url_to_local.json` (413 entrées `cdn_url → local_path`).
- Construit le reverse-map `local_path → cdn_url` (normalisé : clé = chemin relatif
  `assets/…` tel que stocké comme valeur).
- `resolve_asset_url(local_ref, md_path, data_root) -> str | None` : résout un ref
  relatif markdown (`../../../assets/skool/X.jpg`) vers le chemin `assets/…` puis vers
  l'URL CDN. Retourne `None` si absent de la map (fail-loud côté appelant, § ALWAYS FAIL HARD).
- Tests unitaires (pytest) : reverse-map, résolution d'un ref relatif POC → URL CDN attendue,
  ref absent → None.

### 2. `import_course.py` — remplacer data-URI par URL CDN
- `inline_relative_images` → `rewrite_images_to_cdn(md, md_path)` : pour chaque ref image
  relative, `resolve_asset_url(...)` ; si URL trouvée → réécrit `![alt](cdn_url)` ;
  si `None` → **log WARNING explicite** (`! asset not in map: <ref>`) + laisse le ref
  tel quel (visible, pas masqué). Compteur `n_img_cdn` / `n_img_unmapped`.
- Supprimer entièrement la branche base64 data-URI (dette POC).
- Vidéos : classer `videoLink` (loom | youtube | autre) via une petite fonction locale
  cohérente avec `parseMediaUrl` frontend ; media `{type:'VIDEO', url, name}`. YouTube et
  Loom passent tous deux (le frontend résout le provider). Compteur `loom` / `youtube` / `other`.

### 3. Mapping tree↔disk robuste
- Aujourd'hui : `md_files[mi]` par index. Durcir : construire pour chaque section un
  matching `module → md_file` par **slug** (dérivé du titre) avec fallback ordre si le
  slug ne matche pas. Logguer tout mismatch (`! module '<t>' no md match, fallback order[i]`).
- Section dir mapping : par ordre (déjà) mais logguer si `len(section_dirs) != len(sets)`.
- Ne jamais crasher sur un `.md` manquant : leçon créée sans `content_md` + WARNING.

### 4. Throttle + retry + reporting
- Petite pause configurable entre POST (`--sleep-ms`, défaut 60).
- Retry (2×) sur erreurs transitoires (timeout, 5xx) avec backoff.
- Reporting par cours : `{course, sections, lessons, loom, youtube, imgCdn, imgUnmapped,
  errors[]}`. Retourné par `import_course(...)` (refactor en fonction importable).

### 5. Batch driver — `scripts/skool-import/import_all.py`
- Walk les course keys de `course_trees.json` (skip auto les cours à 0 module).
- Flags : `--dry-run`, `--only <key>` (répétable), `--skip <key>` (répétable),
  `--from <key>` (reprise), `--sleep-ms`, `--progression-mode`.
- Appelle `import_course(...)` par cours, agrège le reporting, imprime un tableau final.
- Mapping key → `classroom_subdir` : dérivé de l'ordre `course_trees.json` ↔ dirs triés
  de `classroom/` (logguer si désaligné).

### 6. Validation dry-run des 11 cours
- `import_all.py --dry-run` sur les 11 → **0 erreur de mapping**, compteurs cohérents
  avec le tableau de l'umbrella (711 leçons, 413 Loom, 100 YT). Traiter tout mismatch.

### 7. Re-import POC (images via CDN) + vérif live (§ PLAN FRONTEND DONE)
- `import_all.py --only ab5cf4d1` (réel) → PATCH idempotent, lesson 6 `content_md`
  passe de ~179 KB à ~2 KB (image via URL CDN).
- tpb-browser sur `lms-viewer` : leçon 6 → l'image rend via `<img src="https://assets.skool.com/…">`
  (naturalWidth > 0, complete), texte + Loom OK, 0 erreur console, fresh + reload.

## Fichiers

- `scripts/skool-import/_asset_urls.py` (nouveau) + test pytest
- `scripts/skool-import/import_course.py` (refactor : CDN images, video classify, mapping robuste, reporting, importable)
- `scripts/skool-import/import_all.py` (nouveau)
- `scripts/skool-import/README.md` (usage + doctrine self-contained)

## Critères

- Dry-run des 11 cours : 0 erreur de mapping, compteurs = tableau umbrella.
- POC re-importé : images via URL CDN (0 data-URI), live OK (image rend, 0 erreur console).
- Tests pytest `_asset_urls` verts. Aucun upload de masse (POC uniquement).
- Code robuste (retry/throttle/fail-loud sur asset absent) + élégant (helper isolé, importable).

## Risques

- **Slug matching** : les titres ont des emojis / ponctuation → normalisation slug tolérante
  (fallback ordre garde le pipeline fonctionnel même si le slug diverge).
- **Assets absents de la map** : possible sur quelques images → WARNING visible (pas masqué),
  quantifié au dry-run ; décision au 04d si le volume le justifie (négligeable attendu).
