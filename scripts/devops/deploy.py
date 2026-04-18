# entropy-single-export-ok: deploy internal pipeline steps called sequentially by main()
# entropy-duplicate-constant-ok: deploy is standalone CLI script, shared constants not warranted
# entropy-console-leak-ok: print() in deploy for operator terminal output
# entropy-python-optional-handling-ok: cwd parameter has default fallback in subprocess
#!/usr/bin/env python3
"""
deploy.py - LMS Full Deployment Script
Deploys backend API + frontend viewer to Cloudflare Workers

Usage:
    python scripts/devops/deploy.py              # Deploy all
    python scripts/devops/deploy.py --backend    # Backend only
    python scripts/devops/deploy.py --frontend   # Frontend only
    python scripts/devops/deploy.py --skip-db    # Skip database setup
    python scripts/devops/deploy.py --seed-courses  # Re-seed courses after deploy

One-liner (in Dev Container):
    cd 04.Execution/lms && python scripts/devops/deploy.py --frontend
"""

import argparse
import subprocess
import sys
from pathlib import Path

# Colors
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
RESET = "\033[0m"

# Configuration
BACKEND_WORKER = "lms-api"
FRONTEND_WORKER = "lms-viewer"
BACKEND_URL = "https://lms-api.matthieu-marielouise.workers.dev"
FRONTEND_URL = "https://lms-viewer.matthieu-marielouise.workers.dev"

_SUBPROCESS_TIMEOUT = 120  # entropy-python-magic-numbers-ok: numeric literal in deploy is a timeout duration in seconds
_CLI_SEPARATOR_WIDTH = 50  # entropy-python-magic-numbers-ok: display width constant in deploy for terminal formatting


def log(msg: str, level: str = "info") -> None:
    """Print colored log message.

    Args:
        msg: Message text to display.
        level: Log level (info, success, warn, error).
    """
    colors = {"info": CYAN, "success": GREEN, "warn": YELLOW, "error": RED}
    print(f"{colors.get(level, RESET)}{msg}{RESET}")


def run_cmd(cmd: list[str], cwd: Path | None = None, check: bool = True) -> subprocess.CompletedProcess[str]:  # entropy-python-optional-handling-ok: cwd=None is valid for subprocess
    """Run a command with error handling.

    Args:
        cmd: Command and arguments list.
        cwd: Working directory for the subprocess.
        check: If True, exit on non-zero return code.

    Returns:
        Completed process result.
    """
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd, timeout=_SUBPROCESS_TIMEOUT)
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
    """Get the LMS project root directory."""
    return Path(__file__).parent.parent.parent


def check_secrets() -> bool:
    """Run secrets check script."""
    log("🔐 Checking secrets...")
    script = Path(__file__).parent / "check_secrets.py"
    result = subprocess.run([sys.executable, str(script)], capture_output=False)
    return result.returncode == 0


def setup_database(skip: bool = False) -> bool:
    """Set up D1 database and apply schema.

    Args:
        skip: If True, skip database setup entirely.

    Returns:
        True if database is ready.
    """
    if skip:
        log("⏭️  Skipping database setup", "warn")
        return True
    
    root = get_project_root()
    
    log("📦 Checking D1 database...")
    result = run_cmd(["npx", "wrangler", "d1", "list"], cwd=root, check=False)
    
    if "lms-db" not in result.stdout:
        log("Creating database 'lms-db'...")
        run_cmd(["npx", "wrangler", "d1", "create", "lms-db"], cwd=root)
        log("⚠️  Update wrangler.toml with the new database_id!", "warn")
        return False
    
    log("📦 Applying schema...")
    run_cmd(["npx", "wrangler", "d1", "execute", "lms-db", 
             "--file=db/schema.sql", "--remote"], cwd=root)
    log("✅ Schema applied", "success")
    return True


def deploy_backend() -> bool:
    """Deploy the backend Worker API."""
    log(f"🚀 Deploying {BACKEND_WORKER}...")
    root = get_project_root()
    
    result = run_cmd(["npx", "wrangler", "deploy"], cwd=root, check=False)
    
    if result.returncode != 0:
        log(f"❌ Backend deploy failed", "error")
        print(result.stderr)
        return False
    
    log(f"✅ Backend deployed: {BACKEND_URL}", "success")
    return True


def deploy_frontend() -> bool:
    """Deploy the frontend Worker with auth token endpoint.
    
    Uses frontend/wrangler.toml for configuration (not inline args).
    The frontend Worker includes:
    - /__auth/token endpoint to expose JWT to JS
    - Static asset serving
    """
    log(f"🚀 Deploying {FRONTEND_WORKER}...")
    root = get_project_root()
    frontend_dir = root / "frontend"
    
    if not frontend_dir.exists():
        log(f"❌ Frontend directory not found: {frontend_dir}", "error")
        return False
    
    wrangler_toml = frontend_dir / "wrangler.toml"
    if not wrangler_toml.exists():
        log(f"❌ frontend/wrangler.toml not found", "error")
        return False
    
    # Deploy using the frontend wrangler.toml config
    result = run_cmd([
        "npx", "wrangler", "deploy",
        "-c", str(wrangler_toml)
    ], cwd=frontend_dir, check=False)
    
    if result.returncode != 0:
        log(f"❌ Frontend deploy failed", "error")
        print(result.stderr)
        return False
    
    log(f"✅ Frontend deployed: {FRONTEND_URL}", "success")
    return True


def verify_deployment() -> bool:
    """Verify both deployments are healthy."""
    log("🔍 Verifying deployments...")
    script = Path(__file__).parent / "verify_deploy.py"
    
    if script.exists():
        result = subprocess.run([sys.executable, str(script)])
        return result.returncode == 0
    else:
        log("⚠️  verify_deploy.py not found", "warn")
        return True


def seed_courses() -> bool:
    """Re-seed courses after deploy."""
    log("🌱 Seeding courses...")
    root = get_project_root()
    seed_script = root / "scripts" / "seed_courses.py"
    
    if seed_script.exists():
        result = subprocess.run([sys.executable, str(seed_script)], cwd=root)
        if result.returncode == 0:
            log("✅ Courses seeded", "success")
            return True
        else:
            log("⚠️  Course seeding failed", "warn")
            return False
    else:
        log("⚠️  seed_courses.py not found", "warn")
        return False


def main() -> None:  # entropy-python-long-function-ok + entropy-python-complexity-ok: long function in deploy is linear CLI script flow
    """ Deploy LMS backend and frontend to Cloudflare Workers."""
    parser = argparse.ArgumentParser(description="LMS Deployment Script")
    parser.add_argument("--backend", action="store_true", help="Deploy backend only")
    parser.add_argument("--frontend", action="store_true", help="Deploy frontend only")
    parser.add_argument("--skip-db", action="store_true", help="Skip database setup")
    parser.add_argument("--skip-secrets", action="store_true", help="Skip secrets check")
    parser.add_argument("--skip-verify", action="store_true", help="Skip verification")
    parser.add_argument("--seed-courses", action="store_true", help="Re-seed courses")
    args = parser.parse_args()
    
    # Default: deploy both if neither specified
    deploy_both = not args.backend and not args.frontend
    
    print(f"\n{CYAN}{'=' * _CLI_SEPARATOR_WIDTH}{RESET}")
    print(f"{CYAN}🚀 LMS Deployment Script{RESET}")
    print(f"{CYAN}{'='*50}{RESET}\n")  # entropy-python-magic-numbers-ok: display width constant in deploy for terminal formatting
    
    # Step 1: Check secrets
    if not args.skip_secrets:
        if not check_secrets():
            log("❌ Fix secrets and retry", "error")
            sys.exit(1)
        print()
    
    # Step 2: Database setup (only for backend)
    if (deploy_both or args.backend) and not args.skip_db:
        if not setup_database():
            sys.exit(1)
        print()
    
    # Step 3: Deploy backend
    if deploy_both or args.backend:
        if not deploy_backend():
            sys.exit(1)
        print()
    
    # Step 4: Deploy frontend
    if deploy_both or args.frontend:
        if not deploy_frontend():
            sys.exit(1)
        print()
    
    # Step 5: Verify
    if not args.skip_verify:
        if not verify_deployment():
            log("⚠️  Verification issues, check manually", "warn")
        print()
    
    # Step 6: Seed courses (optional)
    if args.seed_courses:
        seed_courses()
        print()
    
    # Done
    print(f"{GREEN}{'=' * _CLI_SEPARATOR_WIDTH}{RESET}")
    print(f"{GREEN}✅ Deployment complete!{RESET}")
    print(f"{GREEN}{'=' * _CLI_SEPARATOR_WIDTH}{RESET}")
    print()
    print(f"   Backend:  {BACKEND_URL}")
    print(f"   Frontend: {FRONTEND_URL}")
    print()
    print("Next steps:")
    print("   python scripts/tests/test_api.py --prod")
    print("   npx wrangler tail lms-api")
    print()


if __name__ == "__main__":
    main()
