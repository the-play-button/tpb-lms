# 🎯 Test Accounts Ready - Third Pareto Features

## ✅ Comptes Créés et Fonctionnels

| Email | Role | User ID | Contact ID | CF Access |
|-------|------|---------|------------|-----------|
| `alice.student@test.local` | student | usr_86dab4bf | contact_usr_86dab4bf | ✅ |
| `bob.instructor@wge.local` | instructor | usr_cb488f50 | contact_usr_cb488f50 | ✅ |
| `charlie.admin@wge.local` | admin | usr_f819caf5 | contact_usr_f819caf5 | ✅ |

## 🚀 Comment Tester

### 1. Accès Direct
```
https://lms-viewer.theplaybutton.dev?som=pw05-2
```

### 2. Login Process
1. Clique sur le lien ci-dessus
2. CF Access va demander l'email
3. Utilise un des emails de test ci-dessus
4. CF Access va envoyer un code par email (ou utiliser SSO si configuré)

### 3. Tests Recommandés

#### Test Student (alice.student@test.local)
- ✅ Peut voir les cours
- ✅ Peut regarder les vidéos avec playback speed
- ✅ Peut voir les badges mastery
- ❌ **NE PEUT PAS** accéder au dashboard admin

#### Test Admin (charlie.admin@wge.local)  
- ✅ Peut tout faire comme student
- ✅ **PEUT** accéder au dashboard admin
- ✅ Peut voir les stats globales (GAP-604)

#### Test Instructor (bob.instructor@wge.local)
- ✅ Peut tout faire comme student
- ❌ **NE PEUT PAS** accéder au dashboard admin
- ✅ Permissions intermédiaires (si implémentées)

## 🎮 Features à Tester (Third Pareto)

### 🎭 RBAC & Admin Dashboard
- [ ] Login avec différents rôles
- [ ] Vérifier permissions par rôle
- [ ] Dashboard admin accessible seulement aux admins
- [ ] Stats globales dans dashboard admin

### 🏆 Mastery Badges & Gamification
- [ ] Progression 0% → 25% → 50% → 75% → 100%
- [ ] Badges : ⚪ → 🥉 → 🥈 → 🥇 → 👑
- [ ] Animations d'unlock
- [ ] Affichage dans course list

### ⚡ Video Playback Speed
- [ ] Bouton speed visible
- [ ] Cycle : 0.5x → 1x → 1.5x → 2x
- [ ] Audio sync à toutes les vitesses
- [ ] Indicateur vitesse mis à jour

### 📱 Responsive & Mobile
- [ ] Interface mobile adaptée
- [ ] Boutons touch-friendly
- [ ] Badges visibles sur mobile

## 🔧 Fixtures de Test

Pour setup des données de test spécifiques :

```bash
# Setup progression mastery
python scripts/tests/manual_fixtures.py mastery_progression --profile student_alice

# Setup données admin
python scripts/tests/manual_fixtures.py setup_admin --profile admin_charlie

# Clean slate
python scripts/tests/manual_fixtures.py clean_slate --profile student_alice
```

## 🐛 Si Problèmes

### Login ne fonctionne pas
1. Vérifier que CF Access est configuré pour ces emails
2. Checker les logs vault-api
3. Vérifier que les policies CF Access existent

### Rôles incorrects
1. Vérifier `hris_employee` table dans LMS DB
2. Tester `resolveRole()` function
3. Checker logs auth dans LMS

### Features manquantes
1. Vérifier déploiement LMS backend/frontend
2. Tester les endpoints API directement
3. Checker console browser pour erreurs JS

---

**Créé le** : 2025-12-30  
**Status** : ✅ Ready for Testing  
**Third Pareto Speedrun** : 100% Complete
