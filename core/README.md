# TPB Core Components

Briques réutilisables du framework TPB, destinées à être extraites vers un repo `tpb-core` standalone.

---

## Architecture Vault Hybride

```
┌─────────────────────────────────────────────────────────────┐
│                    tpb-vault-infra                           │
│  Secrets d'infrastructure partagés                          │
│  URL: https://tpb-vault-infra.matthieu-marielouise.workers.dev
│  ─────────────────────────────────────────────────────────  │
│  CLOUDFLARE_ACCOUNT_ID        # Account Cloudflare          │
│  CLOUDFLARE_API_TOKEN         # Token API principal         │
│  CLOUDFLARE_SERVICE_ACCOUNT_* # Service token Access        │
│  OPENAI_API_KEY               # API OpenAI                  │
│  MODAL_TOKEN_*                # Credentials Modal           │
│  UNIFIEDTO_*                  # Credentials Unified.to      │
│  TALLY_API_KEY                # API Tally (création forms)  │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│       lms-vault         │     │    {projet}-vault       │
│  Secrets LMS            │     │  Secrets projet X       │
│  ─────────────────────  │     │  ─────────────────────  │
│  TALLY_SIGNING_SECRET   │     │  (secrets applicatifs)  │
│  STREAM_SIGNING_KEY_*   │     │                         │
└─────────────────────────┘     └─────────────────────────┘
```

### Principe

- **tpb-vault-infra** : Secrets d'infrastructure partagés entre tous les projets TPB
- **{projet}-vault** : Secrets applicatifs spécifiques à chaque projet

### Sécurité

Chaque vault est protégé par Cloudflare Access :
- **Accès humain** : Policy "TPB Core Team" (email-based)
- **Accès programmatique** : Policy "Service Token" (non_identity)

---

## Composants

### vault-api/

Worker Cloudflare qui expose les secrets via API protégée.

**Endpoints :**
| Path | Protection | Description |
|------|------------|-------------|
| `GET /health` | Bypass (public) | Health check |
| `GET /secrets` | Access | Liste les secrets disponibles |
| `GET /secrets/:name` | Access | Récupère la valeur d'un secret |

**Déploiement :**
```bash
cd vault-api
wrangler deploy

# Ajouter des secrets
wrangler secret put SECRET_NAME
```

**Usage depuis Python (framework DOE) :**
```python
import os
import requests

def get_secret(name: str, vault_url: str = None) -> str:
    """Fetch secret from TPB Vault."""
    vault_url = vault_url or os.environ.get(
        "TPB_VAULT_URL", 
        "https://tpb-vault-infra.matthieu-marielouise.workers.dev"
    )
    
    resp = requests.get(
        f"{vault_url}/secrets/{name}",
        headers={
            "CF-Access-Client-Id": os.environ["CF_ACCESS_CLIENT_ID"],
            "CF-Access-Client-Secret": os.environ["CF_ACCESS_CLIENT_SECRET"]
        },
        timeout=5
    )
    resp.raise_for_status()
    return resp.json()["value"]

# Usage
api_token = get_secret("CLOUDFLARE_API_TOKEN")
```

**Variables d'environnement requises :**
```bash
export CF_ACCESS_CLIENT_ID="xxx.access"
export CF_ACCESS_CLIENT_SECRET="xxx"
```

---

## Conventions de nommage

| Type | Pattern | Exemple |
|------|---------|---------|
| Vault infra | `tpb-vault-infra` | Unique, partagé |
| Vault applicatif | `{projet}-vault` | `lms-vault`, `crm-vault` |
| Secret | `UPPER_SNAKE_CASE` | `CLOUDFLARE_API_TOKEN` |

---

## Extraction future vers tpb-core

Ce dossier `core/` est conçu pour être extrait vers un repo standalone :

1. Créer le repo `tpb-core`
2. Déplacer `vault-api/` et ce README
3. Les projets (LMS, etc.) appellent le Vault via HTTP
4. Optionnel : publier un package Python `tpb-vault` pour simplifier l'usage

---

## Références

- Architecture complète : `01.Piloting/projects/PB28 R&D Setup/labor/tpb-core/tpb-core-archi.md`
- Framework DOE : `FOLLOW_THIS_FUCKING_INSTRUCTIONS_LLM_AGENTS.md`
