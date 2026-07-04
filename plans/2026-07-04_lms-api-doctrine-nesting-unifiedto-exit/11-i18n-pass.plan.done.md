# Plan 11 — Passe i18n — DONE

## Ce qui a été fait

~90 chaînes FR user-facing hardcodées, réparties sur 20 fichiers, routées via `t()`.
Câblage des namespaces existants-mais-inutilisés + ajout des manquants. `en.json`
et `fr.json` désormais **symétriques (207 clés, 0 clé asymétrique)**.

### Namespaces existants câblés (étaient hardcodés en double)
`endScreen.*` (endScreen.js), `quiz.*` (quizSection.js + quiz/handler.js),
`badge.*` (notifications.js), `leaderboard.empty` (leaderboard.js),
`userMenu.logout` (userMenu.js).

### Nouveaux namespaces / clés
- **mastery** (masteryBadge.js) + **rarity** (badges.js) : maps module-level
  converties en `labelKey` résolus **au render** (`t()` doit tourner après
  `initLanguage`, pas au module-load).
- **sharing** (sharedWithMe.js + sharingModal.js), **confirmModal** (confirmModal.js),
  **admin** (admin/dashboard.js), extensions **course/quiz/mobile/debug/userMenu**.
- Interpolations `{param}` (déjà supportées par `t(key, params)`) : `{title}`,
  `{msg}`, `{n}`, `{done}/{total}`, `{max}`, `{name}`, `{email}`, `{score}/{max}`,
  `{percentage}`, `{course}`, `{step}`.

### Bugs latents corrigés en route
- Double-échappement de la `.map()` des corrections quiz (quiz/handler.js) → `raw()`.
- Double-échappement du message content-step de confirmModal (`<strong>` littéral) →
  message plain-text via clé i18n.

### Re-render au changement de langue (complétude UX)
Le handler `languagechange` ne rafraîchissait que le contenu (courses/sidebar/step).
Ajout : re-render du chrome statique (userMenu + badges + leaderboard) + stockage de
`session` en state au boot pour re-render le userMenu.

### Exclusions légitimes (pas de l'UI, documentées)
`_mediaHelpers.js` noms natifs de langues (sous-titres) ; `content/loader/_shared.js`
regex de nettoyage markdown.

## Fichiers modifiés

app/course/{endScreen,navigation,renderer,overview,confirmModal}.js ·
app/course/renderer.functions/quizSection.js · app/quiz/handler.js ·
app/notifications.js · app/leaderboard.js · app/init/{eventListeners}.js ·
app/ui/{userMenu,mobileTabs,masteryBadge,badges,initAllUI}.js ·
app/sharing/{sharedWithMe,sharingModal}.js · app/debug/{fab,panel}.js ·
app/admin/dashboard.js · i18n/{en,fr}.json.

Commits : `b9eefed` (passe i18n) · `87b0ef6` (re-render header au switch).
Déploiements : lms-viewer `9fa94311` → `73d79747`.

## Résultat de validation

- ✅ **0 chaîne FR hardcodée résiduelle** user-facing (scan `grep [éèê…]` hors exclusions).
- ✅ `en.json`/`fr.json` symétriques (207 clés, en-only=∅, fr-only=∅).
- ✅ Fresh-load EN : **tout** résout en anglais (Logout, Student, Step 1/6, Quiz passed, Next, tooltips verrouillés).
- ✅ Switch live FR→EN **sans reload** : header re-render (Déconnexion→Logout, Étudiant→Student, Suivant→Next) + contenu + sidebar.
- ✅ Console : **0 erreur**.
- ✅ `npx tsc --noEmit` 0 · `npm test` **184/184** · entropy `--last-status check` **RATCHET OK** (zéro ACK — que du câblage code).
- ✅ tpb-browser : fresh EN + switch live EN↔FR (§ PLAN FRONTEND DONE).
