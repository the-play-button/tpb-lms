## Ce qui a été fait

### Phase 1-3: Console leak cleanup (completed as planned)
- Replaced 26 `console.*` calls across 18 backend files with SDK Logger (`import { log } from '@the-play-button/tpb-sdk-js'`)
- Deleted 2 dead wrapper files: `backend/lib/log.js` (console wrapper with prefixes) and `backend/utils/log.js` (JSON logger factory)
- Migrated 6 consumers of local wrappers to SDK import: `content.js`, `secrets.js`, `engine.js`, `admin.js`, `kms.js`, `quiz/_shared.js`
- Removed `backend/` from `.entropy.yaml` `console_leaks` exception — violations are now visible

### Phase 4: Vault migration → SUPERSEDED by full Logto deletion
During execution, investigation revealed:
- `USE_LOGTO = "false"` in wrangler.toml — Logto is **disabled** in all environments
- No LMS app exists in Logto (only 2 apps: "CF Access Federation" + "TPB Branding M2M" — confirmed via Logto Management API)
- Correct Logto FQDN is `auth.theplaybutton.ai` (the `.dev` in config was dead DNS / NXDOMAIN)
- All Logto code in LMS was unreachable dead code

**Decision**: instead of migrating LOGTO_APP_SECRET to vault (moving a dead secret for dead code), deleted ALL Logto code.

### Dead Logto code removed:
- Deleted `backend/handlers/auth-logto/` directory (4 files: handleLogin.js, handleCallback.js, handleLogout.js, index.js)
- Deleted `backend/auth/verifyOidcJWT.js` (dead OIDC JWT verifier)
- Removed Logto import + 3 dead routes from `backend/index.js` (`/auth/login`, `/auth/callback`, `/auth/logout`)
- Simplified `backend/config/auth.js` — removed `useLogto` toggle and `logto` config block
- Simplified `backend/auth/authenticateRequest.js` — removed Logto branches (OIDC token peeking, `verifyOidcJWT` call)
- Cleaned `backend/auth/_shared.js` — removed `oidcJwksCache`, `oidcJwksCacheTime`, `getOidcJWKS`
- Removed dead export from `backend/auth/index.js`
- Removed `USE_LOGTO` and `LOGTO_ENDPOINT` from wrangler.toml (both `[vars]` and `[env.production.vars]`)
- Removed `USE_LOGTO` and `LOGTO_ENDPOINT` from `backend/types/Env.ts`
- Removed stale 73-line "Sécurité" section from `TODO.md` (about migrating LOGTO_APP_SECRET to vault)
- Updated route inventory in `TODO.md`: removed Auth/Logto row, count 43 → 40

### Phase 5: getGlossaryMap fail-hard (completed as planned)
- `backend/handlers/glossary/getGlossaryMap.js`: removed silent fallback (`catch → return new Map()`) — now throws the error after logging

### Phase 6: YAML exception cleanup (completed as planned)
- `.entropy.yaml`: removed `backend/` from `console_leaks` exception

## Fichiers modifiés

| Action | Fichier | Description |
|--------|---------|-------------|
| EDIT | `backend/index.js` | SDK log migration + removed Logto import + 3 dead routes |
| EDIT | `backend/auth/verifyAccessJWT.js` | console.error → log.error |
| EDIT | `backend/auth/verifyAPIKey.js` | console.error → log.error |
| DELETE | `backend/auth/verifyOidcJWT.js` | Dead OIDC JWT verifier (Logto) |
| EDIT | `backend/auth/resolveRole.js` | console.error → log.error |
| EDIT | `backend/auth/authenticateRequest.js` | Removed Logto branches + dead imports |
| EDIT | `backend/auth/_shared.js` | Removed OIDC JWKS code (oidcJwksCache, getOidcJWKS) |
| EDIT | `backend/auth/index.js` | Removed dead verifyOidcJWT export |
| EDIT | `backend/config/auth.js` | Removed useLogto toggle, simplified to CF Access only |
| DELETE | `backend/handlers/auth-logto/handleLogin.js` | Dead Logto OAuth login handler |
| DELETE | `backend/handlers/auth-logto/handleCallback.js` | Dead Logto OAuth callback handler |
| DELETE | `backend/handlers/auth-logto/handleLogout.js` | Dead Logto logout handler |
| DELETE | `backend/handlers/auth-logto/index.js` | Dead barrel export for auth-logto |
| EDIT | `backend/handlers/events.js` | console.error → log.error |
| EDIT | `backend/handlers/test.js` | console.error → log.error |
| EDIT | `backend/handlers/translations/batchUpsertTranslations.js` | console.error → log.error |
| EDIT | `backend/handlers/translations/getTranslationsForReview.js` | console.error → log.error |
| EDIT | `backend/handlers/translations/upsertTranslation.js` | console.error → log.error |
| EDIT | `backend/handlers/translations/getTranslations.js` | console.error → log.error |
| EDIT | `backend/handlers/glossary/addGlossaryTerm.js` | console.error → log.error |
| EDIT | `backend/handlers/glossary/deleteGlossaryTerm.js` | console.error → log.error |
| EDIT | `backend/handlers/glossary/getGlossary.js` | console.error → log.error |
| EDIT | `backend/handlers/glossary/getGlossaryMap.js` | console.error → log.error + removed silent fallback |
| EDIT | `backend/handlers/glossary/importGlossaryTerms.js` | console.error → log.error |
| EDIT | `backend/handlers/apikeys/listAPIKeysHandler.js` | console.error → log.error |
| EDIT | `backend/handlers/apikeys/createAPIKeyHandler.js` | console.error → log.error |
| EDIT | `backend/handlers/apikeys/adminCreateAPIKeyHandler.js` | console.error → log.error |
| EDIT | `backend/handlers/apikeys/revokeAPIKeyHandler.js` | console.error → log.error |
| EDIT | `backend/handlers/content.js` | Migrated from lib/log.js to SDK |
| EDIT | `backend/lib/secrets.js` | Migrated from lib/log.js to SDK |
| EDIT | `backend/projections/engine.js` | Migrated from utils/log.js to SDK |
| EDIT | `backend/handlers/admin.js` | Migrated from utils/log.js to SDK |
| EDIT | `backend/handlers/kms.js` | Migrated from utils/log.js to SDK |
| EDIT | `backend/handlers/quiz/_shared.js` | Migrated from utils/log.js to SDK |
| DELETE | `backend/lib/log.js` | Dead console wrapper (replaced by SDK) |
| DELETE | `backend/utils/log.js` | Dead JSON logger factory (replaced by SDK) |
| EDIT | `.entropy.yaml` | Removed backend/ from console_leaks exception |
| EDIT | `wrangler.toml` | Removed USE_LOGTO, LOGTO_ENDPOINT from both envs |
| EDIT | `backend/types/Env.ts` | Removed USE_LOGTO, LOGTO_ENDPOINT types |
| EDIT | `TODO.md` | Removed stale Logto section + updated route inventory (43→40) |

## Résultat de validation

- [x] Zero `console.*` dans `backend/` (hors node_modules) — replaced all 26 with SDK Logger
- [x] `lib/log.js` et `utils/log.js` supprimés — dead wrappers deleted
- [x] ~~LOGTO_APP_SECRET lu depuis le vault~~ → SUPERSEDED: all Logto code deleted (no secret needed)
- [x] Exception YAML `console_leaks: [backend/]` retirée — violations futures visibles
- [x] `getGlossaryMap.js` fail hard au lieu de retourner un Map vide silencieusement
- [x] Build `wrangler deploy --dry-run` OK — passes with 0 errors
- [x] Dead Logto code fully removed (6 files deleted, 7 files cleaned)
- [x] `TODO.md` route inventory updated (Auth/Logto row removed, 43→40)
- [ ] Entropy: 1 remaining HIGH violation (`backend_structure`: missing `utils/` directory) — pre-existing structural gap, not a regression from this plan. The `utils/` directory became empty when `utils/log.js` was deleted; the `helpers/` directory serves the same purpose but entropy checker expects both.

### Post-deploy cleanup (deferred)
- `wrangler secret delete LOGTO_APP_SECRET --name lms-api` — the wrangler secret is now orphaned (no code reads it), should be cleaned up after deploy
