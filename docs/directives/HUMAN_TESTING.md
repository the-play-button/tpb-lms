# Human Testing - LMS (Agent Directive)

> **Purpose**: Directive pour l'agent IA qui guide un humain à travers les tests manuels
> **Pattern**: Agent setup → DB verify → Prompt humain → Sync → MCP console → Next
> **Hybrid HITL**: L'humain fait les actions, l'agent vérifie DB et console

---

## 🆕 Nouvelle Structure Modulaire

Les tests sont maintenant organisés en modules dans `docs/testing/manual/` :

| Module | Focus | Durée | Priorité |
|--------|-------|-------|----------|
| **[01_core_ux.md](../testing/manual/01_core_ux.md)** | UX de base (fresh user, vidéo, quiz) | 15 min | **P0** |
| **[02_rbac_admin.md](../testing/manual/02_rbac_admin.md)** | 🆕 RBAC, dashboard admin, roles | 10 min | **P1** |
| **[03_mastery_gamification.md](../testing/manual/03_mastery_gamification.md)** | 🆕 Badges mastery, progression | 10 min | **P1** |
| **[04_video_features.md](../testing/manual/04_video_features.md)** | 🆕 Playback speed, contrôles | 8 min | **P1** |
| **[05_responsive_mobile.md](../testing/manual/05_responsive_mobile.md)** | Mobile, responsive, deep linking | 12 min | **P2** |
| **[06_edge_cases.md](../testing/manual/06_edge_cases.md)** | Multi-tabs, refresh, robustesse | 10 min | **P2** |

### Quick Start (P0 + P1 = 43 min)

```bash
# 1. Setup tous les profils de test
python scripts/tests/manual_fixtures.py setup_test_profiles

# 2. Tests essentiels seulement
# - 01_core_ux.md (15 min)
# - 02_rbac_admin.md (10 min) 
# - 03_mastery_gamification.md (10 min)
# - 04_video_features.md (8 min)
```

---

## Goal

Valider les features LMS avec un humain dans la boucle, guidé par l'agent IA.

**IMPORTANT**: MCP Browser n'a **PAS** les cookies Cloudflare Access. Il ne peut **PAS** voir l'état utilisateur (XP, progress). Ne jamais utiliser MCP pour observer l'état authentifié !

**Humain valide** (ne peut pas être automatisé) :
- UX subjective (intuitivité, feeling)
- État visuel (XP, badges, progress affiché)
- Vraie lecture vidéo (Stream SDK)
- Responsive/mobile (device réel)
- Edge cases (refresh, multi-tabs, slow network)
- **🆕 RBAC** : Dashboard admin, permissions par rôle
- **🆕 Mastery badges** : Progression visuelle, animations
- **🆕 Playback speed** : Contrôles vidéo, UX

**Agent valide** :
- DB queries (via wrangler d1) → vérifier état backend
- MCP Browser → **UNIQUEMENT pour console errors**
- API calls (via service account) → vérifier structure réponse

---

## Live Session Tracking

> **OBLIGATOIRE** : L'agent DOIT créer et maintenir un fichier de session pendant les tests.

### Au début de la session

```bash
# Copier le template
cp docs/testing/HITL_SESSION_TEMPLATE.md docs/testing/HITL_SESSION_$(date +%Y-%m-%d).md
```

Puis éditer le fichier avec les infos utilisateur (email, user_id, contact_id).

### Pendant la session

L'agent DOIT mettre à jour le fichier après chaque scénario :
1. **Status** : ⏳ → ✅/❌/⚠️
2. **Issues** : Ajouter immédiatement toute issue trouvée
3. **Fixes** : Cocher quand un fix est déployé
4. **Notes** : Feedback UX verbatim

### Règles

- **JAMAIS** perdre d'information dans le chat
- **TOUJOURS** capitaliser dans le fichier session
- Après chaque réponse utilisateur → MAJ fichier
- Après chaque fix/deploy → MAJ historique

### Template

Voir [`docs/testing/HITL_SESSION_TEMPLATE.md`](../testing/HITL_SESSION_TEMPLATE.md)

---

## URLs

| Environment | Frontend | API |
|-------------|----------|-----|
| Production | https://lms-viewer.matthieu-marielouise.workers.dev?som=pw05-2 | https://lms-api.matthieu-marielouise.workers.dev |

**Note**: Toujours utiliser `?som=pw05-2` pour les tests (cours de test).

---

## Tools/Scripts

| Tool | Usage |
|------|-------|
| **`scripts/tests/manual_fixtures.py`** | **🆕 Fixtures pour tests manuels avec profils** |
| `scripts/tests/fixtures.py` | Fixtures DB génériques (AVEC venv activé) |
| `scripts/tests/validate_state.py` | Vérifie état DB après test |
| `npx wrangler d1 execute` | Query DB direct pour vérifier données |
| `mcp_browser_console_messages` | Agent check erreurs JS (seule utilisation MCP !) |

### 🆕 Nouveaux Profils de Test

```bash
# Créer tous les profils de test (une seule fois)
python scripts/tests/manual_fixtures.py setup_test_profiles
```

| Profile | Email | Role | Usage |
|---------|-------|------|-------|
| `student_alice` | alice@test.local | student | Tests de base, UX |
| `instructor_bob` | bob@wge.local | instructor | Tests permissions intermédiaires |
| `admin_charlie` | charlie@wge.local | admin | Dashboard admin, stats globales |

### 🆕 Fixtures Spécialisées

```bash
# Clean slate pour un profil
python scripts/tests/manual_fixtures.py clean_slate --profile student_alice

# Setup progression vidéo
python scripts/tests/manual_fixtures.py video_progress --profile student_alice

# Setup badges mastery (différents niveaux)
python scripts/tests/manual_fixtures.py mastery_progression --profile student_alice

# Setup données admin dashboard
python scripts/tests/manual_fixtures.py setup_admin --profile admin_charlie
```

### Vérifier fixture via DB (OBLIGATOIRE après chaque fixture)

```bash
# Vérifier que les données existent avec le bon contact_id
npx wrangler d1 execute lms-db --remote --command \
  "SELECT user_id, class_id, video_completed, quiz_passed FROM v_user_progress WHERE user_id LIKE 'contact_%' ORDER BY class_id LIMIT 10;"
```

### Contact ID de l'utilisateur test

```bash
# Trouver le contact_id pour un email
npx wrangler d1 execute lms-db --remote --command \
  "SELECT id FROM crm_contact WHERE emails_json LIKE '%email@example.com%';"
```

---

## Flow Pattern

Pour chaque scénario, l'agent doit :

```
1. SETUP      → Exécuter le script de fixture (avec venv)
2. VERIFY DB  → Query wrangler d1 pour confirmer les données
3. PROMPT     → Envoyer les instructions à l'humain
4. SYNC       → Humain fait l'action + décrit ce qu'il VOIT (XP, badges, etc.)
5. CONSOLE    → Agent check MCP console_messages pour erreurs JS
6. CAPITALIZE → MAJ fichier session (status, issues, feedback)
7. VALIDER    → Agent compare feedback humain + console vs critères
8. BRANCHER   → PASS → suivant | FAIL → troubleshoot + MAJ session
```

> ⚠️ **CAPITALIZE** : Après CHAQUE feedback humain, l'agent met à jour le fichier `HITL_SESSION_*.md`

### Vérification DB (OBLIGATOIRE après fixture)

```bash
# Vérifier progression insérée
npx wrangler d1 execute lms-db --remote --command \
  "SELECT class_id, video_completed, quiz_passed FROM v_user_progress WHERE user_id = 'contact_xxx';"
```

### MCP Console (seule utilisation autorisée)

```python
# Checker les erreurs JS - SEULE utilisation de MCP !
console = browser_console_messages()
# Ignorer: platform.dash.cloudflare.com/sentry (bruit Cloudflare)
errors = [m for m in console if "error" in str(m).lower() and "sentry" not in str(m)]
```

### Ce que l'humain doit reporter

L'agent demande TOUJOURS à l'humain de décrire :
- XP affiché (valeur exacte)
- Badges visibles (lesquels)
- Step actuel (numéro)
- Boutons actifs/grisés

---

## Continuous Fix Flow

Quand un bug est détecté pendant les tests, suivre ce flux :

### 1. Identifier le bug

| Symptôme | Fichier probable |
|----------|------------------|
| Console JS errors | `frontend/app/*.js` |
| CORS errors | `backend/cors.js` ou `backend/middleware/*.js` |
| 404/403 | Routing ou auth (`backend/index.js`, `backend/auth.js`) |
| Favicon 403 | `frontend/index.html` |

### 2. Corriger le code

- Éditer les fichiers nécessaires
- **Pas de raccourcis** - corriger à la source
- Vérifier les imports, les headers CORS, etc.

### 3. Déployer via scripts (OBLIGATOIRE)

> ⚠️ **JAMAIS** utiliser `npx wrangler deploy` directement !
> Toujours passer par les scripts de déploiement.

```bash
# Pré-requis : Node 22
source ~/.nvm/nvm.sh && nvm use 22

# Aller dans le dossier LMS
cd tpb_system/04.Execution/lms

# Deploy complet (backend + frontend)
python3 scripts/devops/deploy.py

# Backend seul (plus rapide)
python3 scripts/devops/deploy.py --backend --skip-db --skip-verify

# Frontend seul
python3 scripts/devops/deploy.py --frontend --skip-verify
```

### 4. Re-tester

1. Humain fait **Cmd+Shift+R** (hard refresh)
2. Agent vérifie console via MCP : `browser_console_messages()`
3. **Boucler** jusqu'à 0 erreurs

### 5. Fixtures avec venv

```bash
# Activer le venv AVANT d'appeler fixtures.py
source .venv/bin/activate
cd tpb_system/04.Execution/lms
python3 scripts/tests/fixtures.py clean_slate --user-id <UUID> --email <EMAIL>
```

---

## Scénarios

### H-01: Fresh User Experience

**Objectif**: Vérifier l'expérience premier utilisateur

#### 1. Setup (Agent exécute)

```bash
# Activer venv + appliquer fixture
cd "/path/to/project"
source .venv/bin/activate
cd tpb_system/04.Execution/lms
python3 scripts/tests/fixtures.py clean_slate --user-id <USER_ID> --email <EMAIL>
```

#### 2. Verify DB (Agent vérifie)

```bash
# Confirmer que les données sont nettoyées
source ~/.nvm/nvm.sh && nvm use 22
npx wrangler d1 execute lms-db --remote --command \
  "SELECT COUNT(*) as count FROM v_user_progress WHERE user_id = 'contact_xxx';"
# Attendu: count = 0
```

#### 3. Prompt Humain (Agent envoie)

> 🧪 **Test H-01: Fresh User Experience**
>
> Fixture `clean_slate` appliquée. DB vérifiée : 0 progression.
>
> **Action**: Ouvre https://lms-viewer.matthieu-marielouise.workers.dev?som=pw05-2 (Cmd+Shift+R)
>
> **Dis-moi** (je ne peux PAS voir ton écran) :
> 1. XP affiché en haut ? (devrait être 0)
> 2. Badges visibles ? (lesquels, tous grisés ?)
> 3. Impression UX ? (intuitif, clair, confus ?)
> 4. Animations fluides ?
> 5. Design pro ?

#### 4. Console Check (Agent via MCP)

```python
console = browser_console_messages()
# Filtrer le bruit Cloudflare Sentry
errors = [m for m in console if "error" in str(m).lower() and "sentry" not in str(m)]
```

#### 5. Critères de validation

| Check | Source | Attendu |
|-------|--------|---------|
| DB clean | wrangler d1 | 0 rows |
| XP | Humain reporte | 0 |
| Welcome visible | Humain reporte | Oui |
| Console errors | MCP console | 0 (hors Sentry) |
| UX feeling | Humain | Positif |

#### 6. Branching

- **Tous OK** → Passer à H-02
- **Erreurs console** → Debug JS
- **XP ≠ 0** → Fixture cassée, vérifier contact_id
- **UX négatif** → Noter pour backlog

---

### H-02: Video Playback & Resume

**Objectif**: Vérifier la vraie lecture vidéo et le resume

#### 1. Setup (Agent exécute)

```bash
source .venv/bin/activate
cd tpb_system/04.Execution/lms
python3 scripts/tests/fixtures.py step3 --user-id <USER_ID> --email <EMAIL>
```

#### 2. Verify DB (Agent vérifie)

```bash
npx wrangler d1 execute lms-db --remote --command \
  "SELECT class_id, video_completed FROM v_user_progress WHERE user_id = 'contact_xxx';"
# Attendu: 2 rows (step01, step02) avec video_completed=1
```

#### 3. Prompt Humain (Agent envoie)

> 🧪 **Test H-02: Video Playback & Resume**
>
> Fixture `step3` appliquée. DB confirmée : steps 1-2 complétés.
>
> **Actions** :
> 1. **Cmd+Shift+R** pour refresh
> 2. Tu devrais être sur step 3 avec XP > 0
> 3. Lance la vidéo, regarde 10-15 secondes
> 4. Note la position (ex: 0:45)
> 5. Ferme l'onglet complètement
> 6. Rouvre https://lms-viewer.matthieu-marielouise.workers.dev?som=pw05-2
>
> **Dis-moi** :
> 1. XP affiché ? (devrait être > 0)
> 2. Step actuel ? (devrait être 3)
> 3. La vidéo a repris à ta position (±5s) ?
> 4. Player fluide ?

#### 4. Console Check (Agent via MCP)

```python
console = browser_console_messages()
# Chercher "Resuming video at" dans les logs
resume_log = [m for m in console if "Resuming video" in str(m)]
```

#### 5. Critères de validation

| Check | Source | Attendu |
|-------|--------|---------|
| DB | wrangler d1 | 2 rows step01/02 |
| XP | Humain reporte | > 0 |
| Step | Humain reporte | 3 |
| Resume position | Humain | ±5 secondes |
| Resume log | MCP console | "Resuming video at Xs" |

#### 6. Branching

- **Tous OK** → Passer à H-03
- **XP = 0** → Fixture n'utilise pas le bon contact_id
- **Resume KO** → Vérifier tracking.js, video_positions

---

### H-03: Quiz Complete Flow

**Objectif**: Tester l'expérience quiz complète

#### 1. Setup (Agent exécute)

```bash
python3 scripts/tests/fixtures.py step3 --user-id <USER_ID> --email <EMAIL>
```

#### 2. Observe (Agent MCP)

```python
browser_navigate("https://lms-viewer.matthieu-marielouise.workers.dev?som=pw05-2")
snapshot = browser_snapshot()
xp_before = extract_xp(snapshot)  # Noter XP avant quiz
```

#### 3. Prompt Humain (Agent envoie)

> 🧪 **Test H-03: Quiz Complete Flow**
>
> Fixture `step3` appliquée. XP actuel : {xp_before}.
>
> **Actions** :
> 1. Navigue jusqu'à l'étape quiz
> 2. Réponds au quiz (peu importe les réponses)
> 3. Soumets
> 4. Dis-moi "OK soumis" quand c'est fait
>
> **Dis-moi** :
> 1. Le formulaire Tally s'affiche bien ?
> 2. L'expérience de soumission est fluide ?

#### 4. Sync + Snapshot (après "OK soumis")

```python
browser_navigate(current_url)  # Refresh pour sync
snapshot = browser_snapshot()
xp_after = extract_xp(snapshot)
# Vérifier: XP augmenté, badge visible, bouton Suivant actif
console = browser_console_messages()
```

#### 5. Critères de validation

| Check | Source | Attendu |
|-------|--------|---------|
| Tally form | Humain | Visible, fonctionnel |
| XP delta | MCP snapshot | +50 si passed |
| Badge earned | MCP snapshot | first_quiz visible |
| Suivant actif | MCP snapshot | Bouton cliquable |
| Console errors | MCP console | 0 erreurs |

#### 6. Branching

- **Quiz OK** → Passer à H-04
- **Tally non visible** → Vérifier iframe, form_id
- **XP non mis à jour** → Vérifier webhook Tally, projections

#### 7. Validation DB (optionnel)

```bash
python3 scripts/tests/validate_state.py quiz_complete --user-id <USER_ID>
```

---

### H-04: Mobile/Responsive

**Objectif**: Vérifier l'affichage mobile

#### 1. Setup (Agent exécute)

```bash
python3 scripts/tests/fixtures.py step3 --user-id <USER_ID> --email <EMAIL>
```

#### 2. Observe (Agent MCP - resize mobile)

```python
browser_navigate("https://lms-viewer.matthieu-marielouise.workers.dev?som=pw05-2")
browser_resize(width=390, height=844)  # iPhone 12 Pro
snapshot = browser_snapshot()
# Vérifier structure DOM en mobile
```

#### 3. Prompt Humain (Agent envoie)

> 🧪 **Test H-04: Mobile/Responsive**
>
> J'ai redimensionné mon MCP en 390x844 (iPhone). Je vois le DOM mobile.
>
> **Actions** (toi sur ton device/devtools) :
> 1. Ouvre DevTools (F12) → Toggle device toolbar (Cmd+Shift+M)
> 2. Sélectionne "iPhone 12 Pro"
> 3. Navigue dans l'app
>
> **Dis-moi** (aspects tactiles que je ne peux pas tester) :
> 1. Les boutons sont assez gros pour toucher ?
> 2. Le scroll est fluide ?
> 3. Le texte est lisible sans zoom ?
> 4. Quelque chose déborde de l'écran ?

#### 4. Critères de validation

| Check | Source | Attendu |
|-------|--------|---------|
| Sidebar collapse | MCP snapshot | Hamburger ou collapse |
| Video 100% width | MCP snapshot | Pas de scroll H |
| Touch targets | Humain | Assez gros |
| Lisibilité | Humain | OK sans zoom |

#### 5. Branching

- **Tous OK** → Passer à H-05
- **Overflow** → CSS à fixer, noter le composant
- **Touch trop petit** → Augmenter taille boutons

---

### H-05: URL Deep Linking

**Objectif**: Vérifier le deep linking par étape

#### 1. Setup (Agent exécute)

```bash
python3 scripts/tests/fixtures.py step3 --user-id <USER_ID> --email <EMAIL>
```

#### 2. Observe (Agent MCP - deep link)

```python
browser_navigate("https://lms-viewer.matthieu-marielouise.workers.dev?som=pw05-2&step=1")
snapshot = browser_snapshot()
# Vérifier: sur étape 2 (index 1)
```

#### 3. Prompt Humain (Agent envoie)

> 🧪 **Test H-05: URL Deep Linking**
>
> J'ai ouvert `?step=1` via MCP et je vois l'étape correspondante.
>
> **Actions** (toi pour tester history browser) :
> 1. Ouvre `https://lms-viewer.matthieu-marielouise.workers.dev?som=pw05-2&step=1`
> 2. Clique "Suivant"
> 3. Regarde si l'URL change à `?step=2`
> 4. Clique Back dans le navigateur
> 5. Copie l'URL et ouvre dans nouvel onglet
>
> **Dis-moi** :
> 1. Back/Forward browser fonctionne ?
> 2. L'URL copiée dans nouvel onglet charge la bonne étape ?

#### 4. Sync + Snapshot

```python
# Après navigation humaine
browser_navigate("https://lms-viewer.matthieu-marielouise.workers.dev?som=pw05-2")
# L'URL devrait maintenant avoir ?step=N
```

#### 5. Critères de validation

| Check | Source | Attendu |
|-------|--------|---------|
| Deep link | MCP | Charge étape demandée |
| URL update | MCP/Humain | ?step=N change |
| History | Humain | Back/Forward OK |
| Shareable | Humain | Nouvel onglet OK |

#### 6. Branching

- **Tous OK** → Passer à H-06
- **Deep link KO** → Vérifier index.js, loader.js
- **History KO** → Vérifier popstate handler

---

### H-06: Multi-Tabs Coherence

**Objectif**: Vérifier la cohérence avec plusieurs onglets

#### 1. Setup (Agent exécute)

```bash
python3 scripts/tests/fixtures.py step3 --user-id <USER_ID> --email <EMAIL>
```

#### 2. Observe (Agent MCP - état initial)

```python
browser_navigate("https://lms-viewer.matthieu-marielouise.workers.dev?som=pw05-2")
snapshot_before = browser_snapshot()
xp_before = extract_xp(snapshot_before)
```

#### 3. Prompt Humain (Agent envoie)

> 🧪 **Test H-06: Multi-Tabs Coherence**
>
> XP initial via MCP : {xp_before}
>
> **Actions** (multi-tabs = test humain) :
> 1. Ouvre l'LMS dans onglet A
> 2. Duplique (Cmd+D) → onglet B
> 3. Onglet A : regarde vidéo 30s
> 4. Onglet B : refresh (F5)
> 5. Dis-moi "OK refreshed"
>
> **Dis-moi** :
> 1. Les XP sont identiques dans les 2 onglets ?
> 2. Pas de glitch visuel ?

#### 4. Sync + Snapshot (après "OK refreshed")

```python
browser_navigate(current_url)  # Refresh MCP aussi
snapshot_after = browser_snapshot()
xp_after = extract_xp(snapshot_after)
# Comparer avec ce que l'humain voit
```

#### 5. Critères de validation

| Check | Source | Attendu |
|-------|--------|---------|
| XP sync | MCP + Humain | Identique partout |
| Pas de corruption | Humain | État cohérent |
| Console errors | MCP console | 0 erreurs |

#### 6. Branching

- **Cohérent** → Passer à H-07
- **Incohérent** → Vérifier cache, state management

---

### H-07: Refresh Mid-Action

**Objectif**: Vérifier la robustesse au refresh

#### 1. Setup (Agent exécute)

```bash
python3 scripts/tests/fixtures.py step3 --user-id <USER_ID> --email <EMAIL>
```

#### 2. Observe (Agent MCP)

```python
browser_navigate("https://lms-viewer.matthieu-marielouise.workers.dev?som=pw05-2")
snapshot = browser_snapshot()
```

#### 3. Prompt Humain (Agent envoie)

> 🧪 **Test H-07: Refresh Mid-Action**
>
> **Actions** (edge cases = test humain) :
> 1. Lance une vidéo, regarde jusqu'à 0:30
> 2. Appuie F5 pendant la lecture
> 3. Dis-moi "OK refreshed vidéo"
> 4. Navigue vers le quiz, commence à remplir (sans soumettre)
> 5. Appuie F5
> 6. Dis-moi "OK refreshed quiz"
>
> **Dis-moi** :
> 1. Position vidéo préservée après refresh ?
> 2. Quiz reset après refresh ? (comportement normal Tally)
> 3. App toujours fonctionnelle ?

#### 4. Sync + Snapshot (après chaque "OK refreshed")

```python
console = browser_console_messages()
errors = [m for m in console if "error" in m.lower()]
# Reporter si erreurs JS après refresh
```

#### 5. Critères de validation

| Check | Source | Attendu |
|-------|--------|---------|
| Video position | Humain | Préservée ±5s |
| Quiz form | Humain | Reset (normal) |
| Console errors | MCP console | 0 erreurs |
| App state | Humain | Fonctionnelle |

#### 6. Branching

- **Robuste** → Passer à H-08
- **Erreurs console** → Debug JS
- **App cassée** → Vérifier error handling, state init

---

### H-08: Animations & Polish

**Objectif**: Vérifier les animations et le polish visuel

#### 1. Setup (Agent exécute)

```bash
python3 scripts/tests/fixtures.py clean_slate --user-id <USER_ID> --email <EMAIL>
```

#### 2. Observe (Agent MCP)

```python
browser_navigate("https://lms-viewer.matthieu-marielouise.workers.dev?som=pw05-2")
snapshot = browser_snapshot()
# XP = 0, fresh state
```

#### 3. Prompt Humain (Agent envoie)

> 🧪 **Test H-08: Animations & Polish**
>
> État fresh. XP = 0.
>
> **Actions** (animations = 100% perception humaine) :
> 1. Clique sur un cours pour le charger
> 2. Regarde une vidéo → XP devrait augmenter
> 3. Observe les animations en temps réel
>
> **Dis-moi** :
> 1. XP counter fait un "pop" quand il augmente ?
> 2. Badge unlock a une animation/glow ?
> 3. Transitions entre étapes fluides ?
> 4. Hover states visibles sur les boutons ?
> 5. **Note globale polish (1-5)** + commentaires

#### 4. Sync + Snapshot (à la fin)

```python
browser_navigate(current_url)
snapshot = browser_snapshot()
console = browser_console_messages()
# Vérifier XP a augmenté, pas d'erreurs
```

#### 5. Critères de validation

| Check | Source | Attendu |
|-------|--------|---------|
| XP pop | Humain | Animation visible |
| Badge glow | Humain | Animation visible |
| Transitions | Humain | Fluides |
| Hover states | Humain | Visibles |
| Polish score | Humain | Note 1-5 |
| Console errors | MCP console | 0 erreurs |

#### 6. Branching

- **Polish ≥ 4** → 🎉 Tests terminés !
- **Animations manquantes** → Vérifier animations.css, keyframes
- **Score < 3** → Prioriser backlog UX

---

## Récapitulatif

| ID | Scénario | Fixture | Focus |
|----|----------|---------|-------|
| H-01 | Fresh User UX | `clean_slate` | Premier contact, intuitivité |
| H-02 | Video Resume | `step3` | Lecture réelle, resume position |
| H-03 | Quiz Flow | `step3` | Tally, scoring, badges |
| H-04 | Mobile/Responsive | `step3` | Viewport mobile |
| H-05 | URL Deep Linking | `step3` | ?step=N, history |
| H-06 | Multi-Tabs | `step3` | Cohérence données |
| H-07 | Refresh Mid-Action | `step3` | Robustesse |
| H-08 | Animations | `clean_slate` | Polish visuel |

---

## Rapport Final

À la fin des tests, l'agent compile :

```markdown
## Human Testing Report - [DATE]

### Results
| ID | Scenario | Status | Notes |
|----|----------|--------|-------|
| H-01 | Fresh User | ✅/❌ | ... |
| H-02 | Video Resume | ✅/❌ | ... |
...

### Issues Found
1. [ISSUE] Description...
2. [ISSUE] Description...

### UX Feedback
- Polish score: X/5
- Comments: ...

### Recommended Actions
1. ...
2. ...
```

---

*Last updated: 2024-12-29*
*Enhanced with MCP Browser observation: 2024-12-29*

