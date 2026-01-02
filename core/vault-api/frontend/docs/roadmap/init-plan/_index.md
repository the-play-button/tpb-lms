# Frontend Vault-API - Plan d'Implementation

> Architecture enterprise-ready avec approche "0 dette technique"

## Vue d'ensemble

Creation d'un frontend **SPA pur** (Next.js sans Server Components) pour `vault-api`, avec architecture "Multi-tout" integrant des le depart tous les aspects enterprise.

- **Backend existant** : Le backend `vault-api` expose tous les endpoints necessaires. Le frontend fait des appels fetch vers ce backend - PAS d'API routes Next.js. Le front-end doit être dépourvu de logique complexe, on n'hésitera pas à mocker des endpoints backend dédiée au front (prefix : "front_")
- **Deploiement** : Cloudflare **Worker** (PAS Pages). Frontend compile en static et servi par un Worker CF dedie.

---

## Table des matieres

| Fichier | Contenu |
|---------|---------|
| [01-philosophie.md](./01-philosophie.md) | Philosophie de developpement, regles strictes, cycle refacto |
| [02-architecture.md](./02-architecture.md) | Principes cles, Stack Multi-tout, anti-patterns |
| [03-backend-views.md](./03-backend-views.md) | Vues SQL backend + Pattern interception |
| [04-deploiement.md](./04-deploiement.md) | Configuration CF Worker, wrangler.toml, worker.ts |
| [05-extraction.md](./05-extraction.md) | Phase 0 : Extraction de l'existant, mapping vers cible |
| [06-design-system.md](./06-design-system.md) | CSS Variables TPB, fonts, composants CSS multi-theme |
| [07-contexts-services.md](./07-contexts-services.md) | Contexts hierarchy, services layer, pattern interception |
| [08-phases.md](./08-phases.md) | Phases 0-7 detaillees |
| [09-vues.md](./09-vues.md) | Inventaire 8 vues IAM + 4 features differenciantes |
| [10-critiques.md](./10-critiques.md) | DebugX, Zero Error Tolerance, Multi-compte |
| [11-checklist.md](./11-checklist.md) | Checklist complete + estimation temporelle |
| [12-arborescence.md](./12-arborescence.md) | Arborescence CIBLE complete (12 vues, components, services) |

---

## Resume des Phases

| Phase | Objectif | Effort |
|-------|----------|--------|
| **0** | Extraction de l'existant (`_to_refacto/`) | 1j |
| **1** | Convention 04 + Setup Next.js + CF Worker | 2j |
| **2** | Infrastructure Multi-tout (i18n, themes, contexts) | 3j |
| **3** | Shell complet (Header, Sidebar, DebugX) | 3j |
| **4** | 3 vues existantes portees (Tokens, Apps, CF) | 5j |
| **5** | 5 vues IAM Core | 8j |
| **6** | 5 features differenciantes | 10j |
| **7** | Polish enterprise | 5j |
| **Total** | Frontend enterprise-ready complet | **~37j** |

---

## Inventaire rapide

**8 Vues IAM** : Dashboard, Tokens, Applications, Users, Groups, Roles, Organizations, Matrix

**4 Features Differenciantes** : Explain Mode, Drift Detection, Access Graph, What-If Simulator

**14+ Composants reutilisables** : DataTable, DetailSidePanel, StatusBadge, CopyBlock, StatsCard, etc.

---

## Navigation

Commencer par [01-philosophie.md](./01-philosophie.md) pour comprendre l'approche de developpement.

