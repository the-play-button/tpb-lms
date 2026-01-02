# Modal + vault-api Integration

Reference architecture for deploying Modal.com ML applications with centralized secret management via TPB vault-api.

## Architecture Overview

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   CF Pages      │      │   vault-api     │      │     Modal       │
│   Frontend      │      │   (Workers)     │      │   (Python ML)   │
├─────────────────┤      ├─────────────────┤      ├─────────────────┤
│ /api/search     │─────▶│ conn_infra/     │      │ SearchService   │
│ Pages Function  │      │ MODAL_API_SECRET│──┐   │ sentence-trans. │
│                 │      └─────────────────┘  │   ├─────────────────┤
│ CF_ACCESS_*     │                           └──▶│ sphere-grid-    │
│ Service Token   │                               │ api-secret      │
└─────────────────┘                               │ (API_SECRET)    │
        │                                         └─────────────────┘
        │                                                  │
        └──────────────────────────────────────────────────┘
                            secret validation
```

## Key Principles

1. **Single Source of Truth**: All secrets are stored in vault-api (`conn_infra`)
2. **Service Token Auth**: CF Pages Functions use Service Token to access vault-api
3. **Synchronized Secrets**: Modal secret is created from vault-api value during deploy
4. **Runtime Validation**: Both CF Function and Modal validate the same shared secret

## Secrets Layout

| Secret | Storage | Used By |
|--------|---------|---------|
| `MODAL_TOKEN_ID` | vault-api (conn_infra) | Deploy scripts |
| `MODAL_TOKEN_SECRET` | vault-api (conn_infra) | Deploy scripts |
| `MODAL_API_SECRET` | vault-api (conn_infra) | CF Function, Modal |
| `CF_ACCESS_CLIENT_ID` | CF Pages secrets | CF Function |
| `CF_ACCESS_CLIENT_SECRET` | CF Pages secrets | CF Function |
| `API_SECRET` | Modal Secrets | Modal app |

## Setup Process

### 1. Add secrets to vault-api

```sql
-- In vault-api/db/schema.sql
INSERT INTO sys_secret_ref (id, connection_id, name, cf_key, type, description)
VALUES 
  ('ref_modal_api_secret', 'conn_infra', 'MODAL_API_SECRET', 
   'CONN_infra_MODAL_API_SECRET', 'api_key', 
   'Shared secret for Modal API authentication');
```

```bash
# Store the actual value
cd tpb_system/04.Execution/lms/core/vault-api
openssl rand -base64 32 | npx wrangler secret put CONN_infra_MODAL_API_SECRET

# Insert reference in D1
npx wrangler d1 execute vault-db --remote --command="INSERT INTO sys_secret_ref ..."
```

### 2. Configure CF Pages secrets

```bash
# Get Service Token credentials from vault-api
CLIENT_ID=$(python3 -c "from vault_client import get_secret; print(get_secret('conn_infra', 'CLOUDFLARE_SERVICE_ACCOUNT_ACCESS_CLIENT_ID'))")
CLIENT_SECRET=$(python3 -c "from vault_client import get_secret; print(get_secret('conn_infra', 'CLOUDFLARE_SERVICE_ACCOUNT_ACCESS_CLIENT_SECRET'))")

# Store in CF Pages
echo "$CLIENT_ID" | npx wrangler pages secret put CF_ACCESS_CLIENT_ID --project-name <PROJECT>
echo "$CLIENT_SECRET" | npx wrangler pages secret put CF_ACCESS_CLIENT_SECRET --project-name <PROJECT>
```

### 3. Deploy Modal with vault-api secrets

```bash
cd tpb_system/04.Execution/sphere\ grid
python scripts/devops/deploy_modal.py
```

This script:
1. Gets `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` from vault-api
2. Gets `MODAL_API_SECRET` from vault-api
3. Creates Modal secret `sphere-grid-api-secret` with `API_SECRET=<value>`
4. Deploys the Modal app

## CF Function Implementation

The Pages Function retrieves secrets from vault-api at runtime:

```javascript
// Configuration
const VAULT_API_URL = 'https://tpb-vault-infra.matthieu-marielouise.workers.dev';

// Cache for performance
let cachedSecret = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getSecretFromVault(env, connectionId, secretName) {
    // Check cache
    if (cachedSecret && Date.now() < cacheExpiry) {
        return cachedSecret;
    }
    
    const response = await fetch(
        `${VAULT_API_URL}/vault/connections/${connectionId}`,
        {
            headers: {
                'CF-Access-Client-Id': env.CF_ACCESS_CLIENT_ID,
                'CF-Access-Client-Secret': env.CF_ACCESS_CLIENT_SECRET
            }
        }
    );
    
    const data = await response.json();
    cachedSecret = data?.connection?.auth?.secrets?.[secretName]?.value;
    cacheExpiry = Date.now() + CACHE_TTL;
    
    return cachedSecret;
}
```

## Modal App Implementation

Modal validates the shared secret:

```python
import modal
import os

app = modal.App("my-app")

@app.function(secrets=[modal.Secret.from_name("my-api-secret")])
@modal.fastapi_endpoint(method="POST")
def api(item: dict):
    from fastapi import HTTPException
    
    expected = os.environ.get("API_SECRET")
    provided = item.get("secret", "")
    
    if expected and provided != expected:
        raise HTTPException(status_code=403, detail="Invalid secret")
    
    # Process request...
```

## Deployment Scripts

### Structure

```
sphere grid/
├── scripts/
│   └── devops/
│       ├── deploy.py           # Full deployment orchestrator
│       └── deploy_modal.py     # Modal-specific deployment
```

### Usage

```bash
# Full deploy (Modal + Pages)
python scripts/devops/deploy.py

# Modal only
python scripts/devops/deploy.py --modal

# Pages only  
python scripts/devops/deploy.py --pages

# With data regeneration
python scripts/devops/deploy.py --regenerate

# Preview only
python scripts/devops/deploy.py --dry-run
```

## Troubleshooting

### 500 on /api/search

1. Check CF Pages secrets are set:
   ```bash
   npx wrangler pages secret list --project-name tpb-sphere-grid
   ```

2. Test vault-api access:
   ```bash
   curl -H "CF-Access-Client-Id: $ID" -H "CF-Access-Client-Secret: $SECRET" \
     https://tpb-vault-infra.matthieu-marielouise.workers.dev/vault/connections/conn_infra
   ```

### 403 from Modal

1. Verify Modal secret exists:
   ```bash
   MODAL_TOKEN_ID=... MODAL_TOKEN_SECRET=... modal secret list
   ```

2. Check secret value matches vault-api:
   ```bash
   python -c "from vault_client import get_secret; print(get_secret('conn_infra', 'MODAL_API_SECRET'))"
   ```

### Cold start timeout

Modal cold starts take ~30s (model loading). This is expected.
For production, consider `keep_warm=1` in Modal config.

## Security Considerations

1. **Service Tokens**: Used for machine-to-machine auth, no user identity
2. **Secret Rotation**: Update vault-api, then redeploy Modal
3. **Caching**: CF Function caches secrets (5min TTL) to reduce vault-api calls
4. **Audit**: vault-api logs all secret access

## Reference Implementation

- **Sphere Grid**: `tpb_system/04.Execution/sphere grid/`
- **vault-api**: `tpb_system/04.Execution/lms/core/vault-api/`
- **vault_client.py**: `tpb_system/04.Execution/vault_client.py`






