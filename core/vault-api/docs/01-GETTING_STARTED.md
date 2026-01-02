# Getting Started with vault-api

## Prerequisites

- Cloudflare account
- Wrangler CLI installed (`npm install -g wrangler`)
- Access to `theplaybutton` CF Access organization

## Bootstrap (One-time Setup)

### 1. Clone and navigate

```bash
cd tpb_system/04.Execution/lms/core/vault-api
```

### 2. Create API Token

Go to Cloudflare Dashboard → My Profile → API Tokens → Create Token

Required permissions:
- **Account** → Workers Scripts → Edit
- **Account** → Access: Service Tokens → Edit
- **Account** → Access: Apps and Policies → Edit

### 3. Set Bootstrap Secrets

```bash
# Your Cloudflare Account ID (from dashboard URL)
wrangler secret put CLOUDFLARE_ACCOUNT_ID
# Enter: 79d621c1d8e20c3c85009b30099b96e0

# Your API token created above
wrangler secret put CLOUDFLARE_API_TOKEN
# Enter: <your-token>
```

### 4. Apply Database Schema

```bash
npx wrangler d1 execute vault-db --remote --file=db/schema.sql
npx wrangler d1 execute vault-db --remote --file=db/migrations/005_secrets_engine.sql
```

### 5. Deploy

```bash
npx wrangler deploy
```

## Verify Installation

```bash
curl https://tpb-vault-infra.matthieu-marielouise.workers.dev/health
```

Expected response:
```json
{
  "success": true,
  "status": "healthy",
  "service": "tpb-vault-infra"
}
```

## Your First Secret

### 1. Get credentials

Use your personal service token or create one via the dashboard.

### 2. Store a secret

```bash
export VAULT_URL="https://tpb-vault-infra.matthieu-marielouise.workers.dev"
export VAULT_CLIENT_ID="your-client-id.access"
export VAULT_CLIENT_SECRET="your-secret"

curl -X POST "$VAULT_URL/v1/secret/data/test/hello" \
  -H "CF-Access-Client-Id: $VAULT_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $VAULT_CLIENT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"value": "world", "description": "My first secret"}'
```

### 3. Read the secret

```bash
curl "$VAULT_URL/v1/secret/data/test/hello" \
  -H "CF-Access-Client-Id: $VAULT_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $VAULT_CLIENT_SECRET"
```

Response:
```json
{
  "success": true,
  "data": {
    "path": "test/hello",
    "value": "world",
    "metadata": {
      "type": "secret",
      "description": "My first secret"
    }
  }
}
```

## Python Client

```python
from vault_client import VaultClient

# From environment variables
client = VaultClient.from_env()

# Read secrets
secrets = client.get_secrets("conn_infra")
api_key = secrets["OPENAI_API_KEY"]["value"]
```

## Next Steps

- [02-SECRETS_ENGINE.md](02-SECRETS_ENGINE.md) - Full secrets API
- [04-IAM.md](04-IAM.md) - User and role management
- [05-FOR_TPB_APPS.md](05-FOR_TPB_APPS.md) - Integration guide for TPB apps


