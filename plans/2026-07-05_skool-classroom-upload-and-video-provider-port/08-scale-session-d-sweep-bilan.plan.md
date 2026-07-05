# Plan 08 (session D) — Sweep vidéos privées + bilan + finalisation (Session D)

## Contexte

Les 11 cours non-vides sont uploadés (04b + 04c). Finaliser : sweep des vidéos
(publiques/privées), confirmer l'idempotence, vérifier la Classroom complète, produire
le bilan.

## Objectif

Rapport final robuste + Classroom complète vérifiée + idempotence prouvée.

## Étapes

### 1. Sweep vidéos — `scripts/skool-import/sweep_videos.py`
- Walk les `videoLink` des 11 cours (413 Loom + 100 YouTube).
- Loom : `GET https://www.loom.com/v1/oembed?url=<share>` → 200 = embeddable public,
  non-200 = privé/DRM.
- YouTube : `GET https://www.youtube.com/oembed?url=<watch>&format=json` → statut.
- Sortie : `_evidence/video-sweep.json` + résumé `{loom_public, loom_private[], yt_public, yt_unavailable[]}`.
- Pour les privés (attendu ~0 d'après l'échantillon 25/25 public) : documenter la liste ;
  fallback lien-only déjà géré (leçon reste consultable, vidéo en lien externe si non-embeddable).

### 2. Idempotence
`import_all.py --dry-run` global (compare) puis un re-run réel ciblé d'1 cours →
0 création (PATCH only). Confirmer via compteurs D1 (`GET /api/courses`) inchangés.

### 3. Vérif live Classroom complète (§ PLAN FRONTEND DONE)
tpb-browser sur `lms-viewer` :
- **11 cartes** Classroom (les 11 cours non-vides), covers rendues.
- Ouvrir 2-3 cours non déjà vérifiés (dont un « mois » volumineux) → arbre complet,
  texte + images CDN + vidéos, 0 erreur console, fresh + reload.
- Compteurs par cours = umbrella.

### 4. Bilan — `_evidence/scale-report.md`
- 11 cours, 190 sections, 711 leçons, 413 Loom + 100 YT, N images CDN, M imgUnmapped.
- Ratio vidéos publiques/privées (du sweep).
- Idempotence confirmée. Temps total. Décisions (self-contained, CDN, tradeoffs).
- Note doctrine : gating futur d'un cours = flip `progression_mode` via API (Plan 02), zéro refacto.

## Fichiers

- `scripts/skool-import/sweep_videos.py` (nouveau)
- `plans/2026-07-05_.../_evidence/{video-sweep.json,scale-report.md}` (nouveaux)

## Critères

- Sweep complet 413 Loom + 100 YT, ratio public/privé documenté, privés (si présents) en fallback.
- Idempotence prouvée (re-run = 0 création).
- 11 cartes Classroom live, échantillon rendu, 0 erreur console.
- Bilan `_evidence/scale-report.md` complet.

## Risques

- **Rate-limit oEmbed** sur 513 appels : throttle léger + retry ; le sweep est read-only
  (aucune mutation), re-runnable.
