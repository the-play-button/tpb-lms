# Authentication

vault-api uses Cloudflare Access for authentication.

## Auth Methods

### 1. Email (Browser Users)

When accessing via browser, Cloudflare Access handles login:

1. User visits vault-api URL
2. CF Access prompts for login (email OTP, SSO, etc.)
3. CF Access injects `Cf-Access-Jwt-Assertion` header
4. vault-api validates JWT and extracts email

### 2. Service Token (Applications)

For programmatic access:

```bash
curl https://tpb-vault-infra.../v1/secret/data/test \
  -H "CF-Access-Client-Id: xxx.access" \
  -H "CF-Access-Client-Secret: yyy"
```

## Roles

| Role | Assigned To | Permissions |
|------|-------------|-------------|
| `superadmin` | IAM group `grp_admins` | Full access |
| `admin` | IAM group with admin role | User/group management |
| `reader` | Default for email users | Read-only |
| `service_token` | Tokens without scopes | Read-only |
| `app_service_token` | Application tokens | Scoped mutations |

## Self-Service Tokens

Any authenticated user can create personal service tokens:

```http
POST /iam/service-tokens
```

Response:
```json
{
  "token": {
    "client_id": "abc123.access",
    "client_secret": "xyz789..."
  },
  "env_file": "VAULT_CLIENT_ID=abc123.access\nVAULT_CLIENT_SECRET=xyz789..."
}
```

## Application Tokens

Applications registered via `/iam/applications` get tokens with scopes:

```json
{
  "credentials": {
    "client_id": "app-lms-xxx.access",
    "client_secret": "..."
  },
  "scopes": ["tpblms:role:*", "tpblms:group:*"]
}
```

Scoped tokens can mutate resources within their namespace.

## Security Model

```
┌─────────────────────────────────────────────────┐
│                  Permission Check               │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. Is JWT valid? (issuer, expiry)              │
│       ↓                                         │
│  2. Is email or service token?                  │
│       ↓                                         │
│  3. If email → lookup IAM role                  │
│     If service → check scopes                   │
│       ↓                                         │
│  4. Allow/deny based on role + method           │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Rate Limiting

Handled by Cloudflare Access policies, not vault-api itself.


