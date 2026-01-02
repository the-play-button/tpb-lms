# TPB Vault API

Secure secret management + IAM with Cloudflare Workers.

## Base URL

```
https://tpb-vault-infra.matthieu-marielouise.workers.dev
```

## Architecture

```
D1 Database
├── Vault
│   ├── connection (integration_type, categories)
│   ├── connection_auth (1:1 with connection)
│   ├── sys_secret_ref (name -> cf_key mapping)
│   └── sys_audit_log
│
├── IAM
│   ├── iam_organization (multi-tenant)
│   ├── iam_user (email, status)
│   ├── iam_group (teams)
│   ├── iam_role (superadmin, admin, developer, reader)
│   ├── iam_permission (action:resource)
│   ├── iam_user_group, iam_group_role, iam_role_permission
│   └── iam_service_token (self-service tokens)
│
Cloudflare Secrets
└── env[cf_key] = "actual_secret_value"
```

## Authentication

Protected by Cloudflare Access. Two auth methods:

| Method | Header | Use case |
|--------|--------|----------|
| Email (browser) | `Cf-Access-Jwt-Assertion` | Dashboard UI |
| Service Token | `CF-Access-Client-Id` + `CF-Access-Client-Secret` | Apps/scripts |

### Roles

| Role | Access | Assigned via |
|------|--------|--------------|
| `superadmin` | Full CRUD everywhere | IAM group with `role_superadmin` |
| `admin` | Manage users/groups | IAM group with `role_admin` |
| `reader` | GET only + self-service tokens | Default for email users |
| `service_token` | GET only + POST /iam/can | Service tokens |

## Endpoints

### Public

```http
GET /health
```

### UI Dashboards

```http
GET /dashboard              # Service tokens management
GET /cloudflare/dashboard   # Cloudflare resources view
```

---

## Vault - Connections

```http
GET    /vault/connections
POST   /vault/connections                    # admin
GET    /vault/connections/:id
PATCH  /vault/connections/:id                # admin
DELETE /vault/connections/:id                # admin
```

### Secrets

```http
GET    /vault/connections/:id/secrets
POST   /vault/connections/:id/secrets        # admin
DELETE /vault/connections/:id/secrets/:name  # admin
GET    /vault/connections/:id/audit
```

**Response GET /vault/connections/:id** :
```json
{
  "connection": {
    "id": "conn_infra",
    "auth": {
      "secrets": {
        "OPENAI_API_KEY": { "value": "sk-...", "type": "api_key" }
      }
    }
  }
}
```

---

## IAM - Service Tokens (Self-Service)

Any authenticated user can manage their own tokens.

```http
GET    /iam/service-tokens              # List my tokens
POST   /iam/service-tokens              # Create token
DELETE /iam/service-tokens/:id          # Revoke my token
DELETE /iam/service-tokens/orphans      # Cleanup orphans (admin)
```

**Response POST** :
```json
{
  "token": {
    "client_id": "xxx.access",
    "client_secret": "yyy"
  },
  "env_file": "VAULT_CLIENT_ID=xxx\nVAULT_CLIENT_SECRET=yyy"
}
```

---

## IAM - Users

```http
GET    /iam/users
POST   /iam/users
GET    /iam/users/:id
PATCH  /iam/users/:id
DELETE /iam/users/:id
POST   /iam/users/:id/grant-access
POST   /iam/users/:id/revoke-access
```

---

## IAM - Groups

```http
GET    /iam/groups
POST   /iam/groups
GET    /iam/groups/:id
PATCH  /iam/groups/:id
POST   /iam/groups/:id/members          # Add user
DELETE /iam/groups/:id/members/:userId  # Remove user
POST   /iam/groups/:id/roles            # Assign role
DELETE /iam/groups/:id/roles/:roleId    # Remove role
```

---

## IAM - Roles & Permissions

```http
GET    /iam/roles
POST   /iam/roles
GET    /iam/roles/:id
POST   /iam/roles/:id/permissions
DELETE /iam/roles/:id/permissions/:permId
GET    /iam/permissions
```

---

## IAM - Authorization (CASL)

```http
POST /iam/can
```

**Request** :
```json
{ "action": "read", "resource": "secret", "user_id": "usr_admin" }
```

**Response** :
```json
{ "allowed": true, "reason": "manage:*" }
```

```http
GET /iam/me/abilities
```

---

## IAM - Organizations

```http
GET    /iam/organizations
POST   /iam/organizations
GET    /iam/organizations/:id
PATCH  /iam/organizations/:id
DELETE /iam/organizations/:id
GET    /iam/organizations/:id/members
GET    /iam/organizations/:id/audit
```

---

## Cloudflare Resources

```http
GET /cloudflare/resources                    # All resources
GET /cloudflare/resources/:type              # access, workers, pages
GET /cloudflare/resources/:type/:id          # Details
```

**Response** :
```json
{
  "resources": {
    "access": [...],
    "workers": [...],
    "pages": [...],
    "service_tokens": [...]
  },
  "summary": { "total_access": 5, "total_workers": 3 }
}
```

---

## Python Client

```python
from vault_client import VaultClient

# From environment (VAULT_CLIENT_ID, VAULT_CLIENT_SECRET)
client = VaultClient.from_env()

# Get secrets
secrets = client.get_secrets("conn_infra")
openai_key = secrets["OPENAI_API_KEY"]["value"]

# Check permission
can = client.can("read", "secret", user_id="usr_admin")
if can["allowed"]:
    print("Access granted")

# List connections
connections = client.list_connections()
```

---

## Quick Reference

| Action | Endpoint | Auth |
|--------|----------|------|
| Get secrets | `GET /vault/connections/:id` | Any |
| Create token | `POST /iam/service-tokens` | Email |
| Check permission | `POST /iam/can` | Any |
| List CF resources | `GET /cloudflare/resources` | Any |
| Manage users | `POST /iam/users` | Admin |
