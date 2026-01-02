#!/usr/bin/env python3
"""
Seed Vault Bootstrap

ONE-TIME migration from .env to Cloudflare Secrets.
The D1 schema already contains the secret refs via schema.sql.
This script only creates the Cloudflare Secrets with wrangler secret put.

Architecture:
    - D1 sys_secret_ref: registry (name -> cf_key) - seeded by schema.sql
    - Cloudflare Secrets: actual values - created by this script

Usage:
    python3 seed_vault_bootstrap.py              # Dry-run
    python3 seed_vault_bootstrap.py --apply      # Execute
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path
from typing import Dict, List, Tuple

# =============================================================================
# CONFIGURATION
# =============================================================================

PROJECT_ROOT = Path(__file__).parent.parent.parent
WORKER_NAME = "tpb-vault-infra"

# Mapping: cf_key -> env_var_name (from .env)
# This must match the sys_secret_ref entries in schema.sql
SECRETS: List[Tuple[str, str]] = [
    # Infrastructure
    ("CONN_infra_CLOUDFLARE_API_TOKEN", "CLOUDFLARE_API_TOKEN"),
    ("CONN_infra_CLOUDFLARE_API_TOKEN_2", "CLOUDFLARE_API_TOKEN_2"),
    ("CONN_infra_CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_ACCOUNT_ID"),
    ("CONN_infra_OPENAI_API_KEY", "OPENAI_API_KEY"),
    ("CONN_infra_MODAL_TOKEN_ID", "MODAL_TOKEN_ID"),
    ("CONN_infra_MODAL_TOKEN_SECRET", "MODAL_TOKEN_SECRET"),
    # Integrations
    ("CONN_integrations_UNIFIEDTO_API_TOKEN", "UNIFIEDTO_API_TOKEN"),
    ("CONN_integrations_UNIFIEDTO_WORKSPACE_ID", "UNIFIEDTO_WORKSPACE_ID"),
    ("CONN_integrations_UNIFIEDTO_WORKSPACE_SECRET", "UNIFIEDTO_WORKSPACE_SECRET"),
    ("CONN_integrations_UNIFIEDTO_CONNECTION_ID", "UNIFIEDTO_CONNECTION_ID"),
    ("CONN_integrations_TALLY_API_KEY", "TALLY_API_KEY"),
]


def load_env() -> Dict[str, str]:
    """Load environment variables from .env file."""
    env_path = PROJECT_ROOT / ".env"
    env_vars = {}
    
    if not env_path.exists():
        print(f"ERROR: .env file not found at {env_path}")
        sys.exit(1)
    
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                value = value.strip().strip('"').strip("'")
                if "#" in value:
                    value = value.split("#")[0].strip()
                env_vars[key.strip()] = value
    
    return env_vars


def run_wrangler_secret(cf_key: str, value: str, dry_run: bool = True) -> bool:
    """Set a Cloudflare secret using wrangler."""
    masked = value[:4] + "..." + value[-4:] if len(value) > 8 else "****"
    
    if dry_run:
        print(f"  [DRY-RUN] wrangler secret put {cf_key} = {masked}")
        return True
    
    try:
        cmd = f'echo "{value}" | npx wrangler secret put {cf_key}'
        result = subprocess.run(
            ["bash", "-c", cmd],
            capture_output=True,
            text=True,
            cwd=str(PROJECT_ROOT),
            timeout=30
        )
        
        if result.returncode != 0:
            print(f"  ERROR: {result.stderr.strip()}")
            return False
        
        print(f"  OK {cf_key}")
        return True
        
    except subprocess.TimeoutExpired:
        print(f"  ERROR: Timeout for {cf_key}")
        return False
    except Exception as e:
        print(f"  ERROR: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Seed Vault Bootstrap")
    parser.add_argument("--apply", action="store_true", help="Execute (default: dry-run)")
    args = parser.parse_args()
    
    print("=" * 60)
    print("TPB VAULT BOOTSTRAP")
    print("=" * 60)
    
    if not args.apply:
        print("\nDRY-RUN MODE - No changes will be made\n")
    else:
        print("\nAPPLY MODE - Creating Cloudflare Secrets\n")
    
    # Load .env
    print("Loading .env...")
    env_vars = load_env()
    print(f"Found {len(env_vars)} environment variables\n")
    
    # Validate
    print("Validating secrets...")
    missing = []
    for cf_key, env_key in SECRETS:
        if env_key not in env_vars:
            missing.append(f"  - {env_key} (for {cf_key})")
    
    if missing:
        print("MISSING environment variables:")
        for m in missing:
            print(m)
        if args.apply:
            print("\nAborting.")
            sys.exit(1)
        print("\nWould abort in apply mode.\n")
    else:
        print("All required env vars present\n")
    
    # Create secrets
    print("Creating Cloudflare Secrets...")
    stats = {"ok": 0, "fail": 0, "skip": 0}
    
    for cf_key, env_key in SECRETS:
        value = env_vars.get(env_key, "")
        
        if not value:
            print(f"  SKIP {cf_key}: no value")
            stats["skip"] += 1
            continue
        
        if run_wrangler_secret(cf_key, value, dry_run=not args.apply):
            stats["ok"] += 1
        else:
            stats["fail"] += 1
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Created: {stats['ok']}")
    print(f"  Failed:  {stats['fail']}")
    print(f"  Skipped: {stats['skip']}")
    
    if not args.apply:
        print("\nThis was a DRY-RUN. Run with --apply to execute.")
    elif stats["fail"] == 0:
        print("\nBootstrap complete!")
        print("Next steps:")
        print("  1. Apply schema: npx wrangler d1 execute vault-db --remote --file=db/schema.sql")
        print("  2. Deploy: npx wrangler deploy")
    else:
        print(f"\n{stats['fail']} secrets failed. Check errors above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
