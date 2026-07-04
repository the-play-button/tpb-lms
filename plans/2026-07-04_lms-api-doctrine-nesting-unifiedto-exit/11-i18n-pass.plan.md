# Plan 11 — Passe i18n (router les chaînes hardcodées via t())

## Contexte

Audit read-only : ~87 chaînes FR user-facing hardcodées dans ~21 fichiers frontend,
alors que l'infra i18n (`i18n/index.js` + `t()`, 6 locales) est en place. Pire :
**plusieurs namespaces existent déjà mais ne sont pas câblés** — `endScreen.*`
(6 clés) hardcodé dans endScreen.js, `quiz.*` (9 clés) hardcodé dans quizSection.js
+ quiz/handler.js, `badge.*` dans notifications.js, `leaderboard.empty`,
`userMenu.logout`. La passe = câbler l'existant + ajouter le manquant, zéro chaîne
UI hardcodée sur les surfaces user-facing.

### Exclusions légitimes (pas de l'UI)
- `_mediaHelpers.js` `langLabels` (`fr:'Français'`, `pt:'Português'`) = noms natifs de
  langues pour les pistes de sous-titres → convention, on garde.
- `content/loader/_shared.js:61` = regex de nettoyage markdown (`Vidéo`), pas de l'UI.

## Étapes

### 1. Câbler les namespaces existants non-utilisés
- `endScreen.js` : `endScreen.{congrats,completed,earnedXP,xpPoints,nextModule,backToHome}`.
- `quizSection.js` : `quiz.{title,passed,locked,unlockMessage,unlocked}` (+ `course.videoLocked` déjà fait).
- `notifications.js` : `badge.{unlocked,locked,continue}` + `errors.*` pour le message erreur.
- `leaderboard.js` : `leaderboard.empty`.
- `userMenu.js` : `userMenu.logout`.

### 2. Ajouter les clés manquantes + router (par namespace)
- **course** (alertes navigation + overview) : `mustCompleteStep`, `cannotGoBack`,
  `restartConfirm` (multi-ligne), `stepsCount` (`{n} étapes`), `progressCount`
  (`{done}/{total} complétées`), `reloadRetry`, `abandonConfirm`, `genericError`
  (`Erreur : {msg}`) — navigation.js, overview.js, renderer.js
  (`watchVideo90` pour « Regarder la vidéo à 90%+ »).
- **quiz** (flux quiz) : `finalResults`, `readyPrompt`, `submitError`, `passedTitle`,
  `missedQuestions`, `yourAnswer`, `correctAnswer`, `failedTitle`, `mustRewatch`,
  `submittingWait`, `ready`/`unlockedBadge` — quiz/handler.js + quizSection.js.
- **mobile** : `mobile.{done,stepsCount,notStarted,badgeHint}` — mobileTabs.js.
- **mastery** (nouveau namespace) : `mastery.{notStarted,beginner,...,master}` +
  tiers `badge` (`legendary` etc.) — masteryBadge.js + badges.js.
- **sharing** (nouveau namespace) : loading, empty, title, revoke, revokeConfirm,
  revokeError, sharedWith, withAccess, downloadPitch — sharedWithMe.js + sharingModal.js.
- **confirmModal** : les libellés génériques du modal de confirmation — confirmModal.js.
- **debug** (étendre) : les libellés debug panel/fab — debug/panel.js + debug/fab.js.
- **admin** (nouveau namespace) : libellés du dashboard admin — admin/dashboard.js.
- **eventListeners.js** : `badge.earnedToast` (`Badge débloqué : {name}`).

### 3. Remplir EN + FR (+ garder les 6 locales cohérentes)
Toutes les nouvelles clés ajoutées dans `en.json` ET `fr.json`. Les 4 autres locales
(`de,it,ja,zh`) tombent en fallback (`fr`→`en`) via `fetchContentWithI18nFallback` /
`t()` — pas de traduction inventée ici (hors scope), mais les clés existent en en/fr.

### 4. Vérification
- `node --check` sur chaque fichier modifié · `npx tsc` 0 · `npm test` vert · entropy RATCHET OK.
- Re-scan : `grep -rnE "[éèêàâùûôîïç]"` sur les surfaces user-facing → **0 chaîne UI
  hardcodée résiduelle** (hors exclusions légitimes documentées).
- tpb-browser : basculer EN → toutes les surfaces touchées passent en anglais
  (endScreen, quiz result, badges, mastery, sharing, mobile tabs, alerts) ;
  rebasculer FR. 0 erreur console.

## Fichiers

app/course/{endScreen,navigation,overview,renderer}.js ·
app/course/renderer.functions/quizSection.js · app/quiz/handler.js ·
app/notifications.js · app/leaderboard.js · app/init/eventListeners.js ·
app/ui/{userMenu,mobileTabs,masteryBadge,badges}.js ·
app/sharing/{sharedWithMe,sharingModal}.js · app/course/confirmModal.js ·
app/debug/{panel,fab}.js · app/admin/dashboard.js ·
app/i18n/{en,fr}.json (nouvelles clés + namespaces mastery/sharing/admin).

## Critères

- Zéro chaîne UI FR hardcodée sur les surfaces user-facing (hors exclusions documentées).
- Namespaces existants (endScreen/quiz/badge/leaderboard/userMenu) câblés (plus de duplication hardcodée).
- Nouvelles clés présentes en en.json + fr.json.
- Bascule EN/FR change toutes les surfaces touchées (live).
- tsc 0 · tests verts · entropy RATCHET OK · 0 erreur console.

## Risques

- **Volume** (~21 fichiers) : passe mécanique, risque de casser un template. Mitigation :
  `node --check` par fichier + tests + vérif live après chaque groupe.
- **Interpolations** : plusieurs chaînes ont des variables (`{n} étapes`, `Erreur : {msg}`).
  Le `t(key, params)` de `i18n/index.js` supporte-t-il l'interpolation ? À vérifier en
  étape 0 ; sinon composer `${t('...')} ${var}` proprement (pas de concat FR).
- **safeHtml double-échappement** : router via `t()` retourne une string → si interpolée
  dans un `safeHtml` c'est une valeur normale (échappée), OK. Attention aux sous-rendus
  déjà `raw()` (ne pas ré-échapper). Vérif live anti-régression (cf. bugs Plans 06/08).
- **6 locales** : on remplit en+fr ; de/it/ja/zh tombent en fallback. Pas de trad inventée.
