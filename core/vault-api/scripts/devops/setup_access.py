#!/usr/bin/env python3
"""
setup_access.py - Configure Cloudflare Access for vault-api

Creates bypass apps for public routes (/, /health) while keeping
protected routes (/dashboard, /iam/*, /vault/*) behind CF Access.

Usage:
    python scripts/devops/setup_access.py

One-liner (from vault-api root):
    cd tpb_system/04.Execution/lms/core/vault-api && python scripts/devops/setup_access.py
"""

import sys
from pathlib import Path

# Add paths for imports
VAULT_API_ROOT = Path(__file__).parent.parent.parent
LMS_ROOT = VAULT_API_ROOT.parent.parent
EXECUTION_ROOT = LMS_ROOT.parent
sys.path.insert(0, str(EXECUTION_ROOT))

from vault_client import VaultClient

try:
    import httpx
except ImportError:
    print("ERROR: httpx not installed. Run: pip install httpx")
    sys.exit(1)

# Configuration
VAULT_DOMAIN = "tpb-vault-infra.matthieu-marielouise.workers.dev"
MAIN_APP_NAME = "tpb-vault-infra"

# Bypass apps to create
BYPASS_APPS = [
    {
        "name": "tpb-vault-infra-bypass-root",
        "path": "/",
        "description": "Landing page (public)"
    },
    {
        "name": "tpb-vault-infra-bypass-health",
        "path": "/health",
        "description": "Health endpoint (public)"
    }
]

# Colors
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


class CloudflareAccess:
    """Cloudflare Access API client."""
    
    def __init__(self, account_id: str, api_token: str):
        self.account_id = account_id
        self.api_token = api_token
        self.base_url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/access"
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }
    
    def _request(self, method: str, endpoint: str, data: dict = None) -> dict:
        """Make API request."""
        url = f"{self.base_url}/{endpoint}"
        
        resp = httpx.request(
            method, url,
            headers=self.headers,
            json=data,
            timeout=30
        )
        
        result = resp.json()
        
        if not result.get("success", False):
            errors = result.get("errors", [])
            error_msg = errors[0].get("message") if errors else "Unknown error"
            raise Exception(f"API Error: {error_msg}")
        
        return result
    
    def list_apps(self) -> list:
        """List all Access applications."""
        result = self._request("GET", "apps")
        return result.get("result", [])
    
    def get_app(self, name: str) -> dict:
        """Get app by name."""
        apps = self.list_apps()
        for app in apps:
            if app.get("name") == name:
                return app
        return None
    
    def create_app(self, name: str, domain: str) -> dict:
        """Create a new Access application."""
        data = {
            "name": name,
            "domain": domain,
            "type": "self_hosted",
            "session_duration": "24h"
        }
        result = self._request("POST", "apps", data)
        return result.get("result", {})
    
    def list_policies(self, app_id: str) -> list:
        """List policies for an application."""
        result = self._request("GET", f"apps/{app_id}/policies")
        return result.get("result", [])
    
    def add_bypass_policy(self, app_id: str, name: str = "bypass-all") -> dict:
        """Add a bypass policy (public access)."""
        policies = self.list_policies(app_id)
        
        # Check if bypass already exists
        for p in policies:
            if p.get("decision") == "bypass":
                return p
        
        precedence = len(policies) + 1
        
        data = {
            "name": name,
            "decision": "bypass",
            "precedence": precedence,
            "include": [{"everyone": {}}]
        }
        
        result = self._request("POST", f"apps/{app_id}/policies", data)
        return result.get("result", {})


def main():
    print(f"\n{BOLD}{CYAN}{'='*60}{RESET}")
    print(f"{BOLD}{CYAN}🔧 Vault API - Cloudflare Access Setup{RESET}")
    print(f"{BOLD}{CYAN}{'='*60}{RESET}")
    print(f"   Domain: {VAULT_DOMAIN}\n")
    
    # Get credentials from vault
    print(f"{CYAN}📦 Getting credentials from vault...{RESET}")
    try:
        vault = VaultClient.from_devcontainer()
        account_id = vault.get_secret("infra/cloudflare_account_id")
        api_token = vault.get_secret("infra/cloudflare_api_token")
        
        if not account_id or not api_token:
            print(f"{RED}❌ Missing infra/cloudflare_account_id or infra/cloudflare_api_token{RESET}")
            sys.exit(1)
        
        print(f"{GREEN}   ✅ Credentials loaded{RESET}")
    except Exception as e:
        print(f"{RED}❌ Failed to get credentials: {e}{RESET}")
        sys.exit(1)
    
    # Initialize CF Access client
    cf = CloudflareAccess(account_id, api_token)
    
    # Check main app exists
    print(f"\n{CYAN}🔍 Checking main Access app...{RESET}")
    main_app = cf.get_app(MAIN_APP_NAME)
    if not main_app:
        print(f"{RED}❌ Main app '{MAIN_APP_NAME}' not found!{RESET}")
        print(f"   Create it first with: python manage_access.py create-app {MAIN_APP_NAME} {VAULT_DOMAIN}")
        sys.exit(1)
    print(f"{GREEN}   ✅ {MAIN_APP_NAME} exists{RESET}")
    
    # Create/verify bypass apps
    print(f"\n{CYAN}🔧 Setting up bypass apps...{RESET}")
    
    for bypass in BYPASS_APPS:
        name = bypass["name"]
        path = bypass["path"]
        desc = bypass["description"]
        domain = f"{VAULT_DOMAIN}{path}"
        
        print(f"\n   {CYAN}→ {name} ({desc}){RESET}")
        
        # Check if exists
        existing = cf.get_app(name)
        
        if existing:
            print(f"     {GREEN}✅ App exists{RESET}")
            app_id = existing["id"]
        else:
            # Create app
            print(f"     Creating app for {domain}...")
            try:
                app = cf.create_app(name, domain)
                app_id = app["id"]
                print(f"     {GREEN}✅ App created{RESET}")
            except Exception as e:
                print(f"     {RED}❌ Failed to create: {e}{RESET}")
                continue
        
        # Add bypass policy
        print(f"     Adding bypass policy...")
        try:
            policy = cf.add_bypass_policy(app_id)
            if policy.get("decision") == "bypass":
                print(f"     {GREEN}✅ Bypass policy active{RESET}")
            else:
                print(f"     {YELLOW}⚠️  Policy exists but may not be bypass{RESET}")
        except Exception as e:
            print(f"     {RED}❌ Failed to add policy: {e}{RESET}")
    
    # Summary
    print(f"\n{BOLD}{'='*60}{RESET}")
    print(f"{BOLD}📊 Summary{RESET}")
    print(f"{'='*60}")
    print(f"   Main app: {MAIN_APP_NAME}")
    print(f"   Bypass apps configured:")
    for bypass in BYPASS_APPS:
        print(f"     - {bypass['path']} → {bypass['name']}")
    
    print(f"\n{GREEN}{BOLD}✅ Setup complete!{RESET}")
    print(f"\nVerify with: python scripts/devops/verify.py")
    print(f"Test in browser: https://{VAULT_DOMAIN}/")


if __name__ == "__main__":
    main()

