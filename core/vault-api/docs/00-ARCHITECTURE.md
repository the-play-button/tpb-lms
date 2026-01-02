# Vault-API Architecture

## Overview

vault-api is a secrets management and IAM platform built on Cloudflare Workers. It provides:

- **Secrets Engine**: KV-style path-based secret storage
- **IAM Module**: Users, Groups, Roles, Permissions, Applications
- **Audit**: Comprehensive logging of all access

## Architecture Diagram

```
                     ┌────────────────────────────────────┐
                     │           vault-api                │
                     │      (Cloudflare Worker)           │
                     ├────────────────────────────────────┤
                     │                                    │
   ┌─────────────────┼──────────────┬───────────────────┐│
   │                 │              │                   ││
   ▼                 ▼              ▼                   ▼│
┌──────────┐  ┌────────────┐  ┌──────────┐  ┌──────────┐│
│ Auth     │  │ Secrets    │  │ IAM      │  │ Audit    ││
│ Module   │  │ Engine     │  │ Module   │  │ Module   ││
├──────────┤  ├────────────┤  ├──────────┤  ├──────────┤│
│ CF Access│  │ KV (D1+CF) │  │ Users    │  │ Logs     ││
└──────────┘  └────────────┘  │ Groups   │  └──────────┘│
                              │ Roles    │              │
                              │ Apps     │              │
                              └──────────┘              │
                     └───────────────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
         ▼                          ▼                          ▼
   ┌───────────┐            ┌─────────────┐           ┌────────────┐
   │    D1     │            │  CF Worker  │           │  CF Access │
   │ (metadata)│            │   Secrets   │           │    API     │
   └───────────┘            │   (values)  │           └────────────┘
                            └─────────────┘
```

## Storage Model

| Data Type | Storage | Example |
|-----------|---------|---------|
| Secret metadata | D1 `sys_secret` | path, type, description |
| Secret values | CF Worker Secrets | Actual API keys, tokens |
| IAM entities | D1 `iam_*` tables | Users, groups, roles |
| Audit logs | D1 `sys_audit_log` | Access history |

## Modules

### 1. Secrets Engine

KV-style secret storage with path-based organization.

```
/v1/secret/data/infra/openai_api_key
/v1/secret/data/integrations/stripe_secret
/v1/secret/data/apps/lms/db_password
```

See [02-SECRETS_ENGINE.md](02-SECRETS_ENGINE.md)

### 2. IAM Module

Identity and Access Management:

- **Users**: Email-based identities
- **Groups**: Team/role grouping
- **Roles**: Permission bundles
- **Applications**: Registered TPB apps with namespaces

See [04-IAM.md](04-IAM.md)

### 3. Auth Module

Authentication via Cloudflare Access:

- Email users (browser): CF Access JWT
- Service tokens (apps): CF-Access-Client-Id/Secret headers

See [03-AUTH.md](03-AUTH.md)

## Bootstrap Requirements

Only 2 secrets required via `wrangler secret put`:

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `CLOUDFLARE_API_TOKEN` | API token with Workers + Access permissions |

Everything else is stored via the API itself.

## URLs

- **Production**: https://tpb-vault-infra.matthieu-marielouise.workers.dev
- **Dashboard**: /dashboard
- **Health**: /health


