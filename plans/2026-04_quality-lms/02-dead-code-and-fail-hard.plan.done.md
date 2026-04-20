## Ce qui a été fait

### Phase A — Dead code removal (5 files deleted)
- Deleted `backend/auth/authenticateRequest.js` — dead code, auth handled by bastion middleware
- Removed `authenticateRequest` export from `backend/auth/index.js` barrel
- Deleted `backend/lib/secrets.js` — dead code, never imported (fallback pattern violated ALWAYS FAIL HARD)
- Deleted `backend/lib/vaultClient.js` — custom VaultClient class, replaced by SDK's `createBastionClient`
- Deleted `vault_client.py` — deprecated Python vault client using old `/vault/connections/` API

### Phase A4+ — Test script migration (3 files updated)
- `scripts/tests/fixtures.py` — migrated from `vault_client.VaultClient` to `tpb_sdk.bastion.BastionClient`, fixed vault paths (added `tpb/` prefix for infra secrets)
- `scripts/tests/tests/conftest.py` — same migration, removed stale `sys.path` manipulation
- `scripts/tests/provision_test_accounts.py` — same migration (discovered during grep verification, not in original plan)

### Phase B — resolveRole.js rewrite (fail hard)
- Rewrote `backend/auth/resolveRole.js`: direct `fetch` to bastion IAM endpoint
- Removed `VaultClient` dependency — uses `env.BASTION_URL` + `env.BASTION_TOKEN` directly
- Removed hris_employee D1 fallback — bastion IAM is SSOT
- 404 → `'student'` (user has no IAM roles = regular user, not an error)
- Any other HTTP error → throws (fail hard, propagates to `app.onError`)
- No try/catch — single code path, no fallback

### Phase C — Tally secrets vault migration
- Added `fetchTallySigningSecret()` and `fetchTallyWebhookSecret()` to `backend/index.js` with per-isolate caching (same pattern as `fetchTelemetryCfAccessSecret`)
- Rewrote `handleTallyWithAuth()`: fetches secrets from vault via `initBastionClient()`, no more `env.TALLY_SIGNING_SECRET` / `env.TALLY_WEBHOOK_SECRET`
- Removed the `if (env.TALLY_SIGNING_SECRET)` guard — signing secret MUST exist in vault
- Removed the duplicate fallback path for webhook-only auth

### Phase D — wrangler.toml cleanup
- Removed stale "MIGRATED TO VAULT" comments listing individual secrets
- Simplified to: "All other secrets are fetched from bastion vault at runtime via initBastionClient()."

### Phase E — Stale reference cleanup
- Updated `.entropy.yaml` comment: `authenticateRequest middleware` → `bastion auth middleware`
- Updated `SETUP.md`: `vault_client` → `BastionClient`

## Fichiers modifiés

| Action | File | Description |
|--------|------|-------------|
| DELETE | `backend/auth/authenticateRequest.js` | Dead code — auth handled by bastion middleware |
| EDIT | `backend/auth/index.js` | Removed dead `authenticateRequest` export |
| DELETE | `backend/lib/secrets.js` | Dead code — never imported, had fallback pattern |
| DELETE | `backend/lib/vaultClient.js` | Dead code — replaced by SDK's createBastionClient |
| DELETE | `vault_client.py` | Deprecated Python vault client |
| EDIT | `scripts/tests/fixtures.py` | VaultClient → BastionClient, fixed vault paths |
| EDIT | `scripts/tests/tests/conftest.py` | VaultClient → BastionClient, removed sys.path hack |
| EDIT | `scripts/tests/provision_test_accounts.py` | VaultClient → BastionClient |
| REWRITE | `backend/auth/resolveRole.js` | Direct bastion fetch, fail hard, no fallback |
| EDIT | `backend/index.js` | Tally secrets from vault, rewrote handleTallyWithAuth |
| EDIT | `wrangler.toml` | Cleaned stale migration comments |
| EDIT | `.entropy.yaml` | Updated stale comment |
| EDIT | `SETUP.md` | Updated dependency description |

## Résultat de validation

- [x] Zero dead code files remaining in `backend/auth/` and `backend/lib/` (authenticateRequest.js, secrets.js, vaultClient.js deleted)
- [x] `resolveRole.js` uses direct bastion fetch — no VaultClient, no hris_employee fallback
- [x] Tally secrets fetched from vault via `initBastionClient()` — not from wrangler env
- [x] Build passes: `npx wrangler deploy --dry-run` → 382.50 KiB gzip, clean
- [x] Entropy passes: `python3 -m tpb_sdk.entropy --path Apps/the-play-button/tpb-lms` → 0 violations
- [x] No remaining `import` referencing deleted files (grep verified)
- [x] No `TALLY_*` or `LOGTO_*` in wrangler bindings output
- [x] `provision_test_accounts.py` also migrated (discovered during grep, not in original plan)

### Post-deploy actions (pending)
- `wrangler secret delete TALLY_SIGNING_SECRET --name lms-api`
- `wrangler secret delete TALLY_WEBHOOK_SECRET --name lms-api`
- `wrangler secret delete LOGTO_APP_SECRET --name lms-api` (from Plan 01)
- Verify vault secrets `tpb/apps/lms/tally_signing_secret` and `tpb/apps/lms/tally_webhook_secret` exist before deploying
