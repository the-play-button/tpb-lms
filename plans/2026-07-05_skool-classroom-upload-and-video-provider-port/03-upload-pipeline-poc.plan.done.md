# Plan 03 — Pipeline upload (100% API) + POC sur 1 cours — DONE (2026-07-05)

## Résultat

Le cours Skool `01_pre-program-start-here` (Nick Saraev — Maker School) est uploadé
dans tpb-lms **100% via l'API**, **zéro push externe**, et vérifié **live** dans le
viewer déployé : 3 sections + 15 leçons Loom, nav libre, vidéos qui s'embarquent,
texte + image qui rendent, 0 erreur console (fresh + reload).

## Décision d'architecture — self-contained (inline content_md), PAS de GitHub

Plan 03 était écrit autour d'un **push GitHub** (markdown hébergé → media DOCUMENT →
content-proxy). En exécutant, deux constats ont recadré l'approche :

1. **Le viewer ne rendait pas `content_md`** — le texte de leçon ne venait QUE des
   media DOCUMENT (fetch URL → `marked.parse`). L'inline `content_md` (Plan 02) était
   settable mais non affiché.
2. **Le cours POC est vidéo-first, quasi sans images** — 15 leçons Loom, cover = URL
   Skool CDN publique, **1 seule image** dans tout le cours.

→ Choix (aligné « 100% API / self-contained / no re-host / éviter hébergement payant »,
et anticipé par le risk note du plan « content_md vs DOCUMENT — à trancher au POC ») :
**tout self-contained, zéro push externe** :
- **texte** = inline `content_md` (raw_json.tpb_content_md), désormais **rendu par le
  viewer** (petit ajout `renderVideoContent` → `marked.parse`, même pipeline que le KMS
  modal).
- **vidéos** = embeds Loom directs (adapter Plan 01), zéro re-host.
- **cover** = URL Skool CDN publique (media IMAGE), vérifiée HTTP 200 sans auth.
- **image de corps** (1 seule) = inline base64 data-URI dans le markdown.

Aucune création/push de repo GitHub → l'**action outward-facing du plan (Step 1/6) est
évitée**, pas juste reportée.

## Livrables

### Viewer (commit `5461802`)
- `frontend-on-cf-worker/app/course/renderer.functions/documentSection.js` :
  `renderVideoContent` combine désormais `videoHtml + inline content_md (marked.parse) +
  documentHtml`. Nouvel helper `renderInlineContentMd` (exclut le sentinel legacy
  `cloudflarestream.com` qui n'est pas du markdown).

### Importer (commit `5461802`)
- `scripts/skool-import/import_course.py` — Python stdlib + `BastionClient` + httpx.
  Args `--data-root / --course-key / --classroom-subdir / --progression-mode / --dry-run`.
  - Auth : PAT `app_lms` (vault `tpb/apps/lms/bastion_token`, porte `lms:*`).
  - Ids déterministes (`course_<skoolid>` / `sec_<setid>` / `les_<moduleid>`) → **idempotent**.
  - Chaque entité : `POST` (create-if-absent) puis `PATCH` (refresh) → re-run safe + itérable.
  - `strip_metadata_header` (drop le bloc extractor jusqu'au 1er `---`), `inline_relative_images`
    (relatif → data-URI base64), media VIDEO Loom/YouTube, cover Skool CDN.

## Vérif live (tpb-browser, `lms-viewer.matthieu-marielouise.workers.dev`)

- Classroom : la carte « Pre-Program: Start Here » apparaît (data-course-id présent).
- Cours ouvert : arbre **3 sections** (« Maker School 101 » / « What will you build? » /
  « Last but not least ») + **15 leçons**, toutes `step-item clickable` (**nav libre** =
  progression_mode free — clic direct sur la leçon 6 OK).
- Leçon Loom : `<iframe data-provider="loom" data-loom-id=…>` rendu (embed Plan 01),
  tracking wiré (le dispatcher lit `data-provider`).
- Texte : `.markdown-body` rendu depuis inline `content_md`.
- Image (leçon 6) : `<img src="data:image/jpeg;base64,…">` chargée (naturalWidth 1440,
  complete=true).
- **0 erreur console**, fresh **et** reload deep-link (`?som=…&step=6` restore la leçon exacte).

## Validation

- `npx tsc -p backend/tsconfig.json` 0 · `npx vitest run` 193/193 · entropy RATCHET OK.
- Import réel : course + 3 sections + 15 leçons **upserted** (tous OK).

## Notes / open questions pour la revue (UAT) + Plan 04

- **Hébergement des assets à l'échelle** : le data-URI inline marche parfaitement pour ce
  cours vidéo-first (1 image), mais **ne scale pas** aux cours riches en images (la leçon 6
  a un `content_md` de ~179 KB à cause de l'image inlinée). Pour les 12 cours, il faudra
  **trancher** : (a) garder le data-URI pour les cours légers, (b) héberger les assets
  (repo GitHub content — l'approche Plan 03 initiale — ou équivalent) pour les cours
  image-lourds. **Décision à prendre au UAT avant le scale (Plan 04).**
- **Durée vidéo** : `MediaSchema` (create/update class) = `{url, type, name}` strict → un
  `duration_sec` fourni est stripé par Zod. Sans impact en nav libre (pas de gate 90%),
  mais à ajouter au schema authoring si on veut le gate de complétion vidéo en mode linear.
- **Cover card** : rendu du cover via media IMAGE à re-confirmer visuellement au UAT
  (la carte apparaît ; le rendu exact de l'image de cover est un point à valider à l'œil).

## STOP — UAT gate

Per instruction utilisateur : **stop avant Plan 04 pour UAT**. Le POC est live et
testable ; Plan 04 (scale 12 cours) attend la validation humaine + la décision
hébergement-assets ci-dessus.

## Fichiers

- `frontend-on-cf-worker/app/course/renderer.functions/documentSection.js` (inline content_md)
- `scripts/skool-import/import_course.py` (nouveau)

Commit : `5461802`.
