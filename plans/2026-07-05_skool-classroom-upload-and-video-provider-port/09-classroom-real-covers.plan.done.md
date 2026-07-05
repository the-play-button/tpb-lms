# Plan 09 — Classroom : vraie vue grille avec covers réelles — DONE (2026-07-05)

## Résultat

La grille Classroom affiche désormais les **vraies covers** (art Skool CDN) pour les 11
cours Maker School, avec fallback gradient propre pour les cours sans cover. Vérifié live
(screenshot). Commits `<backend+frontend>` + `<quote-fix>`.

## Ce qui a été fait

### Backend — cover exposée dans l'API liste
`backend/services/courses/CoursesService.js` :
- `queryActiveCourses` : `media_json` ajouté au SELECT.
- helper `extractCoverImageUrl(media_json)` : 1ère media `type==='IMAGE'` → url (null-safe).
- `enrichCourseSummary` : expose `cover_image_url`. Préservé par `applyTranslations`
  (spread `{...obj}`) → survit au path `?lang=fr` du frontend.

### Frontend — cover réelle dans la carte
`frontend-on-cf-worker/app/ui/classroom.js` :
- `coverStyle(course)` : si `cover_image_url` → `background-image: <scrim>, url('…');
  background-size: cover` (scrim sombre pour la lisibilité du ▶). Sinon → gradient
  déterministe existant (fallback, zéro régression).
- `.course-card-cover` a déjà `aspect-ratio: 16/9` → aucun CSS à ajouter.

### Bug trouvé + fix (le point clé) — quotes imbriquées
Premier jet : `url("…")` (double quotes) **dans** un attribut `style="…"` double-quoté →
le `"` interne **fermait l'attribut** prématurément, l'URL était droppée (style tronqué à
83 chars → gradient affiché). **Le test vitest passait** (il vérifie la string HTML, pas
l'attribut DOM parsé) — d'où l'importance de la vérif navigateur (§ PLAN FRONTEND DONE).
Fix : `url('…')` (single quotes) + assertion de régression `not.toContain('url("…')`.

## Vérif live (§ PLAN FRONTEND DONE)

- Grille Classroom : **11 cartes avec vraies covers Skool CDN** (AUTOMATION TUTORIALS,
  BUILDING WEALTH, MONTH ONE, …) + **2 gradient fallback** (SOMs / WGE, sans cover).
- Image cover chargée (probe `new Image()` → `naturalWidth 1460`), ▶ + scrim lisibles.
- Persiste après reload (11 covers). Clic carte Month 4 → overview « Month 4 » s'ouvre.
- **0 erreur console**. Screenshot capturé.

### Gates
- `npx tsc -p backend/tsconfig.json` 0 · `npx vitest run` 195/195 (dont 5 classroom) ·
  entropy RATCHET OK. lms-api + lms-viewer déployés.

## Fichiers

- `backend/services/courses/CoursesService.js`
- `frontend-on-cf-worker/app/ui/classroom.js`
- `frontend-on-cf-worker/app/ui/classroom.test.js`

## Note

Résout la limitation « covers non rendues » flaggée au bilan Plan 08 (§ FIX-IT-NOW).
La grille `.course-card` existait déjà ; le seul gap était la donnée cover (API) + le
rendu (+ le bug de quotes). YouTube tracking = migré proprement dans `youtubeProvider`
(vérifié : mêmes `sendVideoEvent`/`sendVideoPing`), rien tué.
