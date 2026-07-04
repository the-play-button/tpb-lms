# Plan 06 — lms-viewer live bugfixes (found via tpb-browser walkthrough)

## Contexte

Tour du viewer déployé (§ PLAN FRONTEND DONE) → 3 bugs, tous pré-existants (pas
l'initiative), confirmés live sur les 2 cours :

1. **[CRITIQUE]** Contenu des leçons jamais rendu — HTML brut échappé.
2. **[HIGH]** Classement toujours vide (`entry is not defined`).
3. **[MEDIUM]** Labels hardcodés FR (le sélecteur montre la vraie locale EN → mismatch).

## Objectif

Fixer les 3 at-source, sans régression, + redéployer + re-vérifier live.

## Étapes

1. **#1 Contenu échappé** — `app/course/renderer.js` : importer `raw` depuis
   `safe-dom.js` + wrapper `${raw(renderVideoContent(ctx, videoHtml))}`. Le HTML de
   `renderVideoContent` est généré en interne (iframe vidéo + placeholder document),
   donc `raw()` est correct ; les valeurs user (`cls.description`) restent échappées
   dans leur propre `safeHtml`. Root cause : commit 40fa29d (durcissement safe-dom)
   a sur-échappé → le placeholder n'était plus un vrai nœud → `loadDocumentContent`
   ne trouvait pas `#document-content-${id}` → fetch markdown jamais émis.
2. **#2 Classement** — `app/leaderboard.js:37` : `.map(({ user_id, rank,
   total_points }) => … entry.user…)` référence `entry` non défini. Nommer le param
   `entry` + utiliser `entry.user_id/rank/total_points/user`.
3. **#3 i18n** — router les labels hardcodés FR du flux étape via `t()` (clés déjà
   présentes dans en.json/fr.json) :
   - `renderer.js` : `course.step`/`course.of`, `nav.prev`/`nav.next`/`nav.finish`,
     `course.linearProgression`, `course.completeStep`.
   - `documentSection.js` : `course.loading` (clé ajoutée), `course.noContent`.
   - `requirements.js` : `requirements.title`.
   - `videoSection.js` : `course.videoLocked`.

## Fichiers

- `app/course/renderer.js` (raw import + wrap + t() sur les labels)
- `app/leaderboard.js` (map param)
- `app/course/renderer.functions/documentSection.js` (t())
- `app/course/renderer.functions/requirements.js` (t())
- `app/course/renderer.functions/videoSection.js` (t())
- `i18n/en.json` + `i18n/fr.json` (ajout `course.loading`)

## Critères

- Console 0 erreur/warn sur load + step view.
- Contenu markdown rendu (plus de tags bruts), fetch GitHub émis.
- Classement affiche les 2 entrées.
- Bascule EN/FR change les labels du flux étape.
- `npm run typecheck` 0 · `npm test` vert · node --check sur les JS.
- tpb-browser : live OK sur les 2 cours + reload.

## Risques

- `raw()` sur `renderVideoContent` = confiance sur du HTML interne (iframe/placeholder
  générés, ids vidéo validés `[A-Za-z0-9_-]{11}`). Restaure le comportement pré-40fa29d.
- i18n : ne router que les labels avec clés existantes (+ `course.loading` ajoutée) ;
  le reste de l'app (broader i18n debt) reste hors scope de ce plan.
