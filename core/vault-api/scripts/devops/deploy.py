#!/usr/bin/env python3
"""
deploy.py - Vault API Deployment Script
Deploys vault-api Worker with safe database handling

Usage:
    python scripts/devops/deploy.py              # Deploy worker only (SAFE - no DB changes)
    python scripts/devops/deploy.py --skip-db    # Skip database setup entirely
    python scripts/devops/deploy.py --init-db    # Initialize database (FIRST TIME ONLY - destroys data!)
    python scripts/devops/deploy.py --migrate    # Apply database migrations (future)
    python scripts/devops/deploy.py --skip-secrets  # Skip secrets check

IMPORTANT: By default, NO database changes are made to preserve data.
Use --init-db only for first-time setup or when you want to reset all data.

One-liner (from vault-api root):
    cd tpb_system/04.Execution/lms/core/vault-api && python scripts/devops/deploy.py
"""

import argparse
import subprocess
import sys
import os
from pathlib import Path

# Colors
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
RESET = "\033[0m"

# Configuration
WORKER_NAME = "tpb-vault-infra"
VAULT_URL = "https://tpb-vault-infra.matthieu-marielouise.workers.dev"


def log(msg: str, level: str = "info"):
    """Print colored log message."""
    colors = {"info": CYAN, "success": GREEN, "warn": YELLOW, "error": RED}
    print(f"{colors.get(level, RESET)}{msg}{RESET}")


def run_cmd(cmd: list, cwd: Path = None, check: bool = True) -> subprocess.CompletedProcess:
    """Run a command with error handling."""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd, timeout=120)
        if check and result.returncode != 0:
            log(f"❌ Command failed: {' '.join(cmd)}", "error")
            if result.stderr:
                print(result.stderr)
            sys.exit(1)
        return result
    except subprocess.TimeoutExpired:
        log(f"❌ Command timed out: {' '.join(cmd)}", "error")
        sys.exit(1)
    except FileNotFoundError:
        log(f"❌ Command not found: {cmd[0]}", "error")
        sys.exit(1)


def get_project_root() -> Path:
    """Get the vault-api project root directory."""
    return Path(__file__).parent.parent.parent


def load_env() -> None:
    """Load environment variables from .env file if it exists."""
    root = get_project_root()
    env_file = root / ".env"
    
    if env_file.exists():
        log(f"📄 Loading environment from {env_file.name}...", "info")
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    # Remove quotes if present
                    value = value.strip('"').strip("'")
                    os.environ[key.strip()] = value
        log("✅ Environment loaded", "success")
    else:
        log("⚠️  No .env file found", "warn")


def check_secrets() -> bool:
    """Check required secrets are configured (from .env or wrangler secrets)."""
    log("🔐 Checking vault-api secrets...")
    
    # Load .env first
    load_env()
    
    # Check environment variables (from .env or system)
    required_env_vars = {
        "CLOUDFLARE_API_TOKEN": "API Token for Cloudflare",
        "CLOUDFLARE_ACCOUNT_ID": "Cloudflare Account ID"
    }
    
    missing = []
    for var, description in required_env_vars.items():
        if not os.environ.get(var):
            missing.append(f"{var} ({description})")
    
    if missing:
        log(f"❌ Missing environment variables:", "error")
        for m in missing:
            print(f"   - {m}")
        log("Add them to .env file or export them", "warn")
        return False
    
    log("✅ All required secrets found", "success")
    return True


def setup_database(skip: bool = False, init: bool = False, migrate: bool = False) -> bool:
    """Set up D1 database and apply migrations."""
    if skip:
        log("⏭️  Skipping database setup", "warn")
        return True
    
    root = get_project_root()
    
    log("📦 Checking D1 database...")
    result = run_cmd(["npx", "wrangler", "d1", "list"], cwd=root, check=False)
    
    if "vault-db" not in result.stdout:
        log("Creating database 'vault-db'...")
        run_cmd(["npx", "wrangler", "d1", "create", "vault-db"], cwd=root)
        log("⚠️  Update wrangler.toml with the new database_id!", "warn")
        return False
    
    if init:
        log("📦 Applying initial schema (FIRST TIME ONLY)...")
        run_cmd(["npx", "wrangler", "d1", "execute", "vault-db", 
                 "--file=db/migrations/001_initial_schema.sql", "--remote"], cwd=root)
        log("📦 Applying seed data...")
        run_cmd(["npx", "wrangler", "d1", "execute", "vault-db", 
                 "--file=db/migrations/002_seed_data.sql", "--remote"], cwd=root)
        log("✅ Database initialized", "success")
    elif migrate:
        log("📦 Applying migrations...")
        # Future: implement migration tracking
        log("⚠️  Migration tracking not implemented yet", "warn")
    else:
        log("⏭️  Database setup skipped (use --init-db for first time, --migrate for updates)", "warn")
    
    return True


def deploy() -> bool:
    """Deploy the vault-api Worker."""
    log(f"🚀 Deploying {WORKER_NAME}...")
    root = get_project_root()
    
    result = run_cmd(["npx", "wrangler", "deploy"], cwd=root, check=False)
    
    if result.returncode != 0:
        log(f"❌ Vault deploy failed", "error")
        print(result.stderr)
        return False
    
    log(f"✅ Vault deployed: {VAULT_URL}", "success")
    return True


def verify_deployment() -> bool:
    """Verify deployment is healthy."""
    log("🔍 Verifying deployment...")
    script = Path(__file__).parent / "verify.py"
    
    if script.exists():
        result = subprocess.run([sys.executable, str(script)])
        return result.returncode == 0
    else:
        log("⚠️  verify.py not found", "warn")
        return True


def main():
    parser = argparse.ArgumentParser(description="Vault API Deployment Script")
    parser.add_argument("--skip-db", action="store_true", help="Skip database setup entirely")
    parser.add_argument("--init-db", action="store_true", help="Initialize database (FIRST TIME ONLY - destroys data!)")
    parser.add_argument("--migrate", action="store_true", help="Apply database migrations")
    parser.add_argument("--skip-secrets", action="store_true", help="Skip secrets check")
    parser.add_argument("--skip-verify", action="store_true", help="Skip verification")
    args = parser.parse_args()
    
    print(f"\n{CYAN}{'='*50}{RESET}")
    print(f"{CYAN}🚀 Vault API Deployment Script{RESET}")
    print(f"{CYAN}{'='*50}{RESET}\n")
    
    # Step 1: Check secrets
    if not args.skip_secrets:
        if not check_secrets():
            log("❌ Fix secrets and retry", "error")
            sys.exit(1)
        print()
    
    # Step 2: Database setup
    if not args.skip_db:
        if not setup_database(skip=False, init=args.init_db, migrate=args.migrate):
            sys.exit(1)
        print()
    
    # Step 3: Deploy vault
    if not deploy():
        sys.exit(1)
    print()
    
    # Step 4: Verify
    if not args.skip_verify:
        if not verify_deployment():
            log("⚠️  Verification issues, check manually", "warn")
        print()
    
    # Done
    print(f"{GREEN}{'='*50}{RESET}")
    print(f"{GREEN}✅ Vault API deployment complete!{RESET}")
    print(f"{GREEN}{'='*50}{RESET}")
    print()
    print(f"   Vault API: {VAULT_URL}")
    print()
    print("Next steps:")
    print("   python scripts/tests/test_api.py")
    print("   npx wrangler tail tpb-vault-infra")
    print()


if __name__ == "__main__":
    main()

