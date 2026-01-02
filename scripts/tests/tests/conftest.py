"""
Shared configuration and utilities for LMS API tests.

Two authentication mechanisms:
1. API Keys - for testing API key authentication itself
2. CF Access Service Tokens - for testing browser user flows (RBAC)

Credentials are fetched from vault-api via VaultClient.
No hardcoded secrets or .env files needed.
"""

import sys
from pathlib import Path

# Add parent dirs to path for imports
_project_root = Path(__file__).resolve().parents[4]
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from vault_client import VaultClient

# ============================================
# Configuration
# ============================================

PROD_URL = "https://lms-api.matthieu-marielouise.workers.dev"
LOCAL_URL = "http://localhost:8787"

# Default to prod
API_BASE = PROD_URL

# Test timeout
TIMEOUT = 10

# Vault client singleton
_vault = None

def get_vault():
    """Get or create VaultClient singleton."""
    global _vault
    if _vault is None:
        _vault = VaultClient.from_devcontainer()
    return _vault

# ============================================
# API Key Authentication (for API consumers)
# ============================================

# API keys are stored in vault and fetched lazily
_api_keys = None

def _load_api_keys():
    """Load API keys from vault."""
    global _api_keys
    if _api_keys is not None:
        return _api_keys
    
    vault = get_vault()
    _api_keys = {
        'student': vault.get_secret('apps/lms/test_api_key_student'),
        'instructor': vault.get_secret('apps/lms/test_api_key_instructor'),
        'admin': vault.get_secret('apps/lms/test_api_key_admin'),
    }
    
    # Validate we have all keys
    missing = [k for k, v in _api_keys.items() if not v]
    if missing:
        print(f"WARNING: Missing API keys in vault for roles: {missing}")
        print("Store them with: vault.set_secret('apps/lms/test_api_key_{role}', 'tpb_...')")
    
    return _api_keys


def get_api_key_headers(role='student'):
    """
    Get Authorization header for API key authentication.
    
    Use this for testing API key auth mechanism itself.
    Role determines which user's API key to use.
    """
    keys = _load_api_keys()
    key = keys.get(role)
    if not key:
        raise ValueError(f"No API key configured for role: {role}. Check vault path: apps/lms/test_api_key_{role}")
    return {"Authorization": f"Bearer {key}"}


def get_auth_headers():
    """Legacy: Get auth headers using default API key."""
    return get_api_key_headers('student')


# ============================================
# CF Access Authentication (for browser users)
# ============================================

# CF Access service tokens are fetched from vault
_cf_tokens = None

def _load_cf_tokens():
    """Load CF Access tokens from vault."""
    global _cf_tokens
    if _cf_tokens is not None:
        return _cf_tokens
    
    vault = get_vault()
    
    # LMS app credentials for CF Access
    _cf_tokens = {
        'lms': {
            'id': vault.get_secret('apps/lms/vault_client_id'),
            'secret': vault.get_secret('apps/lms/vault_client_secret'),
        }
    }
    
    # Validate
    if not _cf_tokens['lms']['id'] or not _cf_tokens['lms']['secret']:
        print("WARNING: Missing LMS CF Access credentials in vault")
        print("Store them with:")
        print("  vault.set_secret('apps/lms/vault_client_id', '...')")
        print("  vault.set_secret('apps/lms/vault_client_secret', '...')")
    
    return _cf_tokens


def get_cf_access_headers():
    """
    Get CF Access service token headers.
    
    Use this for testing CF Access + vault-api role resolution.
    The role will be resolved via vault-api based on the token's identity.
    """
    tokens = _load_cf_tokens()
    token = tokens['lms']
    if not token['id'] or not token['secret']:
        raise ValueError("CF Access credentials not configured in vault")
    return {
        'CF-Access-Client-Id': token['id'],
        'CF-Access-Client-Secret': token['secret'],
    }


# ============================================
# URL Helpers
# ============================================

def set_api_base(url):
    """Set the API base URL."""
    global API_BASE
    API_BASE = url


def get_api_base():
    """Get current API base URL."""
    return API_BASE


# ============================================
# Logging Helpers
# ============================================

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    END = '\033[0m'


def log_pass(name):
    print(f"  {Colors.GREEN}✅ {name}{Colors.END}")


def log_fail(name, error):
    print(f"  {Colors.RED}❌ {name}: {error}{Colors.END}")


def log_skip(name, reason):
    print(f"  {Colors.YELLOW}⏭️  {name}: {reason}{Colors.END}")


def log_section(name):
    print(f"\n{Colors.BLUE}▶ {name}{Colors.END}")


def log_info(message):
    print(f"  {Colors.CYAN}ℹ️  {message}{Colors.END}")
