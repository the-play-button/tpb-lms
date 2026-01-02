# HITL Session - 2024-12-30

> Session de test HITL pour valider l'Auth API-Ready (JWT + API Key)

---

## Session Info

| Champ | Valeur |
|-------|--------|
| Date | 2024-12-30 |
| Testeur | Matthieu |
| Email | matthieu.marielouise@theplaybutton.ai |
| contact_id (CRM) | contact_1766799203473_s11pxmp07 |
| Devices | PC + iPhone |

---

## Test Progress

| ID | Scénario | Status | Notes |
|----|----------|--------|-------|
| H-01 | Fresh User UX | ⚠️ | Mobile UX issues notés (toasts, bouton quiz) |
| H-02 | Video Resume | ✅ | Reprise vidéo OK ! |
| H-03 | Quiz Flow | ⚠️ | Fonctionne mais UX feedback manquant |
| H-04 | Mobile/Responsive | ⚠️ | Debug button overlay bug, reste OK |
| H-05 | URL Deep Linking | ⚠️ | Fonctionne, mais step=3 devrait être step=4 (1-based) |
| H-06 | Multi-Tabs | ✅ | Cohérence OK |
| H-07 | Refresh Mid-Action | ✅ | OK (test redondant avec H-02) |
| H-08 | Animations | ⚠️ | 2/5 - Pas d'effet waouh, manque de polish |

**Légende**: ⏳ En attente | ✅ Pass | ❌ Fail | ⚠️ Pass avec issues

---

## Issues Found

### Bugs (bloquants)

- [x] Mobile: sidebar inaccessible, pas de navigation entre cours (FIXED: ajout tab bar)

### UX Issues (non-bloquants)

- [ ] Mobile: Quiz validation = 3 toasts simultanés, prend trop de place sur petit écran
- [ ] Mobile: Bouton validation quiz trop proche du footer, pas de marge de respiration

### Améliorations suggérées

- [ ] Grouper/limiter les toasts sur mobile (1 seul ou queue avec délai)
- [ ] Ajouter padding-bottom sur quiz pour éloigner du footer mobile
- [ ] Desktop: Parcours actif non visuellement sélectionné dans le menu gauche
- [ ] Quiz: Message "Attention - Une seule tentative" s'affiche bizarrement (formatting)
- [ ] Quiz: Après soumission, afficher score + bonnes réponses (pas juste "quiz réussi")
- [ ] Parcours: Affiche "pas commencé" même pour cours en cours (progression non reflétée)
- [ ] Quiz: Couleurs foncé sur foncé, illisible
- [ ] Mobile: Debug button (?) overlay bug - clic plante UI, boutons tab bar KO, besoin refresh
- [ ] Mobile: Debug button devrait être AU-DESSUS de la tab bar (z-index)
- [ ] URL: ?step=N devrait être 1-based (humain) pas 0-based (dev)
- [ ] Animation: XP counter devrait "pop" quand il augmente
- [ ] Animation: Badge unlock manque d'effet (glow constant sur éclair = pas impactant)
- [ ] Animation: Niveau "web game" attendu, actuellement trop sobre 

---

## UX Feedback

### Notes générales

- 

### Score Polish (1-5)

| Critère | Score | Commentaire |
|---------|-------|-------------|
| Design général | 3/5 | Correct mais pas distinctif |
| Animations | 2/5 | Pas de pop XP, pas d'effet waouh |
| Réactivité | 4/5 | Fonctionne bien |
| Clarté UX | 3/5 | Quelques confusions (quiz, parcours) |
| **TOTAL** | **2.5/5** | MVP fonctionnel, polish à améliorer |

---

## Action Items

### Fixes à déployer pendant la session

- [x] Debug button mobile overlay (bottom: 91px)
- [x] Quiz couleurs illisibles (fond blanc iframe)
- [x] Toast limit mobile (max 2 avec queue)
- [x] Quiz padding mobile (100px bottom)
- [x] URL 1-based (?step=1 au lieu de ?step=0) 

### Backlog Priorisé (après session)

| Priorité | Issue | Fichier probable |
|----------|-------|------------------|
| 🔴 High | Mobile: Debug button overlay casse l'UI | `debug/fab.js`, `styles/responsive.css` |
| 🔴 High | Quiz: Couleurs foncé/foncé illisibles | `styles/components.css` (Tally iframe) |
| 🟡 Medium | Quiz: Afficher score + bonnes réponses | Backend webhook + frontend notification |
| 🟡 Medium | Parcours: "pas commencé" même si en cours | `ui/courseList.js`, `populateMobileCourseList` |
| 🟡 Medium | Desktop: Parcours actif non sélectionné visuellement | `ui/courseList.js`, CSS `.active` |
| 🟡 Medium | URL: ?step=N en 1-based (humain) | `course/navigation.js`, `course/loader.js` |
| 🟡 Medium | Mobile: 3 toasts simultanés = trop | `components/toast.js` (queue/limit) |
| 🟡 Medium | Mobile: Bouton quiz trop près du footer | `styles/responsive.css` (padding-bottom) |
| 🟢 Low | Animation: XP pop manquant | `ui/userStats.js`, `styles/animations.css` |
| 🟢 Low | Animation: Badge unlock sans effet | `notifications.js`, `styles/components.css` | 

---

## Historique des déploiements

| Heure | Composant | Raison |
|-------|-----------|--------|
| 23:15 | backend + frontend | Auth API-Ready (JWT header + API Key) |
| 23:35 | frontend | Mobile tab navigation (bottom bar) |

---

## Notes de session

```
Session pour valider:
1. Fix Safari iOS (JWT header au lieu de cookies)
2. Architecture API-Ready (JWT OU API Key)
3. UX générale LMS
```

---

*Session créée le: 2024-12-30*
*Dernière MAJ: 2024-12-31 01:45*

**FIXES APPLIQUÉS (01:45)**:
- ✅ Debug button mobile overlay (z-index au-dessus tab bar)
- ✅ Quiz couleurs illisibles (fond blanc iframe)
- ✅ Toast limit mobile (max 2 avec queue)
- ✅ Quiz padding mobile (100px bottom)
- ✅ URL 1-based (?step=1 au lieu de ?step=0)

**FIXES APPLIQUÉS (02:15)**:
- ✅ Desktop: Parcours actif visuellement sélectionné (classe .active)
- ✅ Mobile: Statut "En cours" pour cours actuel (au lieu de "Non commencé")
- ✅ Animation XP pop + floating number quand XP augmente
- ✅ Animation badge unlock spectaculaire avec particules
- ✅ Quiz message confirm() plus propre et lisible
- ✅ Quiz score affiché après soumission (score/maxScore + %)
