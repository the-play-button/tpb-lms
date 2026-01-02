# Vault Client

## Goal

Use the TPB Vault client to securely retrieve secrets in Python scripts. Replaces `.env` files.

## Location

```
tpb_system/04.Execution/vault_client.py
```

## Import Pattern

```python
import sys
from pathlib import Path

VAULT_CLIENT_PATH = Path(__file__).parent.parent  # adjust path as needed
sys.path.insert(0, str(VAULT_CLIENT_PATH))

from vault_client import VaultClient
```

## Usage

```python
client = VaultClient.from_env()

# Get secret values only (backwards compatible)
secrets = client.get_secrets("conn_infra")
api_token = secrets["CLOUDFLARE_API_TOKEN"]

# Get single secret value
openai_key = client.get_secret("conn_infra", "OPENAI_API_KEY")

# Get secret with metadata (value, type, description)
secret = client.get_secret_with_metadata("conn_infra", "OPENAI_API_KEY")
# secret = {"value": "sk-...", "type": "api_key", "description": "OpenAI API key"}

# Get all secrets with metadata
raw = client.get_secrets_raw("conn_infra")
for name, data in raw.items():
    print(f"{name}: {data['description']}")
```

## Available Connections

| Connection | Type | Secrets |
|------------|------|---------|
| `conn_infra` | infra | CLOUDFLARE_*, OPENAI_*, MODAL_* |
| `conn_integrations` | integrations | UNIFIEDTO_*, TALLY_* |
| `conn_user_<email>` | user_settings | USER_TRIGRAM, MHO_CALENDAR_EMAIL |

## API Methods

| Method | Description |
|--------|-------------|
| `VaultClient.from_env()` | Create client (reads service token from .env) |
| `client.health()` | Check vault status |
| `client.list_connections()` | List all connections |
| `client.get_connection(id)` | Get connection with full auth data |
| `client.get_secrets(id)` | Get secrets values as `{name: value}` |
| `client.get_secrets_raw(id)` | Get secrets with metadata `{name: {value, type, description}}` |
| `client.get_secret(id, name)` | Get single secret value |
| `client.get_secret_with_metadata(id, name)` | Get secret with `{value, type, description}` |

## Prerequisites

The vault client needs service token credentials. These should be in the project's `.env`:

```
CLOUDFLARE_SERVICE_ACCOUNT_ACCESS_CLIENT_ID=xxx.access
CLOUDFLARE_SERVICE_ACCOUNT_ACCESS_CLIENT_SECRET=yyy
```

## API Documentation

See: `lms/core/vault-api/docs/VAULT_API_SPEC.md`

