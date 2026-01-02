#!/usr/bin/env python3
"""
check_secrets.py - Verify required Cloudflare Worker secrets

Checks that all required secrets are configured in the Worker before deployment.
Uses `wrangler secret list` to verify without exposing values.

Usage:
    python scripts/devops/check_secrets.py
    python scripts/devops/check_secrets.py --verbose
    python scripts/devops/check_secrets.py --worker lms-api

One-liner (in Dev Container):
    cd 04.Execution/lms && python scripts/devops/check_secrets.py

Exit codes:
    0 - All required secrets present
    1 - Missing required secrets
    2 - Error running wrangler
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Set, Optional

# Colors
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
DIM = "\033[2m"
RESET = "\033[0m"

# =============================================================================
# SECRETS CONFIGURATION
# =============================================================================

# Required secrets - deployment fails if missing
REQUIRED_SECRETS = {
    "TALLY_WEBHOOK_SECRET": "Tally webhook authentication (legacy URL param)",
    "TEST_SECRET": "Test fixtures API authentication",
}

# Recommended secrets - warning if missing
RECOMMENDED_SECRETS = {
    "TALLY_SIGNING_SECRET": "Tally HMAC-SHA256 signature verification (preferred over webhook secret)",
}

# Optional secrets - just informational
OPTIONAL_SECRETS = {
    "CLOUDFLARE_ACCOUNT_ID": "For Cloudflare API operations",
    "CLOUDFLARE_API_TOKEN": "For Cloudflare deployments",
    "CF_ACCESS_CLIENT_ID": "Service token for API access",
    "CF_ACCESS_CLIENT_SECRET": "Service token secret",
    "OPENAI_API_KEY": "For AI features",
    "TALLY_API_KEY": "Tally API access",
    "UNIFIEDTO_API_TOKEN": "Unified.to integration",
    "UNIFIEDTO_CONNECTION_ID": "Unified.to connection",
    "UNIFIEDTO_WORKSPACE_ID": "Unified.to workspace",
    "UNIFIEDTO_WORKSPACE_SECRET": "Unified.to workspace secret",
    "MODAL_TOKEN_ID": "Modal.com token",
    "MODAL_TOKEN_SECRET": "Modal.com secret",
    "USER_TRIGRAM": "User identification",
    "MHO_CALENDAR_EMAIL": "Calendar integration",
}


# =============================================================================
# HELPERS
# =============================================================================

def log(msg: str, level: str = "info"):
    """Print colored log message."""
    colors = {"info": CYAN, "success": GREEN, "warn": YELLOW, "error": RED, "dim": DIM}
    print(f"{colors.get(level, RESET)}{msg}{RESET}")


def get_project_root() -> Path:
    """Get the LMS project root directory."""
    return Path(__file__).parent.parent.parent


def get_configured_secrets(worker_name: Optional[str] = None) -> Set[str]:
    """
    Get list of configured secrets from Cloudflare Worker using wrangler.
    
    Returns:
        Set of secret names currently configured in the worker.
    """
    root = get_project_root()
    
    cmd = ["npx", "wrangler", "secret", "list"]
    if worker_name:
        cmd.extend(["--name", worker_name])
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=root,
            timeout=30
        )
        
        if result.returncode != 0:
            if "not authenticated" in result.stderr.lower():
                log("❌ Not authenticated with Cloudflare. Run: wrangler login", "error")
            elif "could not find" in result.stderr.lower():
                log(f"❌ Worker not found. Deploy first or check worker name.", "error")
            else:
                log(f"❌ Wrangler error: {result.stderr}", "error")
            return set()
        
        # Parse JSON output
        secrets = json.loads(result.stdout)
        return {s["name"] for s in secrets}
        
    except json.JSONDecodeError as e:
        log(f"❌ Failed to parse wrangler output: {e}", "error")
        return set()
    except subprocess.TimeoutExpired:
        log("❌ Wrangler command timed out", "error")
        return set()
    except FileNotFoundError:
        log("❌ npx/wrangler not found. Install with: npm install -g wrangler", "error")
        return set()


# =============================================================================
# MAIN
# =============================================================================

def check_secrets(worker_name: Optional[str] = None, verbose: bool = False) -> bool:
    """
    Check that all required secrets are configured.
    
    Args:
        worker_name: Optional worker name (uses wrangler.toml default if not specified)
        verbose: Show optional secrets status
        
    Returns:
        True if all required secrets are present
    """
    print(f"\n{CYAN}{'='*50}{RESET}")
    print(f"{CYAN}🔐 LMS Secrets Check{RESET}")
    print(f"{CYAN}{'='*50}{RESET}\n")
    
    # Get configured secrets
    log("Fetching configured secrets from Cloudflare...")
    configured = get_configured_secrets(worker_name)
    
    if not configured:
        log("❌ Could not retrieve secrets list", "error")
        return False
    
    log(f"Found {len(configured)} secrets configured\n", "success")
    
    # Check required secrets
    print(f"{CYAN}📋 Required secrets:{RESET}")
    missing_required = []
    for secret, description in REQUIRED_SECRETS.items():
        if secret in configured:
            print(f"   {GREEN}✅ {secret}{RESET}")
        else:
            print(f"   {RED}❌ {secret} - {description}{RESET}")
            missing_required.append(secret)
    
    # Check recommended secrets
    print(f"\n{CYAN}📋 Recommended secrets:{RESET}")
    missing_recommended = []
    for secret, description in RECOMMENDED_SECRETS.items():
        if secret in configured:
            print(f"   {GREEN}✅ {secret}{RESET}")
        else:
            print(f"   {YELLOW}⚠️  {secret} - {description}{RESET}")
            missing_recommended.append(secret)
    
    # Check optional secrets (verbose only)
    if verbose:
        print(f"\n{CYAN}📋 Optional secrets:{RESET}")
        for secret, description in OPTIONAL_SECRETS.items():
            if secret in configured:
                print(f"   {GREEN}✅ {secret}{RESET}")
            else:
                print(f"   {DIM}○  {secret} - {description}{RESET}")
    
    # Summary
    print()
    if missing_required:
        log(f"❌ Missing {len(missing_required)} required secret(s)", "error")
        print()
        print("To fix, run:")
        for secret in missing_required:
            print(f"   wrangler secret put {secret}")
        print()
        return False
    
    if missing_recommended:
        log(f"⚠️  Missing {len(missing_recommended)} recommended secret(s) (non-blocking)", "warn")
    
    log("✅ All required secrets configured", "success")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Check Cloudflare Worker secrets configuration",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python check_secrets.py              # Check default worker
    python check_secrets.py --verbose    # Show optional secrets too
    python check_secrets.py --worker lms-api-staging  # Check staging

Required secrets:
    TALLY_WEBHOOK_SECRET  - Tally webhook authentication
    TEST_SECRET           - Test fixtures API

To set a secret:
    wrangler secret put SECRET_NAME
        """
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show optional secrets status"
    )
    parser.add_argument(
        "--worker", "-w",
        help="Worker name (uses wrangler.toml default if not specified)"
    )
    args = parser.parse_args()
    
    success = check_secrets(
        worker_name=args.worker,
        verbose=args.verbose
    )
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

