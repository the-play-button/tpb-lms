# API Reference

Base URL: `https://tpb-vault-infra.matthieu-marielouise.workers.dev`

## Authentication

All endpoints (except `/health`) require authentication.

| Method | Headers |
|--------|---------|
| Browser | `Cf-Access-Jwt-Assertion` (automatic via CF Access) |
| API | `CF-Access-Client-Id` + `CF-Access-Client-Secret` |

## Secrets Engine

### Write Secret
```http
POST /v1/secret/data/:path
Content-Type: application/json

{"value": "...", "description": "...", "type": "api_key", "tags": ["prod"]}
```

### Read Secret
```http
GET /v1/secret/data/:path
```

### Read Metadata
```http
GET /v1/secret/metadata/:path
```

### Delete Secret
```http
DELETE /v1/secret/data/:path
```

### List Secrets
```http
GET /v1/secret/list/:prefix
GET /v1/secret/list
```

## Legacy Connections (Deprecated)

```http
GET    /vault/connections
POST   /vault/connections
GET    /vault/connections/:id
PATCH  /vault/connections/:id
DELETE /vault/connections/:id
GET    /vault/connections/:id/secrets
POST   /vault/connections/:id/secrets
PUT    /vault/connections/:id/secrets/:name
DELETE /vault/connections/:id/secrets/:name
GET    /vault/connections/:id/audit
```

## IAM - Service Tokens

```http
GET    /iam/service-tokens
POST   /iam/service-tokens
DELETE /iam/service-tokens/:id
DELETE /iam/service-tokens/orphans
```

## IAM - Users

```http
GET    /iam/users
POST   /iam/users
GET    /iam/users/:id
PATCH  /iam/users/:id
DELETE /iam/users/:id
GET    /iam/users/:identifier/roles
POST   /iam/users/:id/grant-access
POST   /iam/users/:id/revoke-access
```

## IAM - Groups

```http
GET    /iam/groups
POST   /iam/groups
GET    /iam/groups/:id
PATCH  /iam/groups/:id
POST   /iam/groups/:id/members
DELETE /iam/groups/:id/members/:userId
POST   /iam/groups/:id/roles
DELETE /iam/groups/:id/roles/:roleId
```

## IAM - Roles

```http
GET    /iam/roles
POST   /iam/roles
GET    /iam/roles/:id
POST   /iam/roles/:id/permissions
DELETE /iam/roles/:id/permissions/:permId
```

## IAM - Permissions

```http
GET    /iam/permissions
POST   /iam/permissions
```

## IAM - Applications

```http
GET    /iam/applications
POST   /iam/applications
GET    /iam/applications/:id
PATCH  /iam/applications/:id
DELETE /iam/applications/:id
POST   /iam/applications/:id/rotate-credentials
```

## IAM - Authorization

```http
POST   /iam/can
GET    /iam/me/abilities
```

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

## Cloudflare Resources

```http
GET    /cloudflare/resources
GET    /cloudflare/resources/:type
GET    /cloudflare/resources/:type/:id
```

## Dashboards (HTML)

```http
GET    /                    # Main dashboard
GET    /dashboard           # Main dashboard
GET    /applications/dashboard
GET    /cloudflare/dashboard
```

## Health

```http
GET    /health              # Public, no auth
```

Response:
```json
{
  "success": true,
  "status": "healthy",
  "service": "tpb-vault-infra",
  "stats": {"connections": 2, "secrets": 15}
}
```

## Error Format

```json
{
  "success": false,
  "error": "Description of what went wrong",
  "code": "ERROR_CODE"
}
```

Common codes:
- `NOT_FOUND` - Resource doesn't exist
- `FORBIDDEN` - Insufficient permissions
- `UNAUTHORIZED` - Missing/invalid auth
- `MISSING_FIELD` - Required field not provided
- `EXISTS` - Resource already exists


