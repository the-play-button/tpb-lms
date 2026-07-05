# Plan 08 (session D) — Sweep vidéos + bilan + finalisation — DONE (2026-07-05)

## Résultat

Finalisation de l'initiative : sweep des 513 vidéos (**100% publiques**), idempotence
confirmée, 11 cartes Classroom vérifiées, bilan produit. **L'initiative est close** —
les 11 cours Maker School sont dans tpb-lms, self-contained, 0 erreur.

## Ce qui a été fait

### 1. Sweep vidéos — `sweep_videos.py` (nouveau)
Probe oEmbed read-only des 513 vidéos → `_evidence/video-sweep.json` :

| Provider | Public | Privé/indispo | Erreur |
|---|---:|---:|---:|
| Loom | **413** | 0 | 0 |
| YouTube | **100** | 0 | 0 |

**Zéro vidéo privée/DRM** → aucun fallback lien-only nécessaire. La stratégie « embed
direct, pas de re-host » couvre 100% du catalogue.

### 2. Idempotence
Re-import de Building Wealth (2e run) → **11 leçons / 2 sections inchangés** (ids
déterministes + `INSERT OR IGNORE` → zéro doublon). Tout re-run est safe.

### 3. Vérif live 11 cartes Classroom (§ PLAN FRONTEND DONE)
Les **11 cours Maker School** apparaissent dans la Classroom (« MON PARCOURS ») + 2 cours
TPB préexistants. Échantillon ouvert au fil des sessions : Pre-Program, Resource Library
(YouTube + text-only), Month 1 (32 sections + 17 images CDN), Month 4 (Loom), Building
Wealth (text-only slug-fixé). **0 erreur console**, fresh + reload.

**Limitation connue (non-régression)** : la liste Classroom est en texte — elle ne rend
pas la cover (stockée en media IMAGE, dispo pour une future vue grille). Les 11 cours
sont listés + ouvrables ; à l'ouverture tout rend (texte + images CDN + vidéos).

### 4. Bilan — `_evidence/scale-report.md` (nouveau)
Chiffres complets (11 cours / 190 sections / 711 leçons / 413 Loom + 100 YT / 101 images
CDN / 0 erreur), architecture self-contained, sweep, idempotence, robustesse, doctrine.

## Fichiers

- `scripts/skool-import/sweep_videos.py` (nouveau)
- `plans/2026-07-05_.../_evidence/video-sweep.json` (nouveau)
- `plans/2026-07-05_.../_evidence/scale-report.md` (nouveau)

## Bilan de l'initiative complète (01→08)

| Plan | Objet | État |
|---|---|---|
| 01 | Port vidéo hexa + adapter Loom | DONE |
| 02 | Authoring API (progressionMode/contentMd/rawJson) + fix SDK wildcard-hasScope | DONE |
| 03 | POC 1 cours (self-contained, inline content_md rendu) | DONE |
| 04 | Umbrella scale (décomposé 05-08) | — |
| 05 (A) | Durcissement importer + assets CDN | DONE |
| 06 (B) | Upload cohorte 1 (+ fix 429) | DONE |
| 07 (C) | Upload cohorte 2 | DONE |
| 08 (D) | Sweep + bilan | DONE |

**11 cours · 190 sections · 711 leçons · 513 vidéos toutes publiques · 101 images CDN ·
0 ré-hébergement · 0 erreur · idempotent.**
