# 01 — LMS viewer UX : 4 bugs (navigation overview, images, lisibilité, transcript)

## Contexte — Constats préalables (audit code 2026-09-22)

4 remarques utilisateur sur l'app LMS elle-même (pas le contenu du cours).

**BUG 1 — navigation overview ↔ step déroutante.** Clic sur un COURS dans la sidebar →
`showCourseOverview` (écran overview statique avec un CTA « Commencer → »). Le design (documenté
dans `showCourseOverview`) pointe le marqueur ▶ sur la leçon « resume » (index 0) **sans y
naviguer** — mais `renderLessonItem` marque cette leçon `.current` → `clickable = isAccessible &&
!isCurrent` → **la leçon 0 n'est PAS cliquable**. Donc sur l'overview : (a) l'outline « CONTENU DU
COURS » est statique (`<li class="outline-lesson">` non-cliquable), (b) la 1ère leçon de la sidebar
est marquée « courante » mais cliquer dessus ne fait rien → il faut cliquer la 2ᵉ puis revenir. Le
retour à l'overview existe (clic sur le nom du cours = `data-open-course` → `showCourseOverview`)
mais n'est pas évident. **Root cause : le marqueur `.current` (non-cliquable) appliqué à la leçon
resume alors qu'on est sur l'OVERVIEW, pas sur cette leçon.**

**BUG 2 — images n'importe comment.** `styles/course/02-markdown.css` n'a **aucune règle
`.markdown-body img`** → les images rendent à leur taille intrinsèque (débordent / trop grandes /
non contraintes). Skool les contraint à la largeur du contenu.

**BUG 3 — lisibilité.** `.lms-main` grid = `280px 1fr 280px` (`styles/layout.css:107`). Le contenu
central (1fr) n'a pas de max-width → colonne de lecture trop large. La sidebar (280px) est étroite
vs Skool (menu gauche plus large, zone de cours plus étroite). Sidebar chargée visuellement
(chevrons ▸/▾ + icônes de type 📄📦🎬 sur chaque leçon).

**BUG 4 — transcript expanded par défaut.** `documentSection.js::renderTranscript` met `<details
open>` quand la leçon n'a pas de vidéo. Un transcript = texte énorme → doit être **toujours
collapsed**.

## Fichiers impactes
- `frontend-on-cf-worker/app/state.js` (ou init) — nouvel état `viewMode` ('overview'|'step').
- `frontend-on-cf-worker/app/course/overview.js` — `viewMode='overview'` + outline cliquable + handler.
- `frontend-on-cf-worker/app/course/loader.js` + `app/course/navigation.js` — `viewMode='step'`.
- `frontend-on-cf-worker/app/ui/stepsSidebar.js` — `buildLessonCtx`/`renderLessonItem` clickable sur overview.
- `frontend-on-cf-worker/app/ui/sidebar.js` — passe `viewMode` au ctx.
- `frontend-on-cf-worker/app/course/renderer.functions/documentSection.js` — transcript toujours collapsed.
- `frontend-on-cf-worker/styles/course/02-markdown.css` — règle `.markdown-body img`.
- `frontend-on-cf-worker/styles/layout.css` — grille sidebar/contenu.
- `frontend-on-cf-worker/styles/course/01-viewer-quiz.css` — max-width du contenu de lecture.
- `frontend-on-cf-worker/styles/course/04-lesson-tree.css` — sidebar minimaliste (chevron/typo).
- `frontend-on-cf-worker/styles/course/03-overview*.css` (le fichier de l'overview) — outline clickable style.

## Etapes

1. **`viewMode` state** — dans `showCourseOverview` : `setState('viewMode','overview')` (avant de
   render l'overview). Dans `loadCourse` (après `setState('currentStepIndex', …)`) et
   `navigation.navigateToStep`/`nextStep`/`prevStep` : `setState('viewMode','step')`. Default 'step'.
2. **BUG 1 — sidebar clickable sur overview** : `sidebar.renderSidebarTree` passe `viewMode` dans le
   ctx ; `stepsSidebar.buildLessonCtx(course, signals, currentStepIndex, viewMode)` stocke `viewMode` ;
   `renderLessonItem` : `const onOverview = ctx.viewMode === 'overview'; const clickable =
   isAccessible && (onOverview || !isCurrent) ? ' clickable' : '';`. Le ▶ resume reste affiché mais
   devient cliquable sur l'overview (on n'est PAS sur cette leçon). Sur un step, comportement inchangé.
3. **BUG 1 — outline cliquable** : `overview.renderCourseOutline` — pour chaque LESSON, calculer son
   index dans `course.classes` et rendre `<li class="outline-lesson clickable" data-step="${index}">`.
   Dans `setupOverviewHandlers`, ajouter un listener délégué sur `.course-outline` : clic sur
   `.outline-lesson.clickable` → `navigateToStep(index)`.
4. **BUG 4 — transcript toujours collapsed** : `renderTranscript` — retirer `openAttr` (toujours
   `<details>` sans `open`). Garder le label « Voir la transcription » avec ET sans vidéo.
5. **BUG 2 — images** : ajouter dans `02-markdown.css` :
   `.markdown-body img { max-width: 100%; height: auto; display: block; margin: var(--space-md) 0;
   border-radius: var(--radius-md); }`.
6. **BUG 3 — layout lisibilité** :
   - `layout.css:107` : `grid-template-columns: 320px minmax(0, 1fr) 280px;` (sidebar 280→320).
   - `01-viewer-quiz.css` : contraindre la colonne de lecture — `.step-viewer { max-width: 760px;
     margin: 0 auto; }` (et/ou `.step-content`), pour une longueur de ligne Skool-like.
   - `04-lesson-tree.css` : minimalisme — `.section-chevron` plus discret (taille/opacité réduites),
     `.section-name` bold (font-weight 600, couleur primaire), `.step-item .step-type-icon` masqué
     (`display:none`) pour dé-charger. Lignes de leçon plus légères.
7. Build : le frontend est servi tel quel (assets statiques, pas de build) → deploy = `wrangler deploy`.

## Risques identifiés
- Ne pas casser la navigation step existante (le `.current` non-cliquable reste correct EN step).
  Mitigation : `viewMode` gate — le changement de clickable ne s'applique QUE sur l'overview.
- Le max-width du contenu ne doit pas casser le rendu vidéo (le player reste responsive dans 760px).
- CSS additif — pas de suppression de règle load-bearing.
- **Live-verify tpb-browser obligatoire** (§ PLAN FRONTEND DONE) sur `lms.theplaybutton.ai` (compte
  79d621, propriétaire de la zone post-migration) : les 4 bugs corrigés + fresh load + reload OK.

## Criteres de validation
- [ ] BUG 1 : sur l'overview, cliquer la 1ère leçon (sidebar OU outline « CONTENU DU COURS ») l'ouvre
      directement ; retour à l'overview via le nom du cours ; plus de « clic sans effet ».
- [ ] BUG 2 : les images du cours sont contraintes à la largeur du contenu (comparable à Skool).
- [ ] BUG 3 : menu gauche plus large + colonne de lecture plus étroite + sidebar allégée (moins de
      chevrons/icônes, meilleur gras).
- [ ] BUG 4 : la transcription est TOUJOURS collapsed (`<details>` fermé) — vidéo ou pas.
- [ ] Aucune régression : navigation en step, vidéo, quiz inchangés (tpb-browser fresh + reload).
