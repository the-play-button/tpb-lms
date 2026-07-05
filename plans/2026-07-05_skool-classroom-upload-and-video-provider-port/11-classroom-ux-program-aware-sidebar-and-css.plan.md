# Plan 11 — Refonte UX : sidebar « Mon Parcours » program-aware + fix CSS

## Contexte

Après le Plan 10 (entité Program), deux dettes UX restent :
1. **Sidebar « Mon Parcours »** (`#somList` / `courseList.js`) = liste **plate** de tous les
   cours (13 items : 11 Maker + 2 TPB), **pas program-aware** → le learner ne s'y retrouve pas.
2. **Quirks CSS** sur les cartes : `.course-card-body` sans `flex:1` + `.course-card-cta`
   sans `margin-top:auto` → **hauteurs inégales** (la carte « Maker School », title + « 11
   cours », a un grand vide sous le texte vs les cartes cours qui ont desc+progress+CTA).

## Objectif

Sidebar groupée par **program** (sections repliables : « Maker School » → ses cours),
+ cours standalone ; et des cartes de grille **alignées** (CTA en bas). Propre, clair.

## Étapes

### 1. Fix CSS cartes (`styles/course.css`)
- `.course-card-body { flex: 1; }` → le body s'étire, toutes les cartes d'une rangée
  s'alignent en hauteur.
- `.course-card-cta { margin-top: auto; }` → le CTA se pin en bas (remplace le `margin-top:
  var(--space-xs)`).
- Vérifier `.program-card` : hérite de `.course-card` (OK), CTA « N cours » pin en bas.

### 2. Sidebar program-aware (`app/ui/courseList.js`)
- Grouper `getState('courses')` par `program_id`, noms depuis `getState('programs')`.
- Rendu : pour chaque program → **section repliable** :
  `<li class="nav-program"><button class="nav-program-header" data-program-toggle=…>
   ▸ Nom <span class="nav-program-count">N</span></button>
   <ul class="nav-sublist">…cours…</ul></li>`
  puis les cours **standalone** en `<li>` plats en dessous.
- État replié persistant (module `Set` `collapsed`) → survit aux re-render (progress change).
- Ordre des cours dans un program : conservé de l'API (name ASC) — l'ordering pédagogique
  (Pre-Program → Month 1…) est un follow-up séparé (pas de champ order aujourd'hui).

### 3. Interactions
- `initCourseList` : listener délégué sur `#somList` pour `[data-program-toggle]` →
  toggle `.collapsed` sur le `.nav-program` + `aria-expanded`. (Le listener existant
  `eventListeners.js` gère déjà `a[data-som-id]` → loadCourse ; inchangé.)
- Re-render au changement de `programs` aussi (`subscribe('programs', renderCourseList)`).

### 4. CSS sidebar (`styles/layout.css` ou `course.css`)
- `.nav-program-header` (bouton pleine largeur, caret, count pill), `.nav-sublist`
  (indent léger), `.nav-program.collapsed .nav-sublist { display: none; }`, rotation caret.
- Cohérent avec l'esthétique existante (`.nav-list a`, hover-halo, variables).

### 5. Tests
- `courseList.test.js` (si existe, sinon créer) : rendu groupé — un program avec ses cours
  nested + standalone à part ; toggle collapse. (Rendu pur testable en mockant getState.)

### 6. Déploiement + vérif live (§ PLAN FRONTEND DONE)
- Deploy lms-viewer.
- tpb-browser : sidebar montre **« Maker School » (repliable, 11 cours)** + les 2 cours
  standalone ; clic header → replie/déplie ; clic cours → ouvre le cours. Grille : cartes
  **alignées** (CTA en bas, plus de vide sous « Maker School »). 0 erreur console, fresh+reload.

## Fichiers

- `frontend-on-cf-worker/styles/course.css` (+ `layout.css`)
- `frontend-on-cf-worker/app/ui/courseList.js` (+ `courseList.test.js`)
- `frontend-on-cf-worker/app/init/eventListeners.js` (si toggle y est mieux placé)

## Critères

- Sidebar groupée par program (repliable) + standalone ; cartes alignées.
- Clic cours → ouvre ; clic header → replie. Aucune régression sur la nav existante.
- tests verts · entropy OK · 0 erreur console (fresh + reload).

## Risques

- **Double-wiring listener** au re-render → wire le toggle une seule fois (flag `dataset`).
- **Ordre alphabétique** des cours dans un program (pas idéal pédagogiquement) → follow-up
  ordering documenté, non bloquant.
