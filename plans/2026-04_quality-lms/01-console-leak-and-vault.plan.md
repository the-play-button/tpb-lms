# Plan 01 — LMS Console Leak Cleanup + Vault Migration

## Contexte

tpb-lms a 26 appels `console.error/log/warn` dans le backend, couverts par une exception YAML `console_leaks: [backend/]` qui cache la dette. Le SDK Logger (`@the-play-button/tpb-sdk-js`) est deja configure dans `index.js` via `configureLogger()` avec telemetrie, mais seuls les fichiers DDD TypeScript l'utilisent. Les 43 handlers legacy JS ignorent le logger et font `console.error()` directement.

En parallele, `LOGTO_APP_SECRET` est encore dans wrangler secret au lieu du vault bastion — violation de la hierarchie credential bastion-first.

3 mecanismes de logging coexistent (probleme racine) :
1. `backend/lib/log.js` — wrapper console avec prefixes (2 consumers)
2. `backend/utils/log.js` — factory JSON structuree (4 consumers)
3. Bare `console.error()` — 22 fichiers directement

Le SDK singleton est deja configure et fonctionne (preuve : `application/**/*Track.ts`).

## Critères

- Zero `console.*` dans `backend/` (hors node_modules)
- `lib/log.js` et `utils/log.js` supprimes (dead wrappers)
- `LOGTO_APP_SECRET` lu depuis le vault bastion, plus depuis `env`
- Exception YAML `console_leaks: [backend/]` retiree — violations futures visibles
- `getGlossaryMap.js` fail hard au lieu de retourner un Map vide silencieusement
- Entropy passe sans nouvelles violations
- Build `wrangler deploy --dry-run` OK

## Risques

- **Secret vault absent** : si `tpb/apps/lms/logto_app_secret` n'existe pas dans le vault au moment du deploy, le flow OAuth Logto casse. Pre-requis : stocker le secret AVANT le deploy.
- **`log` pas configure dans les scheduled handlers** : `configureLogger()` est appele dans un middleware Hono (per-request). Les cron/scheduled handlers n'ont pas ce middleware. Si un handler schedule utilise `log`, il faudra appeler `configureLogger()` dans le scheduled handler aussi. A verifier — si aucun handler schedule n'utilise les fichiers modifies, pas de risque.
- **`getGlossaryMap` throw** : les callers de `getGlossaryMap()` doivent gerer l'erreur. Verifier que les callers ont un try-catch ou propagent correctement.
- **Quiz `_shared.js` re-export** : `_shared.js` re-exporte `log` vers d'autres quiz handlers. Apres migration, verifier que les consumers de `_shared.js` fonctionnent toujours.

## Étapes

### Phase 1 — Remplacer les 22 bare `console.error()` (18 fichiers)

Pattern universel :
```javascript
// AVANT
console.error('description:', error);

// APRES
import { log } from '@the-play-button/tpb-sdk-js';
log.error('description', error, { file: 'relative/path.js' });
```

API SDK : `log.error(message: string, error?: Error | null, context?: LogContext)`.
Quand le 2e argument n'est pas un Error (ex: `body` string), passer `null` + context.

| # | Fichier | Ligne | Note |
|---|---------|-------|------|
| 1 | `backend/index.js` | 106 | import SDK deja present |
| 2 | `backend/auth/verifyAccessJWT.js` | 57 | + supprimer ACK comment |
| 3 | `backend/auth/verifyAPIKey.js` | 47 | + supprimer ACK comment |
| 4 | `backend/auth/verifyOidcJWT.js` | 71 | + supprimer ACK comment |
| 5 | `backend/auth/resolveRole.js` | 30 | |
| 6 | `backend/handlers/auth-logto/handleCallback.js` | 49 | body est string |
| 7 | `backend/handlers/events.js` | 55 | |
| 8 | `backend/handlers/test.js` | 221 | |
| 9-12 | `backend/handlers/translations/*.js` | 4 fich. | Pattern identique |
| 13-17 | `backend/handlers/glossary/*.js` | 5 fich. | Pattern identique |
| 18-21 | `backend/handlers/apikeys/*.js` | 4 fich. | Pattern identique |

### Phase 2 — Migrer les consumers des wrappers locaux (6 fichiers)

**Consumers de `lib/log.js`** :
- `handlers/content.js` — `import { log } from '../lib/log.js'` → `import { log } from '@the-play-button/tpb-sdk-js'`
- `lib/secrets.js` — `import { log } from './log.js'` → `import { log } from '@the-play-button/tpb-sdk-js'`

**Consumers de `utils/log.js`** :
- `projections/engine.js` — `import { logger } from '../utils/log.js'` → `import { log } from '@the-play-button/tpb-sdk-js'`
- `handlers/admin.js` — idem
- `handlers/kms.js` — idem
- `handlers/quiz/_shared.js` — idem, re-exporte `log` aux quiz handlers

### Phase 3 — Supprimer les wrappers morts

- DELETE `backend/lib/log.js`
- DELETE `backend/utils/log.js`

### Phase 4 — Migrer LOGTO_APP_SECRET vers le vault

**Fichier** : `backend/handlers/auth-logto/handleCallback.js`

Avant (ligne 43) : `client_secret: env.LOGTO_APP_SECRET || ''`

Apres :
```javascript
import { VaultClient, getCachedSecret } from '../../lib/vaultClient.js';
const vault = new VaultClient(env.BASTION_URL, env);
const logtoAppSecret = await getCachedSecret(vault, 'tpb/apps/lms/logto_app_secret');
if (!logtoAppSecret) throw new Error('Vault: tpb/apps/lms/logto_app_secret not found');
// ...
client_secret: logtoAppSecret,
```

Pre-requis : stocker le secret dans le vault AVANT le deploy.
Post-deploy : `wrangler secret delete LOGTO_APP_SECRET --name lms-api`.

### Phase 5 — Fix fail-hard dans getGlossaryMap.js

Avant : `catch → console.error + return new Map()` (fail silently)
Apres : `catch → log.error + throw error` (fail hard)

### Phase 6 — Retirer l'exception YAML

`.entropy.yaml` : retirer `backend/` de `console_leaks`. Garder `frontend-on-cf-worker/` et `scripts/`.

### Phase 7 — Verification

1. `python3 -m tpb_sdk.entropy --path Apps/the-play-button/tpb-lms` — pas de nouvelles violations
2. `grep -rn 'console\.' backend/ --include='*.js' --include='*.ts'` — zero resultats
3. `npx wrangler deploy --dry-run` — build OK

## Fichiers

| Action | Fichier |
|--------|---------|
| EDIT | `backend/index.js` |
| EDIT | `backend/auth/verifyAccessJWT.js` |
| EDIT | `backend/auth/verifyAPIKey.js` |
| EDIT | `backend/auth/verifyOidcJWT.js` |
| EDIT | `backend/auth/resolveRole.js` |
| EDIT | `backend/handlers/auth-logto/handleCallback.js` |
| EDIT | `backend/handlers/events.js` |
| EDIT | `backend/handlers/test.js` |
| EDIT | `backend/handlers/translations/batchUpsertTranslations.js` |
| EDIT | `backend/handlers/translations/getTranslationsForReview.js` |
| EDIT | `backend/handlers/translations/upsertTranslation.js` |
| EDIT | `backend/handlers/translations/getTranslations.js` |
| EDIT | `backend/handlers/glossary/addGlossaryTerm.js` |
| EDIT | `backend/handlers/glossary/deleteGlossaryTerm.js` |
| EDIT | `backend/handlers/glossary/getGlossary.js` |
| EDIT | `backend/handlers/glossary/getGlossaryMap.js` |
| EDIT | `backend/handlers/glossary/importGlossaryTerms.js` |
| EDIT | `backend/handlers/apikeys/listAPIKeysHandler.js` |
| EDIT | `backend/handlers/apikeys/createAPIKeyHandler.js` |
| EDIT | `backend/handlers/apikeys/adminCreateAPIKeyHandler.js` |
| EDIT | `backend/handlers/apikeys/revokeAPIKeyHandler.js` |
| EDIT | `backend/handlers/content.js` |
| EDIT | `backend/lib/secrets.js` |
| EDIT | `backend/projections/engine.js` |
| EDIT | `backend/handlers/admin.js` |
| EDIT | `backend/handlers/kms.js` |
| EDIT | `backend/handlers/quiz/_shared.js` |
| DELETE | `backend/lib/log.js` |
| DELETE | `backend/utils/log.js` |
| EDIT | `.entropy.yaml` |
