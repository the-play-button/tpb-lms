# Manual Testing Suite - LMS

## Structure

Tests organisés par catégorie pour faciliter les sessions manuelles :

| Fichier | Focus | Durée | Priorité |
|---------|-------|-------|----------|
| `01_core_ux.md` | UX de base (fresh user, video, quiz) | 15 min | **P0** |
| `02_rbac_admin.md` | **NOUVEAU** - RBAC, dashboard admin, roles | 10 min | **P1** |
| `03_mastery_gamification.md` | **NOUVEAU** - Badges, progression, XP | 10 min | **P1** |
| `04_video_features.md` | **NOUVEAU** - Playback speed, resume | 8 min | **P1** |
| `05_responsive_mobile.md` | Mobile, responsive, deep linking | 12 min | **P2** |
| `06_edge_cases.md` | Multi-tabs, refresh, robustesse | 10 min | **P2** |

## Quick Start

Pour une session rapide (P0 + P1 seulement) :

```bash
# 1. Setup fixtures
python scripts/tests/fixtures.py setup_test_profiles

# 2. Tests essentiels (35 min)
# - 01_core_ux.md
# - 02_rbac_admin.md  
# - 03_mastery_gamification.md
# - 04_video_features.md
```

## Test Profiles

✅ **Comptes créés et fonctionnels** (via vault-api + CF Access) :

| Profile | Email | Role | Usage |
|---------|-------|------|-------|
| `alice.student` | **alice.student@test.local** | student | Tests de base |
| `bob.instructor` | **bob.instructor@wge.local** | instructor | Tests instructor |
| `charlie.admin` | **charlie.admin@wge.local** | admin | Dashboard admin |

📋 **Voir détails complets** : [`TEST_ACCOUNTS_READY.md`](../TEST_ACCOUNTS_READY.md)

## Session Tracking

```bash
# Créer session de test
cp docs/testing/HITL_SESSION_TEMPLATE.md docs/testing/HITL_SESSION_$(date +%Y-%m-%d).md
```

L'agent met à jour le fichier session après chaque test.
