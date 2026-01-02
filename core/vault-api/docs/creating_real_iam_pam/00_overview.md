# Phase 0 - Overview & Architecture

## Objectif

Transformer vault-api en console IAM complète:
- Multi-tenant (organizations)
- User/Group management avec contrôle CF Access
- CASL authorization centralisée
- **Developer onboarding ZERO-SECRET**

## Principe ZERO-SECRET

**Aucun secret n'est donné par l'admin au dev.**

1. Admin crée user dans vault-api IAM
2. vault-api auto-grant l'accès CF Access (SSO email)
3. Dev s'authentifie via SSO (email, pas de mot de passe)
4. Dev génère son propre token via vault-api
5. Dev utilise `VAULT_CLIENT_*` (pas `CLOUDFLARE_*`)

Cloudflare = infrastructure sous-jacente.
vault-api = SSOT pour l'IAM.

## Architecture SSOT

```
vault-api (SSOT)
    │
    ├── D1 Database (metadata)
    │   ├── iam_organization
    │   ├── iam_user
    │   ├── iam_group
    │   ├── iam_role/permission
    │   └── iam_service_token
    │
    ├── Cloudflare Secrets (values)
    │   └── env[cf_key] = actual secret
    │
    └── Cloudflare Access API (controlled by vault-api)
        ├── Access Applications
        ├── Access Policies (email/token)
        └── Service Tokens
```

**Flux linéaire** : vault-api **contrôle** CF Access, pas de sync bidirectionnel.

## Phases d'implémentation

| Phase | Fichier | Description | Status |
|-------|---------|-------------|--------|
| 1 | `01_schema.md` | Schema D1 + seed data | ✅ |
| 2 | `02_cf_access_controller.md` | Module CF Access intégré | ✅ |
| 3 | `03_user_management.md` | CRUD users + CF Access policies | ✅ |
| 4 | `04_groups_roles.md` | Groups, roles, permissions | ✅ |
| 5 | `05_casl_authorization.md` | Endpoint `/iam/can` | ✅ |
| 6 | `06_dev_onboarding.md` | Flow ZERO-SECRET complet | ✅ |

## Sécurité (Gold Standard)

| Aspect | Implémentation |
|--------|----------------|
| Secret values | Cloudflare Secrets uniquement (jamais D1) |
| Service tokens | READ ONLY + POST /iam/can (query) |
| Token creation | Crée token + ajoute policy CF Access atomiquement |
| Audit | Toutes actions loggées dans `sys_audit_log` |
| SSOT | vault-api contrôle CF Access via API |
| Zero-secret | Dev auth via SSO, génère son propre token |

## Variables d'environnement

```bash
# Dev container (.devcontainer/.env)
VAULT_CLIENT_ID=xxx.access
VAULT_CLIENT_SECRET=xxx

# vault-api secrets (CF Secrets)
CLOUDFLARE_API_TOKEN_IAM=xxx  # Pour contrôler CF Access
CLOUDFLARE_ACCOUNT_ID=xxx
```
