# Mastery & Gamification Tests - Third Pareto Features

> **Focus** : Badges mastery, progression visuelle (GAP-112, GAP-602)
> **Durée** : ~10 min
> **Priorité** : **P1** (nouvelles features)

---

## T-07: Mastery Badge Progression (4 min)

**Objectif** : Tester la progression des badges mastery (🥉🥈🥇👑)

### Setup (Agent)
```bash
python scripts/tests/fixtures.py mastery_progression --profile student_alice
# Créer progression : 0% → 25% → 50% → 75% → 100%
```

### Actions (Humain)
1. Commence avec 0% progression
2. Progresse étape par étape
3. Observe les badges qui apparaissent

### Validation (Humain reporte)
- [ ] **0%** : Pas de badge (⚪ ou rien)
- [ ] **25%** : Badge Bronze 🥉 visible
- [ ] **50%** : Badge Silver 🥈 visible  
- [ ] **75%** : Badge Gold 🥇 visible
- [ ] **100%** : Badge Master 👑 visible
- [ ] Badges ont des couleurs distinctes
- [ ] Tooltips explicatifs au hover

### Critères de succès
- Badge visibility : Tous les niveaux visibles
- Visual feedback : Couleurs et icônes claires
- UX progression : Motivant et clair

---

## T-08: Mastery Badge Animation (3 min)

**Objectif** : Tester les animations d'unlock des badges

### Setup (Agent)
```bash
python scripts/tests/fixtures.py badge_unlock_ready --profile student_alice
# User à 24% progression, prêt pour unlock Bronze
```

### Actions (Humain)
1. Complète l'action qui fait passer de 24% → 26%
2. Observe l'animation d'unlock du badge Bronze
3. Teste avec d'autres niveaux si possible

### Validation (Humain reporte)
- [ ] Animation d'unlock visible (glow, pop, etc.)
- [ ] Son/feedback lors de l'unlock (si implémenté)
- [ ] Badge reste visible après animation
- [ ] Animation pas trop longue/gênante

### Critères de succès
- Animation quality : Fluide et satisfaisante
- Timing : Ni trop longue ni trop courte
- Polish : Feeling premium

---

## T-09: Course List Mastery Display (3 min)

**Objectif** : Vérifier l'affichage des badges dans la liste des cours

### Setup (Agent)
```bash
python scripts/tests/fixtures.py multiple_courses_mastery --profile student_alice
# Plusieurs cours avec différents niveaux de mastery
```

### Actions (Humain)
1. Regarde la liste des cours disponibles
2. Observe les badges à côté de chaque cours
3. Vérifie la cohérence des niveaux

### Validation (Humain reporte)
- [ ] Badges visibles dans course list
- [ ] Différents niveaux représentés
- [ ] Layout propre (badges pas en conflit avec texte)
- [ ] Hover states fonctionnels
- [ ] Responsive sur mobile

### Critères de succès
- Integration : Badges bien intégrés dans l'UI
- Readability : Texte + badges lisibles
- Consistency : Style cohérent partout

---

## Rapport T-07 à T-09

```markdown
### Mastery & Gamification Results
| Test | Status | Notes |
|------|--------|-------|
| T-07 Badge Progression | ✅/❌ | ... |
| T-08 Badge Animation | ✅/❌ | ... |
| T-09 Course List Display | ✅/❌ | ... |

### Gamification Feedback
- Badge visibility: ...
- Animation quality: ...
- Motivation factor: .../5
- Polish level: .../5

### Issues Found
- [ ] Badge rendering...
- [ ] Animation performance...
- [ ] Mobile display...

### UX Notes
- Most satisfying unlock: ...
- Confusing elements: ...
- Suggestions: ...
```
