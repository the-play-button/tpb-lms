# Plan 01 — Sidebar = un seul arbre, scopé au programme courant

## Problème (verbatim user 2026-07-05)

> « c'est pas du tout intuitif !!! fais moi un tree normal. là je dois aller en bas,
> cliquer, puis retrouver le bout du truc en haut. […] il faut tout scoper à un program.
> je suis dans un program je vois que mon program. c'est le bordel total. »

**Cause** : le contenu (`somViewer`) a déjà 3 scopes propres — **Classroom** (`renderClassroom`,
tous les programmes) → **Programme** (`renderProgram(id)`, un programme) → **Cours**
(`loadCourse`, leçons). Mais la **sidebar gauche ne suit pas ce scope**. Elle empile DEUX navs :

1. `#stepsSidebar` = arbre leçons du cours courant (en haut).
2. `#somList` = liste de **TOUS** les programmes + cours standalone, groupés/collapsibles (en bas).

Résultat : dans un cours, l'utilisateur voit son arbre de leçons EN HAUT, puis doit **descendre**
tout en bas dans la liste de tous les programmes pour changer de cours, puis **remonter**. Deux
systèmes de nav concurrents. La sidebar n'est jamais scopée au programme où on est.

## Cible : UNE sidebar = un arbre, qui mirror le scope courant

Un seul conteneur d'arbre. Trois états, alignés 1:1 avec le contenu :

| Scope courant | Contenu (`somViewer`) | Sidebar (nouveau) |
|---|---|---|
| **Racine** (`currentProgram=null`, pas de cours) | grille de tous les programmes | **liste plate** : chaque programme (1 ligne) + cours standalone (1 ligne). Clic → entre dans le programme. |
| **Programme** (`currentProgram=P`, pas de cours) | grille des cours de P | **arbre de P uniquement** : `← Tous les programmes` + titre P + les cours de P (lignes, collapsés). Clic cours → ouvre le cours. |
| **Cours** (`currentCourse=C` ∈ P) | leçon courante | **arbre de P uniquement**, le cours C **déplié** montrant ses sections+leçons (leçon courante = ▶). Autres cours de P = lignes collapsées (clic → ouvre). `← Tous les programmes` en tête. |

**Plus jamais** la liste de tous les programmes quand on est DANS un programme. Un cours standalone
(program_id null) = son propre mini-scope (back + son arbre de leçons).

Arbre « normal » : **Programme ▸ Cours ▸ Leçons**, cours courant déplié inline. Tout au même
endroit, zéro ascenseur pour retrouver l'autre nav.

## État nouveau

Ajouter `currentProgram` à `app/state.js` (`state = { …, currentProgram: null }`).
Setté par :
- `classroom.js renderClassroom()` → `setState('currentProgram', null)`.
- `classroom.js renderProgram(programId)` → `setState('currentProgram', programId)`.
- `course/loader.js loadCourse(courseId)` → dérive le program_id du cours ouvert
  (`(getState('courses')||[]).find(c=>c.id===courseId)?.program_id ?? null`) → `setState('currentProgram', …)`.

La sidebar se re-render en s'abonnant à `currentProgram`, `currentCourse`, `courseData`,
`courses`, `programs`, `signals`, `currentStepIndex`.

## Fichiers

### 1. `index.html` (≈ lignes 58-77) — un seul conteneur d'arbre
Remplacer le bloc sidebar (les 2 `nav-section` `stepsSidebar` + `Mon Parcours/somList`) par UN
conteneur :
```html
<nav class="lms-sidebar">
    <div class="nav-section course-tree" id="courseTree"><!-- renderSidebarTree() --></div>
    <div class="nav-section">
        <h3>Mes Badges</h3>
        <div class="badges-grid" id="badgesGrid"></div>
    </div>
</nav>
```
(La section Badges reste inchangée.)

### 2. `app/ui/stepsSidebar.js` — extraire le rendu réutilisable des leçons
Le rendu leçons est bon (`renderNodesTree`, `renderLessonItem`, `buildCtx`, `groupBySection`,
icônes, tooltips). On l'**exporte** pour le réutiliser sous un cours déplié :
- Exporter `buildLessonCtx(course, signals, currentStepIndex)` (= actuel `buildCtx`).
- Exporter `renderCourseLessons(course, ctx)` = le corps qui produit `<nav class="steps-list">…</nav>`
  (nodes tree OU fallback groupBySection). Sans le `sidebar-header` (back/title/progress) — celui-ci
  est désormais porté par la ligne de cours dépliée.
- Garder `collapsedSections` (Set module-level) tel quel.
- `renderStepsSidebar()` + `initStepsSidebar()` : **supprimés** (le nouvel `sidebar.js` orchestre).
  Retirer leurs imports/inits dans `initAllUI.js`.

### 3. `app/ui/sidebar.js` — NOUVEAU, orchestre l'arbre unique
Rôle : rendre `#courseTree` selon le scope, réutilisant le rendu leçons de stepsSidebar +
le mastery badge de courseList.
- `renderSidebarTree()` lit `currentProgram`, `currentCourse`, `courseData`, `courses`, `programs`.
- **Racine** (`!currentProgram && !currentCourse`) : eyebrow « Programmes » + `<ul>` :
  - chaque programme (avec ≥1 cours) → `<li><button class="tree-program-row" data-open-program="ID"><span class="tree-caret">▸</span><span class="tree-label">NAME</span><span class="tree-count">N</span></button></li>`
  - cours standalone → ligne cours `data-open-course="ID"`.
- **Programme/Cours** (`currentProgram` set OU cours courant a un program_id) :
  - `← Tous les programmes` (`data-back-to-classroom`).
  - titre programme (`tree-program-title`).
  - barre de progression programme (Σ progress cours / N) — optionnel v1, sinon le compteur N cours.
  - pour chaque cours du programme :
    - si `course.id===currentCourse` : ligne cours **dépliée** (caret ▾, name, mastery badge) +
      `renderCourseLessons(getState('courseData'), buildLessonCtx(...))` en dessous, indenté.
    - sinon : ligne cours collapsée (caret ▸, name, mastery/✅) `data-open-course="ID"`.
  - Cours standalone ouvert (program_id null) : back + son arbre leçons seul (pas de liste cours).
- `initSidebar()` : subscribe(currentProgram/currentCourse/courseData/courses/programs/signals/currentStepIndex → renderSidebarTree) + **un seul** listener délégué sur `#courseTree` :
  - `[data-back-to-classroom]` → `import('./classroom.js').renderClassroom()`.
  - `[data-open-program]` → `import('./classroom.js').renderProgram(id)`.
  - `[data-open-course]` → `import('../course/loader.js').loadCourse(id)` + `history.pushState(?som=id)`.
  - `.section-header:not(.static)` → toggle section (reprendre `toggleSection` de stepsSidebar, exporté).
  - `.step-item.clickable` → `import('../course/navigation.js').navigateToStep(idx)`.

### 4. `app/ui/initAllUI.js`
- Remplacer `initCourseList/renderCourseList` + `initStepsSidebar` par `initSidebar` + `renderSidebarTree`.

### 5. `app/init/eventListeners.js`
- Retirer le handler `#somList` (obsolète — clics gérés par `sidebar.js` sur `#courseTree`).

### 6. `app/ui/classroom.js` + `app/course/loader.js`
- `setState('currentProgram', …)` aux 3 points (voir § État).

### 7. `app/ui/courseList.js`
- **Supprimé** (remplacé par `sidebar.js`). Retirer ses tests `courseList.test.js` OU les réécrire
  pour `sidebar.js` (buildTree pur exporté pour test).

### 8. CSS `styles/course.css` + `styles/layout.css`
- Réutiliser l'échelle typo déjà posée (`--fs-nav-eyebrow/group/item/meta`).
- `.tree-program-row` = header groupe (fs-nav-group, gras). `.tree-program-title` = titre du
  programme scopé (0.95rem, gras). Cours = fs-nav-item. Leçons (step-item) inchangées.
- Indentation : cours niveau 0 ; leçons du cours déplié indentées (déjà géré par `indentPx`).
- Retirer les styles morts `#somList .nav-program*` si plus référencés (ou renommer vers `.tree-*`).

## Tests / vérif (obligatoire, § PLAN FRONTEND DONE)
- `npx tsc`/lint N/A (JS). `vitest run` : réécrire `courseList.test.js` → `sidebar.test.js`
  (fonction pure `buildSidebarTreeHtml(scope)` testée sur les 3 scopes) + garder
  `stepsSidebar.tree.test.js` en adaptant les exports.
- `tpb-browser` sur `lms-viewer` (session réelle) :
  1. Racine → sidebar liste les programmes (lignes simples), zéro leçon.
  2. Clic « TPB Sales Academy » → main = cours de TPB SA + sidebar = **uniquement** l'arbre TPB SA.
  3. Clic cours « 2 — Outbound Mastery » → cours ouvert, ce cours **déplié** avec ses leçons, les 4
     autres cours collapsés au-dessus/dessous, **aucun** autre programme visible.
  4. `← Tous les programmes` → retour racine.
  5. Reload (Ctrl+R) sur `?som=…` et sur `?program=…` → sidebar rescope correctement, zéro erreur console.

## Non-régression
- Mobile (`mobileTabs`, `mobileParcoursView`) : inchangé (utilise `mobileCourseList`, pas `#somList`).
- Badges section : inchangée.
- Progress gating leçons (`can_access_step`, locked/clickable) : réutilisé tel quel via
  `renderCourseLessons`.
