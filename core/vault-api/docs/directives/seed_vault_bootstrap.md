# Seed Vault Bootstrap (One-Time)

> **ONE-TIME EXECUTION ONLY**  
> Migrates secrets from `.env` to Cloudflare Secrets.

## Architecture

```
.env (source)
    ↓ wrangler secret put
Cloudflare Secrets (storage)
    ↓ env[cf_key]
D1 sys_secret_ref (registry)
```

## Process

### 1. Dry Run

```bash
cd vault-api
python3 scripts/execution/seed_vault_bootstrap.py
```

Output:

```
[DRY-RUN] wrangler secret put CONN_infra_OPENAI_API_KEY = sk-p...yZUA
...
Secrets created: 11
```

### 2. Apply

```bash
python3 scripts/execution/seed_vault_bootstrap.py --apply
```

### 3. Apply D1 Schema

```bash
npx wrangler d1 execute vault-db --remote --file=db/schema.sql
```

### 4. Deploy Worker

```bash
npx wrangler deploy
```

### 5. Verify

```bash
python3 scripts/execution/test_vault_security.py
```

## Post-Bootstrap

- `.env` only needed for vault-api itself (service token credentials)
- All other apps use `vault_client.py` to fetch secrets
- Add new secrets via API + `wrangler secret put`

## Mapping

| .env Variable | CF Secret Key |
|---------------|---------------|
| OPENAI_API_KEY | CONN_infra_OPENAI_API_KEY |
| CLOUDFLARE_API_TOKEN | CONN_infra_CLOUDFLARE_API_TOKEN |
| UNIFIEDTO_API_TOKEN | CONN_integrations_UNIFIEDTO_API_TOKEN |
| ... | ... |

See `SECRETS` in `seed_vault_bootstrap.py` for full mapping.
