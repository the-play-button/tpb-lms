# Scripts — commands reference

| Script | Invocation | Description |
|---|---|---|
| `migrate-users-to-vault.py` | `python3 scripts/migrate-users-to-vault.py` | One-shot migration: bulk-uploads users into bastion vault (idempotent — checks existing entries before insert). |
| `migrate_to_unifiedto.py` | `python3 scripts/migrate_to_unifiedto.py` | One-shot migration: copies legacy direct-provider connections into unified.to canonical connections. |
