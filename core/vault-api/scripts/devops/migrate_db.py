#!/usr/bin/env python3
"""
migrate_db.py - Apply D1 database migrations for vault-api

Tracks applied migrations and applies new ones safely.
Supports both local and remote (production) databases.

Usage:
    python scripts/devops/migrate_db.py                  # Apply pending migrations (remote)
    python scripts/devops/migrate_db.py --local          # Apply to local DB
    python scripts/devops/migrate_db.py --status         # Show migration status
    python scripts/devops/migrate_db.py --force 005      # Force re-apply specific migration

One-liner (from vault-api root):
    cd tpb_system/04.Execution/lms/core/vault-api && python scripts/devops/migrate_db.py
"""

import argparse
import subprocess
import sys
import re
from pathlib import Path
from datetime import datetime

# Colors
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"

# Configuration
DB_NAME = "vault-db"
MIGRATIONS_DIR = "db/migrations"


def log(msg: str, level: str = "info"):
    """Print colored log message."""
    colors = {"info": CYAN, "success": GREEN, "warn": YELLOW, "error": RED}
    print(f"{colors.get(level, RESET)}{msg}{RESET}")


def run_wrangler(args: list, cwd: Path, remote: bool = True) -> tuple[bool, str]:
    """Run wrangler command and return success status and output."""
    cmd = ["npx", "wrangler", "d1", *args]
    if remote:
        cmd.append("--remote")
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd, timeout=120)
        return result.returncode == 0, result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return False, "Command timed out"
    except FileNotFoundError:
        return False, "wrangler not found"


def get_project_root() -> Path:
    """Get the vault-api project root directory."""
    return Path(__file__).parent.parent.parent


def get_migration_files() -> list:
    """Get list of migration files sorted by number."""
    root = get_project_root()
    migrations_path = root / MIGRATIONS_DIR
    
    if not migrations_path.exists():
        return []
    
    files = []
    for f in migrations_path.glob("*.sql"):
        # Extract migration number (e.g., 001 from 001_initial_schema.sql)
        match = re.match(r'^(\d+)_(.+)\.sql$', f.name)
        if match:
            num = int(match.group(1))
            name = match.group(2)
            files.append({
                "number": num,
                "name": name,
                "filename": f.name,
                "path": f
            })
    
    return sorted(files, key=lambda x: x["number"])


def get_applied_migrations(root: Path, remote: bool = True) -> set:
    """Get set of already applied migration numbers."""
    # Try to query the migrations tracking table
    success, output = run_wrangler(
        ["execute", DB_NAME, "--command", 
         "SELECT migration_number FROM _migrations ORDER BY migration_number"],
        cwd=root,
        remote=remote
    )
    
    if not success or "no such table: _migrations" in output.lower():
        # Table doesn't exist, need to create it
        return set()
    
    # Parse output to extract migration numbers
    applied = set()
    # Look for numbers in the output (wrangler outputs JSON-like structure)
    for match in re.finditer(r'"migration_number":\s*(\d+)', output):
        applied.add(int(match.group(1)))
    
    return applied


def ensure_migrations_table(root: Path, remote: bool = True) -> bool:
    """Ensure the migrations tracking table exists."""
    create_sql = """
    CREATE TABLE IF NOT EXISTS _migrations (
        migration_number INTEGER PRIMARY KEY,
        migration_name TEXT NOT NULL,
        applied_at TEXT DEFAULT (datetime('now'))
    );
    """
    
    success, output = run_wrangler(
        ["execute", DB_NAME, "--command", create_sql],
        cwd=root,
        remote=remote
    )
    
    return success


def apply_migration(root: Path, migration: dict, remote: bool = True) -> bool:
    """Apply a single migration."""
    filename = migration["filename"]
    number = migration["number"]
    name = migration["name"]
    
    log(f"   📄 Applying: {filename}")
    
    # Read and execute migration file
    success, output = run_wrangler(
        ["execute", DB_NAME, f"--file={MIGRATIONS_DIR}/{filename}"],
        cwd=root,
        remote=remote
    )
    
    if not success:
        log(f"      ❌ Failed: {output[:200]}", "error")
        return False
    
    # Record migration as applied
    record_sql = f"INSERT INTO _migrations (migration_number, migration_name) VALUES ({number}, '{name}')"
    success, _ = run_wrangler(
        ["execute", DB_NAME, "--command", record_sql],
        cwd=root,
        remote=remote
    )
    
    if success:
        log(f"      ✅ Applied successfully", "success")
    else:
        log(f"      ⚠️  Applied but failed to record", "warn")
    
    return success


def show_status(root: Path, remote: bool = True):
    """Show migration status."""
    migrations = get_migration_files()
    applied = get_applied_migrations(root, remote)
    
    env = "remote (production)" if remote else "local"
    print(f"\n{BOLD}Migration Status ({env}){RESET}\n")
    
    if not migrations:
        log("   No migration files found", "warn")
        return
    
    for m in migrations:
        status = f"{GREEN}✓ Applied{RESET}" if m["number"] in applied else f"{YELLOW}○ Pending{RESET}"
        print(f"   {m['number']:03d} | {status} | {m['name']}")
    
    pending = [m for m in migrations if m["number"] not in applied]
    print()
    print(f"   Total: {len(migrations)} | Applied: {len(applied)} | Pending: {len(pending)}")


def main():
    parser = argparse.ArgumentParser(description="Apply D1 database migrations")
    parser.add_argument("--local", action="store_true", help="Apply to local database instead of remote")
    parser.add_argument("--status", action="store_true", help="Show migration status only")
    parser.add_argument("--force", help="Force re-apply specific migration number")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be applied")
    args = parser.parse_args()
    
    remote = not args.local
    env_name = "REMOTE (Production)" if remote else "LOCAL"
    
    print(f"\n{BOLD}{CYAN}{'='*60}{RESET}")
    print(f"{BOLD}{CYAN}📦 Vault API - Database Migrations{RESET}")
    print(f"{BOLD}{CYAN}{'='*60}{RESET}")
    print(f"   Environment: {env_name}")
    print()
    
    root = get_project_root()
    
    # Status mode
    if args.status:
        show_status(root, remote)
        print()
        return
    
    # Get migrations
    migrations = get_migration_files()
    if not migrations:
        log("❌ No migration files found in db/migrations/", "error")
        sys.exit(1)
    
    log(f"📁 Found {len(migrations)} migration files", "info")
    
    # Ensure migrations table exists
    log("🔧 Ensuring migrations table exists...")
    if not ensure_migrations_table(root, remote):
        log("   ❌ Failed to create migrations table", "error")
        sys.exit(1)
    log("   ✅ Migrations table ready", "success")
    
    # Get applied migrations
    applied = get_applied_migrations(root, remote)
    log(f"📊 Already applied: {len(applied)} migrations", "info")
    
    # Determine pending migrations
    if args.force:
        # Force mode: re-apply specific migration
        force_num = int(args.force)
        pending = [m for m in migrations if m["number"] == force_num]
        if not pending:
            log(f"❌ Migration {force_num} not found", "error")
            sys.exit(1)
        log(f"⚠️  Force re-applying migration {force_num}", "warn")
    else:
        # Normal mode: only pending migrations
        pending = [m for m in migrations if m["number"] not in applied]
    
    if not pending:
        log("✅ All migrations already applied!", "success")
        print()
        show_status(root, remote)
        print()
        return
    
    log(f"📋 Pending migrations: {len(pending)}", "info")
    for m in pending:
        print(f"      - {m['filename']}")
    
    print()
    
    # Dry run mode
    if args.dry_run:
        log("🔍 Dry run - no changes made", "info")
        print()
        return
    
    # Confirm for remote
    if remote and not args.force:
        log("⚠️  About to apply migrations to PRODUCTION database", "warn")
        confirm = input("   Continue? [y/N]: ")
        if confirm.lower() != 'y':
            log("   Aborted", "warn")
            return
    
    # Apply pending migrations
    print()
    log("🚀 Applying migrations...", "info")
    
    success_count = 0
    error_count = 0
    
    for m in pending:
        if apply_migration(root, m, remote):
            success_count += 1
        else:
            error_count += 1
            if not args.force:
                log("   ⛔ Stopping due to error", "error")
                break
    
    # Summary
    print()
    print(f"{BOLD}{'='*60}{RESET}")
    print(f"{BOLD}📊 Summary{RESET}")
    print(f"{'='*60}")
    print(f"   Applied: {success_count}")
    if error_count > 0:
        print(f"   {RED}Errors: {error_count}{RESET}")
    print()
    
    if error_count > 0:
        log("❌ Migration completed with errors", "error")
        sys.exit(1)
    else:
        log("✅ All migrations applied successfully", "success")
    
    print()
    show_status(root, remote)
    print()


if __name__ == "__main__":
    main()

