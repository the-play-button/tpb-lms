# Philosophie de Developpement

> L'arborescence est un GUIDE, pas une checklist

---

## Philosophie "Dumb Front" (CRUCIAL)

Le frontend est une **pure presentation layer**. Il n'a aucune logique business.

### Principes fondamentaux

1. **ZERO calcul** cote frontend - le backend fait tout le travail
2. **ZERO transformation de donnees** business - le backend renvoie des donnees pret-a-afficher
3. **Backend expose des endpoints `front_*`** avec donnees pre-formatees pour l'UI
4. **Si logique business identifiee** pendant le dev -> `_migrate_to_backend/`
5. **Code quality** à chaque étape, on utilisera le script d'entropy du tpb-sdk afin de réduire les complexités, ne pas faire exploser inutilement la codebase et éviter toute paralysie. Le faire à la fin est déconseillée car l'entropie croît exponentiellement.

### Ce qui va ou

| Type de logique | Frontend | Backend | Notes |
|-----------------|----------|---------|-------|
| Affichage/Rendu | OUI | - | Composants React |
| UI state (loading, modals, selection) | OUI | - | useState, useReducer |
| Form validation basique | OUI | - | Required, email format |
| Formatage date/number pour display | OUI | - | `formatDate()`, `truncate()` |
| Navigation/Routing | OUI | - | router.push |
| Tri/Filtre de liste | NON | OUI | Backend via `front_*` |
| Calcul permissions effectives | NON | OUI | `/front_iam/users/:id/effective-permissions` |
| Diff/Comparaison (ex: drift) | NON | OUI | `/front_iam/groups/:id/drift` |
| Agregation/Stats | NON | OUI | `/front_iam/dashboard/stats` |
| Recherche/Search | NON | OUI | Backend fait le search |
| Pagination | NON | OUI | Backend pagine |

### Convention endpoints `front_*`

Le backend expose des endpoints dedies au frontend avec prefix `front_` :

```
/iam/users              -> Endpoint "raw" (pour API externes)
/front_iam/users        -> Endpoint frontend (pagination, tri, filtre inclus)

/iam/groups/:id         -> Donnees brutes
/front_iam/groups/:id   -> Avec drift pre-calcule, members count, etc.
```

### Si logique business detectee pendant le dev

```
1. On identifie de la logique business dans le code front
2. On cree un fichier dans `_migrate_to_backend/` avec :
   - La logique extraite
   - Le endpoint `front_*` souhaite
   - Les specs input/output
3. On mocke l'endpoint cote front en attendant
4. Backend implemente le endpoint
5. On supprime le mock et le fichier _migrate_to_backend/
```

---

## Approche Organique

L'arborescence cible sert de **boussole** pour ne pas perdre la trajectoire. Mais on ne code PAS en creant betement tous les dossiers a l'avance.

**Approche organique** :

1. On code l'UI d'abord (le composant, la vue)
2. Quand le fichier depasse ~100 lignes ou qu'on identifie de la logique reutilisable -> on extrait
3. Les "tiroirs" (`.components/`, `.logic/`, `.functions/`, `.constants/`) se peuplent au fil du besoin
4. Les subhooks apparaissent quand un hook depasse 150 lignes

---

## Regles Strictes (garde-fous)

| Regle | Seuil | Action |
|-------|-------|--------|
| 1 fichier = 1 export | Toujours | Si 2+ exports -> split |
| Taille fichier max | 500 lignes | Split obligatoire |
| Hook max | 150 lignes | Extraire en subhooks |
| Barrel imports | Toujours | Jamais d'import direct |
| Zero logique business | Toujours | -> `_migrate_to_backend/` |

---

## Cycle Creer -> Refacto

```
1. Creer le composant/hook dans le fichier le plus simple
2. Ca marche ? Commit
3. Le fichier grossit ? Extraire dans le bon tiroir
4. Le composant est reutilisable ? Generaliser + deplacer vers lib TPB
5. Logique business detectee ? -> _migrate_to_backend/
6. Repeat
```

---

## Lib de Composants TPB Reutilisables

**En dehors** de la structure page, on cree une lib de composants generalises :

```
src/
├── app/                          # Pages specifiques
│   └── Tokens/                   # Structure Page.{type}/
├── _migrate_to_backend/          # Logique a deporter au backend
└── components/
    ├── ui/                       # shadcn (ne pas toucher)
    ├── common/                   # Composants partages basiques
    └── tpb/                      # LIB TPB REUTILISABLE
        ├── index.ts
        ├── DataTable/
        ├── ActionCard/
        ├── StatusBadge/
        ├── CopyBlock/
        ├── ConfirmModal/
        └── ... (se peuple au fil du refacto)
```

**Logique de refacto** :

- Un composant est cree dans `Page.components/`
- Si reutilise dans 2+ pages -> extraire vers `components/common/`
- Si suffisamment generique et stable -> promouvoir vers `components/tpb/`
- Les composants `tpb/` sont documentes et testes

---

## Role des dossiers (Dumb Front)

### `Page.logic/` - UI State ONLY

```typescript
// OK - UI state
const [isModalOpen, setIsModalOpen] = useState(false);
const [selectedIds, setSelectedIds] = useState<string[]>([]);
const [isLoading, setIsLoading] = useState(true);

// INTERDIT - Transformation de donnees
const filteredUsers = users.filter(u => u.status === 'active'); // NON!
const sortedUsers = users.sort((a, b) => a.name.localeCompare(b.name)); // NON!
```

### `Page.functions/` - Formatage UI ONLY

```typescript
// OK - Formatage pour affichage
export const truncate = (text: string, max: number) => 
  text.length > max ? text.slice(0, max) + '...' : text;

export const formatDateRelative = (date: Date) =>
  new Intl.RelativeTimeFormat('fr').format(...);

// INTERDIT - Calcul business
export const calculateEffectivePerms = (user, groups, roles) => { /* NON! */ };
export const computeDrift = (vaultState, cfState) => { /* NON! */ };
```

### `services/` - Pure Fetch Wrappers

```typescript
// OK - Pure fetch, le backend fait tout
export const getUsers = (params: ListParams) =>
  apiClient.get('/front_iam/users', { params });

// INTERDIT - Logique apres fetch
export const getUsers = async () => {
  const users = await apiClient.get('/iam/users');
  return users.filter(u => u.active); // NON!
};
```

---

## Ajouts a la Convention 04

La nouvelle convention `04_Convention_Frontend_TPB.md` doit inclure ces concepts manquants :

### 1. Philosophie "Dumb Front"

- Frontend = pure presentation layer
- Zero calcul, zero transformation business
- Backend expose endpoints `front_*`
- `_migrate_to_backend/` pour logique identifiee

### 2. Philosophie "tiroirs organiques"

- L'arborescence est un guide, pas une checklist
- Les dossiers `.components/`, `.logic/`, etc. se creent au besoin
- On code d'abord, on range ensuite

### 3. Cycle creer -> refacto

- Creer dans le fichier le plus simple
- Extraire quand ca grossit
- Generaliser quand reutilisable
- Migrer logique business vers backend

### 4. Lib TPB reutilisable (`components/tpb/`)

- Composants generalises promus depuis `common/`
- Documentation et tests pour chaque composant TPB
- Pattern de promotion : Page -> common -> tpb

### 5. Regles strictes (garde-fous)

- 1 fichier = 1 export (non negociable)
- Max 500 lignes par fichier
- Max 150 lignes par hook
- Barrel imports obligatoires
- Zero logique business

### 6. Multi-tout architecture

- Structure pour i18n, themes, formatters, multi-compte, multi-tenant
- Contexts hierarchy
- Services layer = pure fetch vers backend
