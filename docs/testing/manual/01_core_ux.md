# Core UX Tests - Must Test Manual

> **Focus** : UX de base - fresh user, vidéo, quiz
> **Durée** : ~15 min
> **Priorité** : **P0** (critique)

---

## T-01: Fresh User Experience (5 min)

**Objectif** : Premier contact utilisateur

### Setup (Agent)
```bash
python scripts/tests/fixtures.py clean_slate --profile student_alice
```

### Actions (Humain)
1. Ouvre https://lms-viewer.matthieu-marielouise.workers.dev?som=pw05-2
2. **Cmd+Shift+R** (hard refresh)

### Validation (Humain reporte)
- [ ] XP affiché = 0
- [ ] Interface intuitive au premier regard
- [ ] Pas d'erreurs visibles
- [ ] Design professionnel

### Critères de succès
- UX feeling : Positif
- Console errors : 0 (agent vérifie via MCP)

---

## T-02: Video Playback & Resume (5 min)

**Objectif** : Lecture vidéo réelle + resume position

### Setup (Agent)
```bash
python scripts/tests/fixtures.py video_progress --profile student_alice
```

### Actions (Humain)
1. Lance vidéo, regarde 30 secondes
2. Note position (ex: 0:45)
3. Ferme onglet complètement
4. Rouvre l'URL

### Validation (Humain reporte)
- [ ] Vidéo reprend à ±5s de la position
- [ ] Player fluide, pas de lag
- [ ] XP augmente pendant la lecture

### Critères de succès
- Resume position : ±5 secondes
- Player performance : Fluide

---

## T-03: Quiz Complete Flow (5 min)

**Objectif** : Quiz Tally + scoring

### Setup (Agent)
```bash
python scripts/tests/fixtures.py quiz_ready --profile student_alice
```

### Actions (Humain)
1. Navigue vers étape quiz
2. Remplis et soumets le quiz
3. Observe les changements

### Validation (Humain reporte)
- [ ] Formulaire Tally s'affiche
- [ ] Soumission fluide
- [ ] XP augmente après soumission
- [ ] Badge "first quiz" apparaît

### Critères de succès
- Quiz flow : Complet sans blocage
- XP delta : +50 points
- Badge unlock : Visible

---

## Rapport T-01 à T-03

```markdown
### Core UX Results
| Test | Status | Notes |
|------|--------|-------|
| T-01 Fresh User | ✅/❌ | ... |
| T-02 Video Resume | ✅/❌ | ... |
| T-03 Quiz Flow | ✅/❌ | ... |

### Issues Found
- [ ] Issue 1...
- [ ] Issue 2...
```
