# RBAC & Admin Tests - Third Pareto Features

> **Focus** : RBAC, dashboard admin, roles (GAP-1208, GAP-1201, GAP-604)
> **Durée** : ~10 min
> **Priorité** : **P1** (nouvelles features)

---

## T-04: Student Role Limitations (3 min)

**Objectif** : Vérifier que les students n'accèdent pas aux features admin

### Setup (Agent)
```bash
python scripts/tests/fixtures.py setup_student --profile student_alice
```

### Actions (Humain)
1. Connecte-toi en tant que student (alice@test.local)
2. Essaie d'accéder à des URLs admin :
   - `/admin` (si existe)
   - Cherche des boutons "Admin" dans l'UI

### Validation (Humain reporte)
- [ ] Aucun accès admin visible dans l'UI
- [ ] Pas de boutons/liens admin
- [ ] Navigation normale fonctionne

### Critères de succès
- Admin features : Cachées pour students
- UX : Pas de confusion sur les permissions

---

## T-05: Admin Dashboard Access (4 min)

**Objectif** : Tester l'accès admin et les stats (GAP-604)

### Setup (Agent)
```bash
python scripts/tests/fixtures.py setup_admin --profile admin_charlie
```

### Actions (Humain)
1. Connecte-toi en tant qu'admin (charlie@wge.local)
2. Cherche le dashboard admin dans l'UI
3. Accède aux statistiques globales

### Validation (Humain reporte)
- [ ] Dashboard admin accessible
- [ ] Stats globales affichées :
  - [ ] Total students
  - [ ] Actifs 24h/7j
  - [ ] Cours complétés
  - [ ] Score moyen quiz
- [ ] Interface admin claire

### Critères de succès
- Admin access : Visible et fonctionnel
- Stats accuracy : Cohérentes avec les données

### DB Verification (Agent)
```bash
npx wrangler d1 execute lms-db --remote --command \
  "SELECT * FROM v_admin_overview;"
```

---

## T-06: Role Resolution (3 min)

**Objectif** : Vérifier que les rôles sont correctement détectés (GAP-1208, GAP-1201)

### Setup (Agent)
```bash
python scripts/tests/fixtures.py setup_instructor --profile instructor_bob
```

### Actions (Humain)
1. Connecte-toi en tant qu'instructor (bob@wge.local)
2. Vérifie ton profil/session
3. Teste les permissions intermédiaires

### Validation (Humain reporte)
- [ ] Rôle "instructor" affiché quelque part
- [ ] Plus de permissions qu'un student
- [ ] Moins de permissions qu'un admin
- [ ] Accès aux données étudiants (si implémenté)

### Critères de succès
- Role display : Visible dans l'UI
- Permissions : Cohérentes avec le rôle

### API Verification (Agent)
```bash
# Vérifier que l'API retourne le bon rôle
curl -H "Authorization: Bearer <instructor_token>" \
  "https://lms-api.matthieu-marielouise.workers.dev/api/auth/session"
```

---

## Rapport T-04 à T-06

```markdown
### RBAC & Admin Results
| Test | Status | Notes |
|------|--------|-------|
| T-04 Student Limits | ✅/❌ | ... |
| T-05 Admin Dashboard | ✅/❌ | ... |
| T-06 Role Resolution | ✅/❌ | ... |

### RBAC Issues
- [ ] Role display...
- [ ] Permission boundary...
- [ ] Admin UI...

### Admin Dashboard Feedback
- Stats accuracy: ...
- UI clarity: ...
- Performance: ...
```
