# Manage Vault Secrets

## Goal

CRUD operations on TPB Vault secrets.

## Architecture

```
D1 (sys_secret_ref)          Cloudflare Secrets
├── name: "OPENAI_API_KEY"   └── env.CONN_infra_OPENAI_API_KEY = "sk-..."
└── cf_key: "CONN_infra_..."
```

## Read Secrets (Apps/Scripts)

### Python

```python
from vault_client import VaultClient

client = VaultClient.from_env()
secrets = client.get_secrets("conn_infra")
openai_key = secrets["OPENAI_API_KEY"]
```

### cURL

```bash
curl -H "CF-Access-Client-Id: $CLIENT_ID" \
     -H "CF-Access-Client-Secret: $CLIENT_SECRET" \
     https://tpb-vault-infra.matthieu-marielouise.workers.dev/vault/connections/conn_infra
```

## Add New Secret (Admin Only)

### Step 1: Add ref to D1

```sql
INSERT INTO sys_secret_ref (id, connection_id, name, cf_key, type, description)
VALUES ('ref_new', 'conn_infra', 'NEW_API_KEY', 'CONN_infra_NEW_API_KEY', 'api_key', 'Description');
```

Or via API:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Cf-Access-Jwt-Assertion: <jwt>" \
  -d '{"name": "NEW_API_KEY", "type": "api_key", "description": "My new key"}' \
  https://tpb-vault-infra.../vault/connections/conn_infra/secrets
```

### Step 2: Set value in Cloudflare

```bash
cd vault-api
echo "sk-newvalue" | npx wrangler secret put CONN_infra_NEW_API_KEY
```

### Step 3: Deploy

```bash
npx wrangler deploy
```

## Delete Secret (Admin Only)

### Step 1: Delete ref

```bash
curl -X DELETE \
  -H "Cf-Access-Jwt-Assertion: <jwt>" \
  https://tpb-vault-infra.../vault/connections/conn_infra/secrets/NEW_API_KEY
```

### Step 2: Delete Cloudflare secret

```bash
npx wrangler secret delete CONN_infra_NEW_API_KEY
```

## List Secret Refs

```bash
curl -H "CF-Access-Client-Id: $CLIENT_ID" \
     -H "CF-Access-Client-Secret: $CLIENT_SECRET" \
     https://tpb-vault-infra.../vault/connections/conn_infra/secrets
```

Returns:

```json
{
  "secrets": [
    {"name": "OPENAI_API_KEY", "cf_key": "CONN_infra_OPENAI_API_KEY", "has_value": true}
  ]
}
```

## Access Control

| Actor | Access |
|-------|--------|
| Admin (email) | Full CRUD |
| Service Token | READ only |

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `has_value: false` | CF secret not set | `wrangler secret put` |
| 403 on write | Using service token | Use admin auth |
| Secret ref exists but no value | Only D1 updated | Run `wrangler deploy` |
