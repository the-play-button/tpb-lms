# 01 — LMS viewer UX : 4 bugs — DONE

## Ce qui a été fait
- **BUG 1 (navigation overview↔step)** : root cause = sur l'overview, la leçon « resume » était
  marquée `.current` → non-cliquable, et l'outline « CONTENU DU COURS » était statique. Fix :
  état `viewMode` ('overview'|'step') ; sur l'overview le ▶ resume reste CLIQUABLE
  (`stepsSidebar.renderLessonItem`) ; l'outline rend des `<li class="outline-lesson clickable"
  data-step>` avec handler délégué → `navigateToStep`. Retour à l'overview = clic sur le nom du
  cours (déjà en place). Non-breaking : en step, le current reste non-cliquable.
- **BUG 2 (images)** : ajout `.markdown-body img { max-width:100%; height:auto; display:block;
  margin; border-radius }` — images contraintes à la colonne (fini l'overflow).
- **BUG 3 (lisibilité)** : grille `280px 1fr 280px` → `320px minmax(0,1fr) 280px` (menu gauche plus
  large) ; `.step-viewer max-width 900→760px` (colonne de lecture plus étroite) ; sidebar allégée
  (chevron discret, `.section-name` bold, icônes de type par leçon masquées).
- **BUG 4 (transcript)** : `renderTranscript` toujours collapsed (`<details>` sans `open`), vidéo ou pas.

## Fichiers modifiés
- `frontend-on-cf-worker/app/state.js` (défaut `viewMode`), `app/course/overview.js` (viewMode +
  outline cliquable + handler), `app/course/loader.js` + `app/course/navigation.js` (viewMode='step'),
  `app/ui/stepsSidebar.js` (buildLessonCtx/renderLessonItem viewMode), `app/ui/sidebar.js` (passe viewMode),
  `app/course/renderer.functions/documentSection.js` (transcript collapsed).
- CSS : `styles/course/02-markdown.css` (img), `styles/layout.css` (grille), `styles/course/01-viewer-quiz.css`
  (760px), `styles/course/04-lesson-tree.css` (chevron/typo/type-icon), `styles/course/06-overview.css` (outline clickable).

## Résultat de validation (LIVE — tpb-browser sur lms.theplaybutton.ai, compte 79d621)
- [x] BUG 1 : sur l'overview, `outlineClickable=8/8`, la leçon resume ▶ `clickable=true`, `8/8`
      leçons sidebar cliquables ; clic sur une leçon d'outline ("Télécharge l'app !") → ouvre le step
      (leftOverview=true, step=3).
- [x] BUG 2 : `.step-viewer` rendu à 760px ; image native 1440px → rendue 696px (contrainte, 0 overflow).
- [x] BUG 3 : grille `320px 994px 280px`, `.step-viewer max-width 760px`, `.step-type-icon display:none`.
- [x] BUG 4 : `details.transcript-panel` présent + `open=false` (collapsed), label « 📝 Voir la transcription ».
- [x] Fresh load + reload : 0 erreur console ; navigation step/vidéo/quiz inchangée (7/7 vitest sidebar).
