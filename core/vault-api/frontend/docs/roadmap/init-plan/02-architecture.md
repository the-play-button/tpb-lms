# Architecture Fondamentale

## Principes Cles

| Principe | Implementation |
|----------|----------------|
| SPA Pur | `'use client'` partout, ZERO Server Components |
| Backend separe | Appels fetch vers `vault-api.workers.dev`, pas d'API routes Next.js |
| CF Worker | Frontend deploye comme Worker CF dedie (pas Pages) |
| Convention TPB | Pattern `Page.{type}/`, 1 fichier = 1 export, barrel imports |

---

## Stack Multi-tout

| Besoin | Solution | Justification |
|--------|----------|---------------|
| **Multi-theme** | CSS Variables + ThemeContext | Zero runtime, instant switch, SSR-safe, whitelabel-ready |
| **Multi-lingue** | next-intl | Native App Router, type-safe, ICU MessageFormat |
| **Multi-compte** | AccountContext + localStorage | Switch entre comptes sans re-login |
| **Multi-tenant** | TenantContext (org_id) | Isolation donnees, branding per-org |
| **Multi-locale** | Intl API natif | Formatters date/number/currency, zero dep |

---

## Ce qu'on ne fait JAMAIS (frontend)

| Anti-pattern | Pourquoi | Alternative |
|--------------|----------|-------------|
| Server Components | Complexite, on est SPA | `'use client'` partout |
| API routes Next.js | Le backend existe deja | Appels fetch vers vault-api |
| TDD avec LLM | Les LLMs passent les tests rouges a vert | Tests apres implementation |
| CSS-in-JS | Performance, complexite | Tailwind + CSS variables |
| Redux/Zustand | Overkill | Context + useStoreState |

---

## Ce qu'on fait TOUJOURS (frontend)

| Pattern | Pourquoi |
|---------|----------|
| `'use client'` | SPA pur, simplicite |
| DebugX | Composant pour troubleshooting user-side |
| Error boundaries | Capture erreurs UI, jamais silent fail |
| Loading/Empty/Error states | UX complete pour chaque vue |

