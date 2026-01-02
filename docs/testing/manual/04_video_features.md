# Video Features Tests - Third Pareto Features

> **Focus** : Playback speed, contrôles vidéo (GAP-101)
> **Durée** : ~8 min
> **Priorité** : **P1** (nouvelles features)

---

## T-10: Playback Speed Controls (4 min)

**Objectif** : Tester les contrôles de vitesse vidéo (0.5x, 1x, 1.5x, 2x)

### Setup (Agent)
```bash
python scripts/tests/fixtures.py video_ready --profile student_alice
```

### Actions (Humain)
1. Lance une vidéo
2. Cherche le bouton de vitesse dans l'interface
3. Clique pour cycler entre les vitesses
4. Teste chaque vitesse pendant ~10 secondes

### Validation (Humain reporte)
- [ ] Bouton speed visible et accessible
- [ ] **0.5x** : Vidéo ralentie, audio sync
- [ ] **1x** : Vitesse normale (défaut)
- [ ] **1.5x** : Accéléré, audio sync
- [ ] **2x** : Très rapide, audio sync
- [ ] Indicateur vitesse mis à jour (ex: "1.5x")
- [ ] Transitions fluides entre vitesses

### Critères de succès
- Speed control : Toutes vitesses fonctionnelles
- Audio sync : Pas de désynchronisation
- UX : Contrôle intuitif et responsive

---

## T-11: Speed Control UX & Persistence (2 min)

**Objectif** : Tester l'UX et la persistance des réglages

### Setup (Agent)
```bash
# Continuer avec la même session
```

### Actions (Humain)
1. Règle vitesse à 1.5x
2. Passe à la vidéo suivante
3. Refresh la page
4. Change d'onglet et reviens

### Validation (Humain reporte)
- [ ] Vitesse préservée entre vidéos
- [ ] Vitesse reset à 1x après refresh (comportement normal)
- [ ] Bouton reste accessible sur mobile
- [ ] Pas de conflit avec autres contrôles

### Critères de succès
- Persistence : Cohérente dans la session
- Mobile UX : Bouton utilisable au doigt
- Integration : Pas de conflit UI

---

## T-12: Speed + Resume Interaction (2 min)

**Objectif** : Tester l'interaction vitesse + resume position

### Setup (Agent)
```bash
# Continuer avec la même session
```

### Actions (Humain)
1. Lance vidéo à 2x speed
2. Regarde 30 secondes
3. Ferme onglet
4. Rouvre → vidéo devrait reprendre

### Validation (Humain reporte)
- [ ] Position resume correcte (même avec vitesse modifiée)
- [ ] Vitesse reset à 1x au reload (normal)
- [ ] Pas d'erreurs de tracking
- [ ] Expérience fluide

### Critères de succès
- Resume accuracy : Position correcte malgré speed change
- No conflicts : Speed et resume compatibles

---

## Rapport T-10 à T-12

```markdown
### Video Features Results
| Test | Status | Notes |
|------|--------|-------|
| T-10 Speed Controls | ✅/❌ | ... |
| T-11 Speed UX | ✅/❌ | ... |
| T-12 Speed + Resume | ✅/❌ | ... |

### Speed Control Feedback
- Button placement: ...
- Speed transitions: ...
- Audio quality: ...
- Mobile usability: .../5

### Issues Found
- [ ] Speed button...
- [ ] Audio sync...
- [ ] Mobile touch...

### Feature Requests
- Keyboard shortcuts (space, arrows): ...
- More speeds (0.75x, 1.25x): ...
- Speed memory: ...
```
