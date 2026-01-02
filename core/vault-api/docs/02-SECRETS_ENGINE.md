# Secrets Engine (KV)

HashiCorp Vault-style path-based secret storage.

## Concepts

### Paths

Secrets are organized by path, like a filesystem:

```
infra/openai_api_key
infra/cloudflare_token
integrations/stripe_secret
apps/lms/db_password
users/john/personal_token
```

### Storage

- **Metadata** → D1 database (`sys_secret` table)
- **Values** → Cloudflare Worker Secrets (encrypted at rest)

Path `infra/openai_api_key` becomes CF secret key `SECRET_infra_openai_api_key`.

## API Reference

### Write Secret

Create or update a secret.

```http
POST /v1/secret/data/:path
```

**Body:**
```json
{
  "value": "sk-abc123...",
  "description": "OpenAI API key for production",
  "type": "api_key",
  "tags": ["production", "ai"]
}
```

**Response (201):**
```json
{
  "success": true,
  "path": "infra/openai_api_key",
  "cf_key": "SECRET_infra_openai_api_key",
  "stored": true
}
```

### Read Secret

Get secret with value.

```http
GET /v1/secret/data/:path
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "path": "infra/openai_api_key",
    "value": "sk-abc123...",
    "metadata": {
      "type": "api_key",
      "description": "OpenAI API key for production",
      "tags": ["production", "ai"],
      "created_by": "matthieu@theplaybutton.ai",
      "created_at": "2024-12-31T10:00:00Z",
      "updated_at": "2024-12-31T10:00:00Z"
    }
  }
}
```

### Read Metadata Only

Get metadata without revealing value.

```http
GET /v1/secret/metadata/:path
```

**Response (200):**
```json
{
  "success": true,
  "metadata": {
    "path": "infra/openai_api_key",
    "type": "api_key",
    "description": "OpenAI API key for production",
    "tags": ["production", "ai"],
    "created_at": "2024-12-31T10:00:00Z"
  }
}
```

### Delete Secret

Remove secret (both metadata and value).

```http
DELETE /v1/secret/data/:path
```

**Response (200):**
```json
{
  "success": true,
  "path": "infra/openai_api_key",
  "deleted": true,
  "cf_deleted": true
}
```

### List Secrets

List secrets by prefix.

```http
GET /v1/secret/list/:prefix
GET /v1/secret/list
```

**Response (200):**
```json
{
  "success": true,
  "prefix": "infra/",
  "keys": [
    {"path": "infra/openai_api_key", "type": "api_key"},
    {"path": "infra/cloudflare_token", "type": "token"}
  ],
  "count": 2
}
```

## Secret Types

| Type | Description |
|------|-------------|
| `secret` | Generic secret (default) |
| `api_key` | API key |
| `token` | Access/refresh token |
| `certificate` | Certificate or PEM |
| `password` | Password |

## Best Practices

### Path Organization

```
# By service
infra/cloudflare_token
infra/modal_secret

# By integration
integrations/stripe_key
integrations/sendgrid_key

# By application
apps/lms/db_url
apps/crm/api_key

# Per-user (if needed)
users/john_doe/personal_token
```

### Rotation

1. Write new secret to same path (updates value)
2. Old value is overwritten
3. No versioning (keep it simple)

```bash
curl -X POST /v1/secret/data/infra/api_key \
  -d '{"value": "new-rotated-value"}'
```

## Legacy Migration

If you have secrets in the old `/vault/connections/:id/secrets` format, run:

```bash
python scripts/execution/migrate_secrets_to_kv.py
```


