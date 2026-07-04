# Plan 06 — lms-viewer live bugfixes — DONE

## Ce qui a été fait

Les 3 bugs pré-existants trouvés au tour tpb-browser, fixés at-source (§ ALWAYS
FAIL HARD, § I18N, safe-dom), redéployés, re-vérifiés live (fresh + reload, EN + FR).

### #1 [CRITIQUE] Contenu des leçons jamais rendu
Root cause : `renderer.js` interpolait `renderVideoContent(ctx, videoHtml)` dans un
template `safeHtml` **sans** `raw()` → tout le HTML de l'étape (iframe vidéo +
placeholder document) était échappé → le `<div id="document-content-${id}">` n'était
plus un vrai nœud DOM → `loadDocumentContent` faisait `if (!container) return;` →
le fetch markdown n'était **jamais** émis (régression du commit 40fa29d durcissement
safe-dom). Fix : `import { raw }` + `${raw(renderVideoContent(ctx, videoHtml))}`. Les
valeurs user (`cls.description`) restent échappées dans leur propre `safeHtml`.

**Vérification live** : après fix, `loadDocumentContent` fire bien (le placeholder est
un vrai node). Le contenu de `pa06-2` reste non-rendu car sa media DOCUMENT pointe
vers un **repo GitHub privé** (`raw.githubusercontent.com/the-play-button/pa06-kms-setup`)
qui renvoie 404 → **run-data hors scope tpb-lms** (« garde le focus sur le tpb-lms
lui-même »). L'error path a donc été durci (voir extension ci-dessous).

### #2 [HIGH] Classement toujours vide
Root cause : `leaderboard.js` faisait `.map(({ user_id, rank, total_points }) => …
entry.user…)` — le param était déstructuré mais le corps référençait `entry` non
défini → `ReferenceError` → 0 entrée rendue. Fix : nommer le param `entry` (défaut
`{}`) + consommer `entry.user_id/rank/total_points/user`. **Live** : 2 entrées rendues
(`#1 matthieu.marielouise@theplaybutton.ai 935 pts`).

### #3 [MEDIUM] Labels hardcodés FR (bypass i18n)
Root cause : le flux étape utilisait des labels FR en dur alors que le sélecteur
expose la vraie locale → mismatch quand EN sélectionné. Fix : router via `t()` (clés
déjà présentes) dans `renderer.js` (`course.step`/`of`, `nav.prev/next/finish`,
`course.linearProgression`/`completeStep`), `documentSection.js` (`course.loading`/
`noContent`), `requirements.js` (`requirements.title`/`passQuiz`, + `videoYoutubeId`
dans `hasVideo`), `videoSection.js` (`course.videoLocked`). Clés ajoutées : `course.loading`,
`requirements.passQuiz` (en+fr). **Live** : EN → « Step 1 / 15 », « Next → » ; FR →
« Étape 1 / 15 », « Suivant → ».

### Extension (découverte au re-verify) — error path document i18n + fail-loud
Une fois #1 fixé, `loadDocumentContent` fire et échoue sur le 404 GitHub privé. Le
catch loguait `{ error }` qui sérialisait en `{}` vide (masquait la vraie cause,
viole § ALWAYS FAIL HARD) et affichait des labels FR en dur. Durci : log
`{ url, message }` (fail-loud avec la vraie URL + `error.message`) + message/bouton
routés via `t('course.contentLoadError')` / `t('course.retry')` (clés ajoutées en+fr).
**Live** : console montre `{ message: "Failed to fetch content: 500", url: "…pa06-kms-setup…" }` ;
UI EN « Failed to load content. » / « Retry », FR « Erreur lors du chargement du
contenu. » / « Réessayer ».

### Régression test suite (156→162)
`videoSection.js` importe désormais `i18n/index.js`, qui appelle `initLanguage()` au
module-load → touche `localStorage` → l'import cassait `videoYoutube.test.js` en node
(6 tests non collectés). Fix : `vi.mock('../../../i18n/index.js', () => ({ t: (k) => k }))`
dans le test (le test ne concerne pas i18n). Retour à 162/162.

## Fichiers modifiés

- `frontend-on-cf-worker/app/course/renderer.js` — `import { raw }` + `${raw(renderVideoContent(...))}` (#1) ; labels flux étape via `t()` (#3).
- `frontend-on-cf-worker/app/leaderboard.js` — param `entry` nommé (#2).
- `frontend-on-cf-worker/app/course/renderer.functions/documentSection.js` — `import { t }` ; `course.loading`/`noContent` ; error path i18n + fail-loud log `{ url, message }`.
- `frontend-on-cf-worker/app/course/renderer.functions/requirements.js` — `import { t }` ; `requirements.title`/`passQuiz` ; `videoYoutubeId` dans `hasVideo`.
- `frontend-on-cf-worker/app/course/renderer.functions/videoSection.js` — `import { t }` ; `course.videoLocked`.
- `frontend-on-cf-worker/i18n/en.json` + `i18n/fr.json` — `course.loading`, `requirements.passQuiz`, `course.contentLoadError`, `course.retry`.
- `frontend-on-cf-worker/app/course/renderer.functions/videoYoutube.test.js` — mock i18n (restaure les 6 tests youtube en node).

Commits : `cc01fb4` (3 fixes + test mock), `046333f` (error path i18n + fail-loud).
Déploiements lms-viewer : `3d8ee326`, puis `d00521e1`.

## Résultat de validation

- ✅ **#1** placeholder = vrai nœud DOM → `loadDocumentContent` fire (vérifié : le fetch est émis). Le no-content résiduel de pa06-2 = 404 GitHub privé = run-data hors scope.
- ✅ **#2** classement : 2 entrées rendues live (`#1 …@theplaybutton.ai 935 pts`).
- ✅ **#3** bascule EN↔FR change compteur d'étape, boutons nav, erreur/retry, requirements — les deux locales vérifiées live.
- ✅ **fail-loud** : le log document expose `{ url, message: "…500" }` au lieu de `{}` vide.
- ✅ Console : **0 erreur JS inattendue**. Seul log = le fail-loud document 404 (run-data hors scope, attendu).
- ✅ `npx tsc --noEmit` : 0 erreur.
- ✅ `npm test` : **162/162** (17 fichiers).
- ✅ `python3 -m tpb_entropy --last-status check` : **RATCHET OK** (aucune régression, aucun ACK).
- ✅ tpb-browser : fresh load + reload OK, EN et FR vérifiés (§ PLAN FRONTEND DONE).
