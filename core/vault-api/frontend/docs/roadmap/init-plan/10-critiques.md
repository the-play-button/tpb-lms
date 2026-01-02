# Elements Critiques

> Issus de vrac_notes - Elements non-negociables pour un frontend enterprise-ready

---

## DebugX - Composant de Troubleshooting User-Side

**Objectif** : "Demain il y aura un bug en prod. On n'aura rien pour le debugger a distance."

```typescript
// components/shell/DebugX/DebugX.tsx
/**
 * Composant flottant "Share technical infos with TPB support"
 * 
 * Collecte et permet de copier :
 * - Stack trace (si erreur)
 * - Breadcrumb (derniers 20 events user)
 * - Device fingerprint (browser, OS, resolution)
 * - User info (email, org, permissions)
 * - Request/Response des 10 derniers appels API
 * - Timestamp + timezone
 * - App version
 * 
 * Affiche un bouton flottant (coin bas droit)
 * Click -> Modal avec toutes les infos + [Copy to clipboard]
 */
```

**Implementation** :
- Composant dans `shell/DebugX/`
- Hook `useDebugCollector` qui collecte en continu
- Stockage dans `sessionStorage` (pas persistant)
- Bouton visible uniquement si user authentifie

---

## Zero Error Tolerance

**Objectif** : "Se brancher en API sur toutes les infra qui recuperent des erreurs. Job quotidien de triage. Objectif : 0 erreurs !"

**Frontend** :
- Error boundary global qui capture TOUTE erreur UI
- Toutes les erreurs sont reportees (pas silent fail)
- Composant `ErrorDisplay` avec :
  - Message user-friendly
  - Bouton "Report to support" (trigger DebugX)
  - Retry button si applicable

```typescript
// Chaque fetch doit avoir error handling explicite
try {
  const data = await apiClient.get('/iam/users');
} catch (error) {
  // JAMAIS : catch vide ou console.log seul
  // TOUJOURS : afficher ErrorState + possibilite report
  setError(error);
  reportError(error); // vers monitoring
}
```

---

## Multi-Compte User Switching

**Objectif** : "MULTI COMPTE !! Un utilisateur puisse facilement switcher de compte sur toutes nos applis."

**Implementation** :
- `AccountContext` gere la liste des comptes connectes
- `AccountSwitcher` dans le header (dropdown)
- Stockage `localStorage` : `tpb_accounts: [{email, token, org}]`
- Switch = change le contexte actif, pas de re-login

```typescript
// contexts/Account/AccountContext.ts
interface Account {
  id: string;
  email: string;
  orgId: string;
  orgName: string;
  token: string;  // CF Access token
}

interface AccountContextType {
  accounts: Account[];
  currentAccount: Account | null;
  switchAccount: (accountId: string) => void;
  addAccount: () => void;    // Ouvre popup login
  removeAccount: (accountId: string) => void;
}
```

---

## OAuth 2.0 LIKE (rappel architecture)

Le frontend n'implemente pas OAuth directement (c'est le backend), mais doit supporter :
- Affichage des scopes par application
- Gestion audiences (groupes CF Access)
- Credentials display (client_id, client_secret one-time)
- Sync status avec CF Access

---

## UX Classic Traps (a eviter)

| Trap | Solution |
|------|----------|
| Pas de bouton deconnexion | UserMenu avec "Se deconnecter" visible |
| Pas d'empty state | Chaque liste a un EmptyState avec CTA |
| Loading infini | Timeout + error state apres 10s |
| Erreur silencieuse | TOUJOURS afficher erreur + action possible |
| Pas de feedback action | Toast (sonner) apres chaque action |

---

## Monitoring Frontend (future)

| Type | Outil | Quand |
|------|-------|-------|
| Errors | Sentry | Phase 7 |
| Analytics | Posthog | Phase 7 |
| Performance | CF Analytics | Inclus |

