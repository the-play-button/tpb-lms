# Plan 09 — Classroom : vraie vue grille avec covers réelles

## Contexte

La Classroom rend **déjà** une grille (`app/ui/classroom.js::renderClassroom` →
`.course-grid` de `.course-card`), mais la cover est un **gradient déterministe**
(`coverGradient(course.id)`), pas la vraie image. Le bilan Plan 08 avait flaggé ça
comme limitation. Root cause : l'API liste (`GET /api/courses` →
`CoursesService.listCoursesForUser`) ne renvoie pas la cover — `queryActiveCourses`
SELECT `id, name, description, categories_json, is_private` (pas `media_json`), et
`enrichCourseSummary` n'expose aucun champ cover.

Les covers sont pourtant stockées : chaque cours uploadé a
`media_json = [{type:'IMAGE', url:'https://assets.skool.com/…'}]` (URL Skool CDN publique,
déjà rendue sans souci dans les corps de leçon).

## Objectif

Afficher la **vraie cover** dans les cartes de la grille Classroom, avec fallback propre
sur le gradient existant quand un cours n'a pas de cover.

## Étapes

### 1. Backend — exposer la cover dans l'API liste
`backend/services/courses/CoursesService.js` :
- `queryActiveCourses` : ajouter `media_json` au SELECT.
- `enrichCourseSummary` : extraire l'URL de la 1ère media `type==='IMAGE'` →
  `result.cover_image_url` (null si absente). Parse défensif du `media_json`.

### 2. Frontend — rendre la cover réelle dans la carte
`frontend-on-cf-worker/app/ui/classroom.js::renderCard` :
- Si `course.cover_image_url` → `.course-card-cover` porte
  `background-image: url(<cover>)` + `background-size: cover; background-position: center`,
  garder le play overlay (lisible via un léger scrim/gradient par-dessus l'image).
- Sinon → garder le `coverGradient(course.id)` existant (fallback, zéro régression).
- Le `<img>` n'est pas nécessaire (background-image) mais on pose `loading` propre via CSS.
  Garder le tag accessible (aria-label déjà via le titre).

### 3. CSS
`css/…` (ou le bloc style de la classroom) : s'assurer que `.course-card-cover` a
`background-size: cover; background-position: center;` et un scrim pour la lisibilité du ▶.
Vérifier le fichier CSS qui style `.course-card-cover` (probablement `styles.css` /
`classroom.css`).

### 4. Tests
- `app/ui/classroom.test.js` : `renderCard` avec `cover_image_url` → le HTML contient
  `background-image: url(…assets.skool.com…)` ; sans cover → contient le gradient.
- Backend : un test `enrichCourseSummary` (si harness dispo) → `cover_image_url` extrait
  de `media_json` ; sinon couvrir via le test frontend + smoke API.

### 5. Déploiement + vérif live (§ PLAN FRONTEND DONE)
- Deploy lms-api (backend) + lms-viewer (frontend).
- tpb-browser : la grille Classroom montre les vraies covers Skool pour les 11 cours
  Maker School (images chargées, `naturalWidth>0`), fallback gradient pour les cours sans
  cover (SOMs / WGE). Cliquer une carte → ouvre l'overview. 0 erreur console, fresh + reload.

## Fichiers

- `backend/services/courses/CoursesService.js`
- `frontend-on-cf-worker/app/ui/classroom.js`
- CSS de la classroom (`.course-card-cover`)
- `frontend-on-cf-worker/app/ui/classroom.test.js`

## Critères

- La grille Classroom rend les vraies covers (Skool CDN) pour les cours qui en ont.
- Fallback gradient propre pour les cours sans cover (zéro régression).
- Cartes cliquables → overview. tsc/tests verts, entropy OK, 0 erreur console (fresh+reload).

## Risques

- **Cover manquante / URL cassée** : fallback gradient (déjà là) → jamais de carte vide.
- **Lisibilité du ▶ sur image claire** : scrim/gradient overlay par-dessus la cover.
- **CSP img-src** : `assets.skool.com` déjà chargé dans les corps de leçon → OK.
