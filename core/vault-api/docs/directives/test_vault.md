# Test Vault Security

## Goal

Validate TPB Vault API security and functionality.

## Tests

| Test | Expected |
|------|----------|
| Health (public) | 200, status: healthy |
| List connections | 200, connections array |
| Get connection | 200, auth.secrets object |
| List secret refs | 200, has_value flags |
| Write (service token) | 403 FORBIDDEN |
| Unauthenticated | 302/401/403 |

## Run Tests

```bash
cd vault-api
python3 scripts/execution/test_vault_security.py
```

Expected output:

```
TPB VAULT TESTS
==================================================
URL: https://tpb-vault-infra.matthieu-marielouise.workers.dev
Credentials: ✓

1. Health (public)...
   ✅ PASS: 2 connections, 11 secrets

2. List connections (service token)...
   ✅ PASS: 2 connections

3. Get connection with secrets...
   ✅ PASS: 6 secrets in conn_infra

4. List secret refs...
   ✅ PASS: 6 refs, 6 with values

5. Write blocked (service token)...
   ✅ PASS: Write blocked (403)

6. Unauthenticated blocked...
   ✅ PASS: Blocked (302)

SUMMARY
==================================================
Passed: 6, Failed: 0, Skipped: 0
```

## Test Client Library

```bash
python3 scripts/execution/vault_client.py
python3 scripts/execution/vault_client.py conn_infra
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Health fails | Worker not deployed | `npx wrangler deploy` |
| 302 redirect | Token not in Access policy | Add token to Cloudflare Access |
| No secrets returned | CF secrets not set | Run seed script |
| Write succeeds with token | Auth middleware bug | Fix `middleware/auth.js` |
