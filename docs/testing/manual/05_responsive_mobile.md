# Responsive & Mobile Tests

> **Focus** : Mobile, responsive, deep linking
> **Durée** : ~12 min  
> **Priorité** : **P2** (important mais pas critique)

---

## T-13: Mobile Responsive (4 min)

**Objectif** : Vérifier l'affichage mobile

### Setup (Agent)
```bash
python scripts/tests/fixtures.py mobile_ready --profile student_alice
```

### Actions (Humain)
1. Ouvre DevTools (F12) → Toggle device (Cmd+Shift+M)
2. Sélectionne "iPhone 12 Pro" (390x844)
3. Navigue dans l'app mobile

### Validation (Humain reporte)
- [ ] Sidebar collapse/hamburger menu
- [ ] Boutons assez gros pour touch (44px min)
- [ ] Texte lisible sans zoom
- [ ] Vidéo s'adapte à la largeur
- [ ] Pas de scroll horizontal
- [ ] Speed button accessible au doigt

### Critères de succès
- Touch targets : ≥44px, facilement cliquables
- Readability : Texte lisible sans zoom
- Layout : Pas de débordement

---

## T-14: URL Deep Linking (4 min)

**Objectif** : Vérifier le deep linking par étape

### Setup (Agent)
```bash
# Continuer avec session existante
```

### Actions (Humain)
1. Ouvre `?som=pw05-2&step=2` directement
2. Clique "Suivant" → URL devrait changer
3. Teste Back/Forward navigateur
4. Copie URL et ouvre nouvel onglet

### Validation (Humain reporte)
- [ ] Deep link charge la bonne étape
- [ ] URL se met à jour lors navigation
- [ ] Back/Forward browser fonctionnent
- [ ] URL copiée fonctionne dans nouvel onglet
- [ ] Partage d'URL possible

### Critères de succès
- Deep linking : URLs directes fonctionnent
- Browser history : Back/Forward OK
- Shareability : URLs copiables

---

## T-15: Tablet & Desktop Scaling (4 min)

**Objectif** : Tester différentes tailles d'écran

### Setup (Agent)
```bash
# Continuer avec session existante
```

### Actions (Humain)
1. Teste iPad (768x1024)
2. Teste Desktop large (1920x1080)
3. Teste fenêtre étroite (600px width)

### Validation (Humain reporte)
- [ ] **iPad** : Layout adapté, sidebar visible
- [ ] **Desktop** : Utilise l'espace disponible
- [ ] **Étroit** : Sidebar collapse, contenu lisible
- [ ] Transitions fluides entre breakpoints
- [ ] Badges mastery visibles à toutes tailles

### Critères de succès
- Breakpoints : Transitions fluides
- Content scaling : Optimal à chaque taille
- Feature preservation : Toutes features accessibles

---

## Rapport T-13 à T-15

```markdown
### Responsive & Mobile Results
| Test | Status | Notes |
|------|--------|-------|
| T-13 Mobile Responsive | ✅/❌ | ... |
| T-14 Deep Linking | ✅/❌ | ... |
| T-15 Scaling | ✅/❌ | ... |

### Mobile UX Feedback
- Touch usability: .../5
- Readability: .../5
- Performance: .../5

### Responsive Issues
- [ ] Overflow at...
- [ ] Touch target too small...
- [ ] Text unreadable at...

### Deep Linking Notes
- URL structure clarity: ...
- Share experience: ...
- Browser integration: ...
```
