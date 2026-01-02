#!/usr/bin/env python3
"""
verify_deploy.py - Post-deployment verification
Checks that both backend API and frontend are healthy

Usage:
    python scripts/devops/verify_deploy.py

One-liner (in Dev Container):
    cd 04.Execution/lms && python scripts/devops/verify_deploy.py
"""

import sys
import urllib.request
import urllib.error
import json
import ssl

# Configuration
BACKEND_URL = "https://lms-api.matthieu-marielouise.workers.dev"
FRONTEND_URL = "https://lms-viewer.matthieu-marielouise.workers.dev"

# Colors
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
RESET = "\033[0m"


def check_backend() -> bool:
    """Check backend API health endpoint."""
    url = f"{BACKEND_URL}/api/health"
    print(f"{CYAN}🔍 Checking backend: {url}{RESET}")
    
    try:
        ctx = ssl.create_default_context()
        req = urllib.request.Request(url, headers={"User-Agent": "LMS-Deploy-Check"})
        
        with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
            if resp.status != 200:
                print(f"{RED}   ❌ HTTP {resp.status}{RESET}")
                return False
            
            data = json.loads(resp.read().decode())
            status = data.get("status", "unknown")
            version = data.get("version", "?")
            db_status = data.get("checks", {}).get("database", {}).get("status", "?")
            
            if status == "healthy":
                print(f"{GREEN}   ✅ Status: {status}{RESET}")
                print(f"{GREEN}   ✅ Version: {version}{RESET}")
                print(f"{GREEN}   ✅ Database: {db_status}{RESET}")
                return True
            else:
                print(f"{RED}   ❌ Status: {status}{RESET}")
                return False
                
    except urllib.error.HTTPError as e:
        print(f"{RED}   ❌ HTTP Error: {e.code}{RESET}")
        return False
    except urllib.error.URLError as e:
        print(f"{RED}   ❌ Connection Error: {e.reason}{RESET}")
        return False
    except json.JSONDecodeError:
        print(f"{RED}   ❌ Invalid JSON response{RESET}")
        return False
    except Exception as e:
        print(f"{RED}   ❌ Error: {e}{RESET}")
        return False


def check_frontend() -> bool:
    """Check frontend is serving HTML."""
    print(f"{CYAN}🔍 Checking frontend: {FRONTEND_URL}{RESET}")
    
    try:
        ctx = ssl.create_default_context()
        req = urllib.request.Request(FRONTEND_URL, headers={"User-Agent": "LMS-Deploy-Check"})
        
        with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
            # Frontend behind Cloudflare Access will return 302
            # Direct access returns 200 with HTML
            if resp.status == 200:
                content = resp.read().decode()
                if "<html" in content.lower() or "<!doctype" in content.lower():
                    print(f"{GREEN}   ✅ Serving HTML{RESET}")
                    if "TPB Academy" in content or "LMS" in content:
                        print(f"{GREEN}   ✅ Content verified{RESET}")
                    return True
                else:
                    print(f"{YELLOW}   ⚠️  Unexpected content{RESET}")
                    return True
            else:
                print(f"{RED}   ❌ HTTP {resp.status}{RESET}")
                return False
                
    except urllib.error.HTTPError as e:
        # 302 is expected with Cloudflare Access
        if e.code == 302:
            print(f"{GREEN}   ✅ Redirecting (Cloudflare Access){RESET}")
            return True
        print(f"{RED}   ❌ HTTP Error: {e.code}{RESET}")
        return False
    except urllib.error.URLError as e:
        print(f"{RED}   ❌ Connection Error: {e.reason}{RESET}")
        return False
    except Exception as e:
        print(f"{RED}   ❌ Error: {e}{RESET}")
        return False


def main():
    print(f"\n{CYAN}{'='*50}{RESET}")
    print(f"{CYAN}🔍 LMS Deployment Verification{RESET}")
    print(f"{CYAN}{'='*50}{RESET}\n")
    
    backend_ok = check_backend()
    print()
    frontend_ok = check_frontend()
    print()
    
    if backend_ok and frontend_ok:
        print(f"{GREEN}✅ All checks passed{RESET}")
        sys.exit(0)
    else:
        print(f"{RED}❌ Some checks failed{RESET}")
        sys.exit(1)


if __name__ == "__main__":
    main()
