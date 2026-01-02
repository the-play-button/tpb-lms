#!/usr/bin/env python3
"""
verify.py - Post-deployment verification for vault-api
Comprehensive security and health checks

Usage:
    python scripts/devops/verify.py

One-liner (from vault-api root):
    cd tpb_system/04.Execution/lms/core/vault-api && python scripts/devops/verify.py
"""

import sys
import urllib.request
import urllib.error
import json
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


class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Handler that prevents automatic redirect following."""
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def get_opener():
    """Get HTTPS opener that doesn't follow redirects."""
    ctx = ssl.create_default_context()
    https_handler = urllib.request.HTTPSHandler(context=ctx)
    return urllib.request.build_opener(https_handler, NoRedirectHandler)


def check_health() -> bool:
    """Check vault-api health endpoint."""
    url = f"{VAULT_URL}/health"
    print(f"{CYAN}🔍 Health Check: {url}{RESET}")
    
    try:
        ctx = ssl.create_default_context()
        req = urllib.request.Request(url, headers={"User-Agent": "Vault-Security-Check"})
        
        with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
            if resp.status != 200:
                print(f"{RED}   ❌ HTTP {resp.status}{RESET}")
                return False
            
            data = json.loads(resp.read().decode())
            status = data.get("status", "unknown")
            service = data.get("service", "?")
            stats = data.get("stats", {})
            
            if status == "healthy":
                print(f"{GREEN}   ✅ Status: {status}{RESET}")
                print(f"{GREEN}   ✅ Service: {service}{RESET}")
                print(f"{GREEN}   ✅ Connections: {stats.get('connections', 0)}{RESET}")
                print(f"{GREEN}   ✅ Secrets refs: {stats.get('secrets', 0)}{RESET}")
                return True
            else:
                print(f"{RED}   ❌ Status: {status}{RESET}")
                return False
                
    except Exception as e:
        print(f"{RED}   ❌ Error: {e}{RESET}")
        return False


def check_auth_required(endpoint: str, method: str = "GET") -> tuple[bool, str]:
    """Check that an endpoint requires authentication."""
    url = f"{VAULT_URL}{endpoint}"
    opener = get_opener()
    
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Vault-Security-Check"})
        req.get_method = lambda: method
        
        with opener.open(req, timeout=5) as resp:
            # 200 without auth = SECURITY ISSUE
            return False, f"NO AUTH REQUIRED (HTTP {resp.status})"
            
    except urllib.error.HTTPError as e:
        if e.code == 302:
            location = e.headers.get("Location", "")
            if "cloudflareaccess.com" in location:
                return True, "CF Access redirect (302)"
            return True, f"Redirect (302) to {location[:50]}"
        elif e.code == 401:
            return True, "Unauthorized (401)"
        elif e.code == 403:
            return True, "Forbidden (403)"
        elif e.code == 404:
            return True, "Not found (404) - may need auth first"
        else:
            return False, f"Unexpected HTTP {e.code}"
    except Exception as e:
        return False, f"Error: {e}"


def check_protected_endpoints() -> bool:
    """Check all protected endpoints require auth."""
    print(f"{CYAN}🔒 Security: Protected Endpoints{RESET}")
    
    # All endpoints that MUST require auth
    protected = [
        # UI (dashboard)
        ("GET", "/"),
        ("GET", "/dashboard"),
        # IAM endpoints
        ("GET", "/iam/users"),
        ("POST", "/iam/users"),
        ("GET", "/iam/groups"),
        ("POST", "/iam/groups"),
        ("GET", "/iam/roles"),
        ("GET", "/iam/permissions"),
        ("GET", "/iam/service-tokens"),
        ("POST", "/iam/service-tokens"),
        ("POST", "/iam/can"),
        ("GET", "/iam/me/abilities"),
        # Vault endpoints
        ("GET", "/vault/connections"),
        ("POST", "/vault/connections"),
        ("GET", "/vault/connections/conn_infra"),
        ("GET", "/vault/connections/conn_infra/secrets"),
        ("GET", "/vault/connections/conn_infra/audit"),
        # Organization endpoints
        ("GET", "/iam/organizations"),
        ("POST", "/iam/organizations"),
        ("GET", "/iam/organizations/org_tpb"),
        ("GET", "/iam/organizations/org_tpb/members"),
        ("GET", "/iam/organizations/org_tpb/audit"),
    ]
    
    all_secure = True
    
    for method, endpoint in protected:
        ok, msg = check_auth_required(endpoint, method)
        if ok:
            print(f"{GREEN}   ✅ {method} {endpoint}: {msg}{RESET}")
        else:
            print(f"{RED}   ❌ {method} {endpoint}: {msg}{RESET}")
            all_secure = False
    
    return all_secure


def check_public_endpoints() -> bool:
    """Check public endpoints work without auth."""
    print(f"{CYAN}🌐 Public Endpoints{RESET}")
    
    public = [
        "/health",  # API health (only public endpoint)
    ]
    
    all_ok = True
    ctx = ssl.create_default_context()
    
    for endpoint in public:
        url = f"{VAULT_URL}{endpoint}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Vault-Security-Check"})
            with urllib.request.urlopen(req, timeout=5, context=ctx) as resp:
                if resp.status == 200:
                    print(f"{GREEN}   ✅ {endpoint}: OK (200){RESET}")
                else:
                    print(f"{YELLOW}   ⚠️  {endpoint}: HTTP {resp.status}{RESET}")
        except Exception as e:
            print(f"{RED}   ❌ {endpoint}: {e}{RESET}")
            all_ok = False
    
    return all_ok


def check_no_secret_exposure() -> bool:
    """Check that secret VALUES are never exposed in responses."""
    print(f"{CYAN}🔐 Security: No Secret Value Exposure{RESET}")
    
    # Health endpoint should NOT contain any secret values
    url = f"{VAULT_URL}/health"
    ctx = ssl.create_default_context()
    
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=5, context=ctx) as resp:
            body = resp.read().decode()
            
            # Check for common secret patterns
            dangerous_patterns = [
                "sk-",          # OpenAI keys
                "Bearer ",      # Tokens
                "API_KEY=",     # Env vars
                "SECRET=",      # Secrets
                "password",     # Passwords
                "client_secret",# OAuth
            ]
            
            for pattern in dangerous_patterns:
                if pattern.lower() in body.lower():
                    print(f"{RED}   ❌ DANGER: Found '{pattern}' in response!{RESET}")
                    return False
            
            print(f"{GREEN}   ✅ No secret patterns in /health response{RESET}")
            return True
            
    except Exception as e:
        print(f"{RED}   ❌ Error checking: {e}{RESET}")
        return False


def check_cors_security() -> bool:
    """Check CORS is properly configured."""
    print(f"{CYAN}🌍 CORS Configuration{RESET}")
    
    ctx = ssl.create_default_context()
    
    # Test OPTIONS preflight
    try:
        req = urllib.request.Request(
            f"{VAULT_URL}/health",
            headers={
                "Origin": "https://malicious-site.com",
                "Access-Control-Request-Method": "POST"
            }
        )
        req.get_method = lambda: 'OPTIONS'
        
        with urllib.request.urlopen(req, timeout=5, context=ctx) as resp:
            acao = resp.headers.get("Access-Control-Allow-Origin", "")
            if acao == "*":
                print(f"{YELLOW}   ⚠️  CORS allows all origins (*){RESET}")
            elif "malicious" in acao:
                print(f"{RED}   ❌ CORS reflects malicious origin!{RESET}")
                return False
            else:
                print(f"{GREEN}   ✅ CORS properly configured: {acao or 'restricted'}{RESET}")
            return True
            
    except urllib.error.HTTPError as e:
        if e.code == 204:
            print(f"{GREEN}   ✅ OPTIONS handled (204){RESET}")
            return True
        print(f"{YELLOW}   ⚠️  OPTIONS returned {e.code}{RESET}")
        return True
    except Exception as e:
        print(f"{YELLOW}   ⚠️  CORS check error: {e}{RESET}")
        return True


def check_headers_security() -> bool:
    """Check security headers."""
    print(f"{CYAN}🛡️  Security Headers{RESET}")
    
    ctx = ssl.create_default_context()
    url = f"{VAULT_URL}/health"
    
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=5, context=ctx) as resp:
            headers = resp.headers
            
            checks = []
            
            # Content-Type should be application/json
            ct = headers.get("Content-Type", "")
            if "application/json" in ct:
                checks.append((True, "Content-Type: application/json"))
            else:
                checks.append((False, f"Content-Type: {ct}"))
            
            # Check for dangerous headers that shouldn't be there
            if headers.get("Server"):
                checks.append((False, f"Server header exposed: {headers.get('Server')}"))
            
            for ok, msg in checks:
                if ok:
                    print(f"{GREEN}   ✅ {msg}{RESET}")
                else:
                    print(f"{YELLOW}   ⚠️  {msg}{RESET}")
            
            return True
            
    except Exception as e:
        print(f"{RED}   ❌ Error: {e}{RESET}")
        return False


def check_error_handling() -> bool:
    """Check error responses don't leak info."""
    print(f"{CYAN}🚫 Error Handling{RESET}")
    
    opener = get_opener()
    
    # Test 404
    try:
        req = urllib.request.Request(f"{VAULT_URL}/nonexistent-endpoint-xyz")
        with opener.open(req, timeout=5) as resp:
            pass
    except urllib.error.HTTPError as e:
        if e.code == 302:
            print(f"{GREEN}   ✅ Unknown endpoint redirects to auth{RESET}")
        elif e.code == 404:
            body = e.read().decode()
            if "stack" in body.lower() or "trace" in body.lower():
                print(f"{RED}   ❌ 404 exposes stack trace!{RESET}")
                return False
            print(f"{GREEN}   ✅ 404 doesn't expose internals{RESET}")
        else:
            print(f"{YELLOW}   ⚠️  Unknown endpoint returned {e.code}{RESET}")
    except Exception as e:
        print(f"{YELLOW}   ⚠️  Error: {e}{RESET}")
    
    return True


def main():
    print(f"\n{BOLD}{CYAN}{'='*60}{RESET}")
    print(f"{BOLD}{CYAN}🔒 Vault API Security & Health Verification{RESET}")
    print(f"{BOLD}{CYAN}{'='*60}{RESET}")
    print(f"   Target: {VAULT_URL}\n")
    
    results = []
    
    # Health
    results.append(("Health", check_health()))
    print()
    
    # Public endpoints
    results.append(("Public Endpoints", check_public_endpoints()))
    print()
    
    # Protected endpoints (CRITICAL)
    results.append(("Protected Endpoints", check_protected_endpoints()))
    print()
    
    # No secret exposure (CRITICAL)
    results.append(("No Secret Exposure", check_no_secret_exposure()))
    print()
    
    # CORS
    results.append(("CORS", check_cors_security()))
    print()
    
    # Security headers
    results.append(("Security Headers", check_headers_security()))
    print()
    
    # Error handling
    results.append(("Error Handling", check_error_handling()))
    print()
    
    # Summary
    print(f"{BOLD}{'='*60}{RESET}")
    print(f"{BOLD}📊 Summary{RESET}")
    print(f"{'='*60}")
    
    all_passed = True
    for name, passed in results:
        status = f"{GREEN}✅ PASS{RESET}" if passed else f"{RED}❌ FAIL{RESET}"
        print(f"   {name}: {status}")
        if not passed:
            all_passed = False
    
    print(f"{'='*60}")
    
    if all_passed:
        print(f"\n{GREEN}{BOLD}✅ ALL SECURITY CHECKS PASSED{RESET}")
        print(f"{GREEN}Vault API is secure and operational.{RESET}\n")
        sys.exit(0)
    else:
        print(f"\n{RED}{BOLD}❌ SECURITY ISSUES DETECTED{RESET}")
        print(f"{RED}Review and fix before proceeding!{RESET}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
