# Plan 02 — Dead Code Cleanup + Fail-Hard Fixes

## Contexte

During Plan 01 (console leak + Logto dead code removal), the auth layer was significantly cleaned. After those changes, several files became dead code but weren't caught. Additionally, `resolveRole.js` has a fallback pattern that violates "ALWAYS FAIL HARD": when the bastion IAM call fails, it silently falls back to a local `hris_employee` D1 table lookup — masking the real error.

The Tally webhook secrets are also still read from legacy wrangler env vars (`env.TALLY_SIGNING_SECRET`, `env.TALLY_WEBHOOK_SECRET`) instead of being fetched from vault at runtime, despite being documented as "MIGRATED TO VAULT" in `wrangler.toml`.

**Goal**: Remove dead code, eliminate fallback patterns, migrate remaining legacy secrets to vault-only.

## Critères

1. Zero dead code files remaining in `backend/auth/` and `backend/lib/`
2. `resolveRole.js` uses direct bastion fetch — no VaultClient, no hris_employee fallback
3. Tally secrets fetched from vault via `initBastionClient()` — not from wrangler env
4. Build passes (`wrangler deploy --dry-run`)
5. Entropy passes (`python3 -m tpb_sdk.entropy --path Apps/the-play-button/tpb-lms` → 0 violations)
6. No remaining `import` referencing deleted files

## Étapes

### Phase A: Dead code removal (4 files)

#### A1. Delete `backend/auth/authenticateRequest.js`

Auth is now handled by bastion middleware (`createBastionAuthMiddleware`) + API key pre-auth in `index.js:179-199`. No file imports `authenticateRequest` — it's exported from the barrel but never consumed.

- DELETE `backend/auth/authenticateRequest.js`
- UPDATE `backend/auth/index.js` — remove line 9: `export { authenticateRequest } from './authenticateRequest.js';`

#### A2. Delete `backend/lib/secrets.js`

Not imported by any file. The `SECRET_MAPPINGS` and `getSecret` with fallback pattern were never wired into the application. `index.js` uses `createBastionClient` from SDK directly.

- DELETE `backend/lib/secrets.js`

#### A3. Delete `backend/lib/vaultClient.js` (after Phase B)

Currently imported only by `resolveRole.js` (active) and `secrets.js` (dead). After Phase B refactors `resolveRole.js` to use direct fetch, `vaultClient.js` has zero consumers.

This custom `VaultClient` class duplicates functionality now available in the SDK's `createBastionClient`. The IAM methods (`getUserRoles`, `can`, `getUser`, `listUsers`) and vault methods are not used by any other file.

- DELETE `backend/lib/vaultClient.js`

#### A4. Delete `vault_client.py`

Deprecated Python vault client using old `/vault/connections/` API. CLAUDE.md says `VaultClient` → use `BastionClient`.

- DELETE `vault_client.py`
- UPDATE `scripts/tests/fixtures.py` — change `from vault_client import VaultClient` to `from tpb_sdk.bastion import BastionClient`
- UPDATE `scripts/tests/tests/conftest.py` — same import change

### Phase B: Fail-hard fix — `resolveRole.js`

**Current code** (`backend/auth/resolveRole.js`):
```javascript
export const resolveRole = async (email, env) => {
    if (env.BASTION_URL && env.BASTION_TOKEN) {
        try {
            const vault = new VaultClient(env.BASTION_URL, env);
            const data = await vault.getUserRoles(email);
            // ... role mapping ...
        } catch (err) {
            log.error('vault-api role resolution failed, falling back to local', err);
        }
    }
    // FALLBACK: local hris_employee D1 table lookup
    const employee = await env.DB.prepare(...)...
};
```

**Problems**:
1. Creates a NEW `VaultClient` on every call (no singleton)
2. Catches bastion errors and falls back silently to local DB
3. The `hris_employee` fallback is stale data — bastion IAM is the SSOT
4. `if (env.BASTION_URL && env.BASTION_TOKEN)` guard: if config is missing, silently uses local DB

**Rewrite**: Direct `fetch` to bastion IAM endpoint, fail hard on error, no fallback.

```javascript
import { log } from '@the-play-button/tpb-sdk-js';

export const resolveRole = async (email, env) => {
    const resp = await fetch(
        `${env.BASTION_URL}/iam/users/${encodeURIComponent(email)}/roles`,
        { headers: { 'Authorization': `Bearer ${env.BASTION_TOKEN}` } }
    );

    // 404 = user has no IAM roles = student (not an error)
    if (resp.status === 404) return 'student';

    if (!resp.ok) {
        throw new Error(`[resolveRole] bastion IAM failed: ${resp.status} ${await resp.text()}`);
    }

    const data = await resp.json();
    const roleNames = (data.roles || []).map(({ name } = {}) => name);

    if (roleNames.some(r => r === 'tpblms_admin')) return 'admin';
    if (roleNames.some(r => r === 'tpblms_instructor')) return 'instructor';
    return 'student';
};
```

**Key decisions**:
- 404 → `'student'` (user exists in CF Access but not in bastion IAM = no special role). This is NOT a fallback — it's the expected behavior for regular users.
- Any other HTTP error → throw (fail hard)
- No try/catch — errors propagate to Hono `app.onError` (returns 500 + logs)
- No `VaultClient` dependency — direct fetch with bastion token

### Phase C: Migrate Tally secrets to vault fetch

**Current code** (`backend/index.js:146-163`): reads from `env.TALLY_SIGNING_SECRET` and `env.TALLY_WEBHOOK_SECRET` (wrangler secrets).

**Fix**: Add per-isolate cached vault fetches (same pattern as `fetchTelemetryCfAccessSecret` in index.js:71-81):

```javascript
let _tallySigningSecret = null;
let _tallyWebhookSecret = null;

const fetchTallySigningSecret = async (env) => {
  if (_tallySigningSecret) return _tallySigningSecret;
  const bastion = await initBastionClient(env);
  const result = await bastion.getSecret('tpb/apps/lms/tally_signing_secret');
  if (!result.ok) throw new Error(`[tally] signing secret fetch failed: ${result.error}`);
  if (!result.value) throw new Error('[tally] signing secret is empty');
  _tallySigningSecret = result.value;
  return _tallySigningSecret;
};

const fetchTallyWebhookSecret = async (env) => {
  if (_tallyWebhookSecret) return _tallyWebhookSecret;
  const bastion = await initBastionClient(env);
  const result = await bastion.getSecret('tpb/apps/lms/tally_webhook_secret');
  if (!result.ok) throw new Error(`[tally] webhook secret fetch failed: ${result.error}`);
  if (!result.value) throw new Error('[tally] webhook secret is empty');
  _tallyWebhookSecret = result.value;
  return _tallyWebhookSecret;
};
```

Then rewrite `handleTallyWithAuth`:
```javascript
const handleTallyWithAuth = async (request, url, env) => {
  const signingSecret = await fetchTallySigningSecret(env);
  const { valid, body, noSignature } = await verifyTallySignature(request, signingSecret);
  if (noSignature) {
    const webhookSecret = url.searchParams.get('secret');
    const expectedSecret = await fetchTallyWebhookSecret(env);
    if (webhookSecret !== expectedSecret) {
      return jsonResponse({ error: 'Invalid webhook: no signature and invalid secret' }, 403, request);
    }
    return await handleTallyWebhookWithBody(body, env, request);
  }
  if (!valid) return jsonResponse({ error: 'Invalid Tally signature' }, 403, request);
  return await handleTallyWebhookWithBody(body, env, request);
};
```

No more `if (env.TALLY_SIGNING_SECRET)` guard — the secret MUST exist in vault.

**Pre-requisite**: Verify secrets exist in vault before deploying.

### Phase D: Clean `wrangler.toml` comments

Remove stale migration comments about TALLY_* and CLOUDFLARE_STREAM_* legacy secrets since vault migration is now complete in code.

### Phase E: Entropy ACK cleanup

- Remove `entropy-legacy-marker-ok` comments from `resolveRole.js` (legacy code is gone)
- Verify no stale ACK comments reference deleted files

## Risques

1. **Tally secrets missing from vault**: If the vault secrets `tpb/apps/lms/tally_signing_secret` or `tpb/apps/lms/tally_webhook_secret` don't actually exist in vault, the Tally webhook will start returning 500 after deploy. **Mitigation**: Verify secrets exist in vault before deploying (step 3 in verification).

2. **Bastion IAM 404 behavior**: The rewritten `resolveRole` assumes bastion returns 404 when user has no IAM roles. If bastion returns a different status or an empty roles array, the behavior changes. **Mitigation**: Test the endpoint with a known non-IAM user email before deploying.

3. **Test scripts break**: `scripts/tests/fixtures.py` and `conftest.py` will need the `tpb_sdk` package installed. **Mitigation**: These are dev scripts, not prod. If `tpb_sdk` isn't available in their Python env, they'll fail with a clear import error (fail hard, as intended).

## Fichiers

| File | Action | Phase |
|------|--------|-------|
| `backend/auth/authenticateRequest.js` | DELETE | A1 |
| `backend/auth/index.js` | Remove `authenticateRequest` export | A1 |
| `backend/lib/secrets.js` | DELETE | A2 |
| `backend/lib/vaultClient.js` | DELETE (after B) | A3 |
| `vault_client.py` | DELETE | A4 |
| `scripts/tests/fixtures.py` | Update import | A4 |
| `scripts/tests/tests/conftest.py` | Update import | A4 |
| `backend/auth/resolveRole.js` | Rewrite: fail hard, no fallback | B |
| `backend/index.js` | Add Tally vault fetches, rewrite `handleTallyWithAuth` | C |
| `wrangler.toml` | Clean migration comments | D |

## Vérification

1. **Build**: `npx wrangler deploy --dry-run` — must pass clean
2. **Entropy**: `python3 -m tpb_sdk.entropy --path Apps/the-play-button/tpb-lms` — 0 violations
3. **Vault secrets exist**: Verify via bastion API that `tpb/apps/lms/tally_signing_secret` and `tpb/apps/lms/tally_webhook_secret` exist
4. **Grep verification**: `grep -r "authenticateRequest\|lib/secrets\|lib/vaultClient\|vault_client" backend/` — should return only `translator.js` (active, unrelated)
5. **Bastion IAM test**: Confirm 404 behavior for unknown users

## Post-deploy

- `wrangler secret delete TALLY_SIGNING_SECRET --name lms-api`
- `wrangler secret delete TALLY_WEBHOOK_SECRET --name lms-api`
- `wrangler secret delete LOGTO_APP_SECRET --name lms-api` (from Plan 01, still pending)
