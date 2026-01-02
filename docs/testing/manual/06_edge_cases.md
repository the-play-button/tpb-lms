# Edge Cases & Robustness Tests

> **Focus** : Multi-tabs, refresh, robustesse
> **Durée** : ~10 min
> **Priorité** : **P2** (robustesse)

---

## T-16: Multi-Tabs Coherence (3 min)

**Objectif** : Vérifier cohérence avec plusieurs onglets

### Setup (Agent)
```bash
python scripts/tests/fixtures.py multi_tab_ready --profile student_alice
```

### Actions (Humain)
1. Ouvre LMS dans onglet A
2. Duplique (Cmd+D) → onglet B
3. Onglet A : regarde vidéo 30s
4. Onglet B : refresh (F5)

### Validation (Humain reporte)
- [ ] XP identique dans les 2 onglets après refresh
- [ ] Progression synchronisée
- [ ] Pas de corruption d'état
- [ ] Badges cohérents partout

### Critères de succès
- State sync : Données identiques partout
- No corruption : État cohérent

---

## T-17: Refresh Mid-Action (4 min)

**Objectif** : Tester robustesse au refresh

### Setup (Agent)
```bash
# Continuer avec session existante
```

### Actions (Humain)
1. Lance vidéo, regarde jusqu'à 0:30
2. **F5** pendant la lecture
3. Navigue vers quiz, commence à remplir
4. **F5** pendant remplissage

### Validation (Humain reporte)
- [ ] **Vidéo** : Position préservée après refresh
- [ ] **Quiz** : Form reset (normal pour Tally)
- [ ] App reste fonctionnelle
- [ ] Pas d'erreurs JS visibles

### Critères de succès
- Video resilience : Position préservée
- App stability : Reste fonctionnelle
- Error handling : Graceful recovery

---

## T-18: Network Edge Cases (3 min)

**Objectif** : Tester avec connexion lente/instable

### Setup (Agent)
```bash
# Continuer avec session existante
```

### Actions (Humain)
1. DevTools → Network → Throttle "Slow 3G"
2. Navigue dans l'app
3. Lance une vidéo
4. Remet "No throttling"

### Validation (Humain reporte)
- [ ] **Slow 3G** : App reste utilisable
- [ ] Loading states visibles
- [ ] Vidéo s'adapte à la bande passante
- [ ] Pas de timeout/crash
- [ ] Recovery fluide quand réseau revient

### Critères de succès
- Slow network : App utilisable
- Loading UX : States informatifs
- Recovery : Automatique et fluide

---

## Rapport T-16 à T-18

```markdown
### Edge Cases & Robustness Results
| Test | Status | Notes |
|------|--------|-------|
| T-16 Multi-Tabs | ✅/❌ | ... |
| T-17 Refresh Robustness | ✅/❌ | ... |
| T-18 Network Edge Cases | ✅/❌ | ... |

### Robustness Feedback
- Multi-tab handling: .../5
- Refresh recovery: .../5
- Network resilience: .../5

### Edge Case Issues
- [ ] State corruption...
- [ ] Refresh errors...
- [ ] Network timeouts...

### Stability Notes
- Most robust feature: ...
- Most fragile area: ...
- Improvement suggestions: ...
```
