#!/usr/bin/env python3
"""
check_health.py - Quick health check for vault-api

A simple script to check if vault-api is online and healthy.
Can be used in CI/CD pipelines or monitoring.

Usage:
    python scripts/devops/check_health.py              # Basic health check
    python scripts/devops/check_health.py --verbose    # Include stats
    python scripts/devops/check_health.py --json       # JSON output

Exit codes:
    0 = Healthy
    1 = Unhealthy or error

One-liner (from vault-api root):
    cd tpb_system/04.Execution/lms/core/vault-api && python scripts/devops/check_health.py
"""

import argparse
import json
import sys
import urllib.request
import urllib.error
import ssl

# Configuration
VAULT_URL = "https://tpb-vault-infra.matthieu-marielouise.workers.dev"

# Colors
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


def check_health(verbose: bool = False, json_output: bool = False) -> dict:
    """Check vault-api health endpoint."""
    url = f"{VAULT_URL}/health"
    
    try:
        ctx = ssl.create_default_context()
        req = urllib.request.Request(url, headers={"User-Agent": "Vault-Health-Check"})
        
        with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
            data = json.loads(resp.read().decode())
            
            result = {
                "url": url,
                "status": data.get("status", "unknown"),
                "service": data.get("service", "unknown"),
                "healthy": data.get("status") == "healthy",
                "stats": data.get("stats", {})
            }
            
            return result
            
    except urllib.error.HTTPError as e:
        return {
            "url": url,
            "status": "error",
            "healthy": False,
            "error": f"HTTP {e.code}",
            "stats": {}
        }
    except urllib.error.URLError as e:
        return {
            "url": url,
            "status": "error",
            "healthy": False,
            "error": str(e.reason),
            "stats": {}
        }
    except Exception as e:
        return {
            "url": url,
            "status": "error",
            "healthy": False,
            "error": str(e),
            "stats": {}
        }


def main():
    parser = argparse.ArgumentParser(description="Check vault-api health")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show detailed stats")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--quiet", "-q", action="store_true", help="Only exit code, no output")
    args = parser.parse_args()
    
    result = check_health(verbose=args.verbose)
    
    # JSON output mode
    if args.json:
        print(json.dumps(result, indent=2))
        sys.exit(0 if result["healthy"] else 1)
    
    # Quiet mode
    if args.quiet:
        sys.exit(0 if result["healthy"] else 1)
    
    # Normal output
    print(f"\n{BOLD}{CYAN}🔍 Vault API Health Check{RESET}\n")
    print(f"   URL: {result['url']}")
    
    if result["healthy"]:
        print(f"   Status: {GREEN}✅ {result['status']}{RESET}")
        print(f"   Service: {result['service']}")
        
        if args.verbose and result.get("stats"):
            stats = result["stats"]
            print()
            print(f"   {BOLD}Stats:{RESET}")
            print(f"      Connections: {stats.get('connections', 'N/A')}")
            print(f"      Secret refs: {stats.get('secrets', 'N/A')}")
            print(f"      Users: {stats.get('users', 'N/A')}")
            print(f"      Groups: {stats.get('groups', 'N/A')}")
            print(f"      Applications: {stats.get('applications', 'N/A')}")
    else:
        print(f"   Status: {RED}❌ {result.get('error', 'unhealthy')}{RESET}")
    
    print()
    sys.exit(0 if result["healthy"] else 1)


if __name__ == "__main__":
    main()

