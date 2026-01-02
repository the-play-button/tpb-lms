# Snapshot Vault

## Goal

Export a complete YAML snapshot of all secrets from the TPB Vault, including infrastructure, integrations, and per-user settings.

## Prerequisites

- Service token credentials in `.env` (either naming convention works):
  ```
  # Option 1 (preferred)
  VAULT_SERVICE_TOKEN_CLIENT_ID=xxx.access
  VAULT_SERVICE_TOKEN_CLIENT_SECRET=yyy
  
  # Option 2 (legacy)
  CLOUDFLARE_SERVICE_ACCOUNT_ACCESS_CLIENT_ID=xxx.access
  CLOUDFLARE_SERVICE_ACCOUNT_ACCESS_CLIENT_SECRET=yyy
  ```
- Python 3.9+ with `httpx` and `pyyaml`

## Usage

```bash
cd vault-api
source .venv/bin/activate

# Full snapshot to stdout
python scripts/execution/snapshot_vault.py

# Save to file
python scripts/execution/snapshot_vault.py --output vault_snapshot.yaml

# Masked values (for audit/sharing)
python scripts/execution/snapshot_vault.py --mask
```

## Output Format

```yaml
snapshot:
  timestamp: "2025-12-29T14:30:00Z"
  vault: "tpb-vault-infra"
  connection_count: 4
  secret_count: 15

connections:
  conn_infra:
    integration_type: infra
    integration_name: Infrastructure
    categories:
      - cloudflare
      - ai
      - modal
    secrets:
      CLOUDFLARE_API_TOKEN:
        value: "3Dp2xxx..."
        type: api_key
        description: "Cloudflare API token for deployments"
      OPENAI_API_KEY:
        value: "sk-proj-xxx..."
        type: api_key
        description: "OpenAI API key"

  conn_integrations:
    integration_type: integrations
    integration_name: Third-party Integrations
    secrets:
      TALLY_API_KEY:
        value: "xxx..."
        type: api_key
        description: "Tally API key"

  conn_user_matthieu_marielouise_at_theplaybutton_ai:
    integration_type: user_settings
    integration_name: Matthieu User Settings
    secrets:
      USER_TRIGRAM:
        value: "MML"
        type: config
        description: "User identifier"
      MHO_CALENDAR_EMAIL:
        value: "matthieu.marielouise@wondergrip.com"
        type: config
        description: "Calendar email"
```

## Options

| Flag | Description |
|------|-------------|
| `--output FILE` | Write to file instead of stdout |
| `--mask` | Mask secret values (show first 4 + last 4 chars) |
| `--type TYPE` | Filter by integration_type (infra, integrations, user_settings) |

## Security Notes

- The snapshot contains **actual secret values** - handle with care
- Use `--mask` when sharing or auditing
- Output files should not be committed to git (add to .gitignore)

## Script Location

```
vault-api/scripts/execution/snapshot_vault.py
```

## Edge Cases

| Situation | Behavior |
|-----------|----------|
| Connection with no secrets | Included with empty `secrets: {}` |
| Secret ref without value | Skipped (not in output) |
| Auth failure | Exit with error, no partial output |

