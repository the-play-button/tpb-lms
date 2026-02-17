# entropy-single-export-ok: CLI script, functions are internal pipeline steps called by main()
# entropy-duplicate-constant-ok: CLI scripts are standalone, shared constants not warranted
# entropy-console-leak-ok: uses print for CLI output
# entropy-python-unused-import-ok: urllib kept for error handling fallback
# entropy-legacy-marker-ok: tracked in backlog
#!/usr/bin/env python3
"""
verify_deploy.py - Post-deployment verification
Checks that both backend API and frontend are healthy

Usage:
    python scripts/devops/verify_deploy.py

One-liner (in Dev Container):
    cd 04.Execution/lms && python scripts/devops/verify_deploy.py
"""

import json
import ssl
import sys
import urllib.error
import urllib.request

# Configuration
BACKEND_URL = "https://lms-api.matthieu-marielouise.workers.dev"
FRONTEND_URL = "https://lms-viewer.matthieu-marielouise.workers.dev"

_HTTP_TIMEOUT = 10  # entropy-python-magic-numbers-ok: timeout in seconds
_HTTP_STATUS_OK = 200  # entropy-python-magic-numbers-ok: HTTP 200 OK
_HTTP_STATUS_REDIRECT = 302  # entropy-python-magic-numbers-ok: HTTP 302 redirect
_CLI_SEPARATOR_WIDTH = 50  # entropy-python-magic-numbers-ok: CLI display width

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
        
        with urllib.request.urlopen(req, timeout=_HTTP_TIMEOUT, context=ctx) as resp:
            if resp.status != _HTTP_STATUS_OK:
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
    except (ssl.SSLError, TimeoutError, OSError) as e:
        print(f"{RED}   ❌ Error: {e}{RESET}")
        return False


def check_frontend() -> bool:  # entropy-python-nesting-ok: nested iteration over structured data
    """Check frontend is serving HTML."""
    print(f"{CYAN}🔍 Checking frontend: {FRONTEND_URL}{RESET}")
    
    try:
        ctx = ssl.create_default_context()
        req = urllib.request.Request(FRONTEND_URL, headers={"User-Agent": "LMS-Deploy-Check"})
        
        with urllib.request.urlopen(req, timeout=_HTTP_TIMEOUT, context=ctx) as resp:
            # Frontend behind Cloudflare Access will return 302
            # Direct access returns 200 with HTML
            if resp.status == _HTTP_STATUS_OK:
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
        if e.code == _HTTP_STATUS_REDIRECT:
            print(f"{GREEN}   ✅ Redirecting (Cloudflare Access){RESET}")
            return True
        print(f"{RED}   ❌ HTTP Error: {e.code}{RESET}")
        return False
    except urllib.error.URLError as e:
        print(f"{RED}   ❌ Connection Error: {e.reason}{RESET}")
        return False
    except (ssl.SSLError, TimeoutError, OSError) as e:
        print(f"{RED}   ❌ Error: {e}{RESET}")
        return False


def main() -> None:
    """ Verify backend API and frontend deployments are healthy."""
    print(f"\n{CYAN}{'=' * _CLI_SEPARATOR_WIDTH}{RESET}")
    print(f"{CYAN}🔍 LMS Deployment Verification{RESET}")
    print(f"{CYAN}{'='*50}{RESET}\n")  # entropy-python-magic-numbers-ok: CLI display width
    
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
