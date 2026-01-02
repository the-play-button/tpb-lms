# Database Management - Vault API

## Structure

```
db/
├── schema.sql              # Reference schema (documentation only)
├── migrations/
│   ├── 001_initial_schema.sql  # Idempotent schema creation
│   └── 002_seed_data.sql       # Idempotent seed data
└── README.md               # This file
```

## Safe Deployment (Default)

**RECOMMENDED**: Deploy without touching the database to preserve all data:

```bash
python scripts/devops/deploy.py              # Safe - no DB changes
python scripts/devops/deploy.py --skip-db    # Explicit skip
```

This preserves:
- ✅ Service tokens created via UI/API
- ✅ Audit logs
- ✅ All dynamic data

## First-Time Setup

**DESTRUCTIVE**: Only use for initial setup or when you want to reset everything:

```bash
python scripts/devops/deploy.py --init-db    # ⚠️ DESTROYS ALL DATA!
```

This will:
- ❌ Drop all existing tables
- ✅ Create fresh schema
- ✅ Insert seed data only

## Migration System (Future)

```bash
python scripts/devops/deploy.py --migrate    # Apply incremental changes
```

Currently not implemented - migrations will be tracked in the future.

## What Gets Lost vs Preserved

### Lost with `--init-db`:
- Service tokens generated via `/iam/service-tokens`
- Audit logs in `sys_audit_log`
- Any data not in seed files

### Always Preserved:
- Cloudflare Secrets (stored separately)
- Worker code and configuration
- Seed data (gets recreated)

## Files Explained

- **`schema.sql`**: Complete reference schema for documentation
- **`migrations/001_initial_schema.sql`**: Idempotent table creation (`CREATE TABLE IF NOT EXISTS`)
- **`migrations/002_seed_data.sql`**: Idempotent seed insertion (`INSERT OR IGNORE`)

## Best Practices

1. **Default to safe deployment**: `python scripts/devops/deploy.py`
2. **Never use `--init-db` in production** unless you want to reset everything
3. **Test locally first** before deploying to production
4. **Backup important data** before using `--init-db`
