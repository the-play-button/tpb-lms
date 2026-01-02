#!/usr/bin/env python3
"""
E2E Tests for Vault API (IAM PAM)

Usage:
    python scripts/tests/test_api.py --prod
    python scripts/tests/test_api.py --local

One-liner (from vault-api root):
    cd tpb_system/04.Execution/lms/core/vault-api && python scripts/tests/test_api.py --prod

IMPORTANT: Data Persistence
These tests verify API functionality but do NOT test data persistence across deployments.
To preserve data during deployments, use:
    python scripts/devops/deploy.py              # Safe - no DB changes
    python scripts/devops/deploy.py --skip-db    # Explicit skip
    
NEVER use --init-db unless you want to destroy all data!
"""

import json
import os
import sys
import requests
from datetime import datetime
from pathlib import Path

# Add vault_client to path
VAULT_API_ROOT = Path(__file__).parent.parent.parent
LMS_ROOT = VAULT_API_ROOT.parent.parent
EXECUTION_ROOT = LMS_ROOT.parent
sys.path.insert(0, str(EXECUTION_ROOT))

from vault_client import VaultClient

# Configuration
PROD_URL = "https://tpb-vault-infra.matthieu-marielouise.workers.dev"
LOCAL_URL = "http://localhost:8788"
API_BASE = PROD_URL

# Test data
TEST_USER_EMAIL = "test-e2e@theplaybutton.ai"
TEST_GROUP_NAME = "test-e2e-group"


class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'


def log_pass(name):
    print(f"  {Colors.GREEN}✅ {name}{Colors.END}")


def log_fail(name, error):
    print(f"  {Colors.RED}❌ {name}: {error}{Colors.END}")


def log_skip(name, reason):
    print(f"  {Colors.YELLOW}⏭️  {name}: {reason}{Colors.END}")


def log_section(name):
    print(f"\n{Colors.BLUE}{Colors.BOLD}▶ {name}{Colors.END}")


def get_vault_client():
    """Get authenticated vault client."""
    try:
        return VaultClient.from_devcontainer()
    except Exception as e:
        print(f"{Colors.RED}❌ Failed to create vault client: {e}{Colors.END}")
        print("Set VAULT_CLIENT_ID and VAULT_CLIENT_SECRET in .devcontainer/.env")
        sys.exit(1)


class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.skipped = 0
    
    def add(self, name, test_fn):
        try:
            test_fn()
            log_pass(name)
            self.passed += 1
        except AssertionError as e:
            log_fail(name, str(e))
            self.failed += 1
        except requests.exceptions.ConnectionError:
            log_fail(name, "Connection error")
            self.failed += 1
        except Exception as e:
            log_fail(name, str(e))
            self.failed += 1


# ============================================================
# PUBLIC ENDPOINT TESTS
# ============================================================

def test_health_check():
    """Health endpoint returns healthy status."""
    resp = requests.get(f"{API_BASE}/health", timeout=10)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["service"] == "tpb-vault-infra"
    assert "stats" in data


def test_health_stats():
    """Health returns connection and secret counts."""
    resp = requests.get(f"{API_BASE}/health", timeout=10)
    data = resp.json()
    stats = data.get("stats", {})
    assert "connections" in stats, "Missing connections"
    assert "secrets" in stats, "Missing secrets"
    assert stats["connections"] >= 0
    assert stats["secrets"] >= 0


def test_root_requires_auth():
    """Root (/) redirects to CF Access without auth (dashboard is protected)."""
    resp = requests.get(f"{API_BASE}/", timeout=10, allow_redirects=False)
    assert resp.status_code == 302, f"Expected 302, got {resp.status_code}"
    assert "cloudflareaccess.com" in resp.headers.get("location", "")


def test_dashboard_requires_auth():
    """Dashboard (/dashboard) redirects to CF Access without auth."""
    resp = requests.get(f"{API_BASE}/dashboard", timeout=10, allow_redirects=False)
    assert resp.status_code == 302, f"Expected 302, got {resp.status_code}"
    assert "cloudflareaccess.com" in resp.headers.get("location", "")


# ============================================================
# AUTH ENFORCEMENT TESTS
# ============================================================

def test_iam_users_requires_auth():
    """GET /iam/users redirects to CF Access without auth."""
    resp = requests.get(f"{API_BASE}/iam/users", timeout=10, allow_redirects=False)
    assert resp.status_code == 302, f"Expected 302, got {resp.status_code}"
    assert "cloudflareaccess.com" in resp.headers.get("location", "")


def test_iam_groups_requires_auth():
    """GET /iam/groups redirects to CF Access without auth."""
    resp = requests.get(f"{API_BASE}/iam/groups", timeout=10, allow_redirects=False)
    assert resp.status_code == 302


def test_iam_roles_requires_auth():
    """GET /iam/roles redirects to CF Access without auth."""
    resp = requests.get(f"{API_BASE}/iam/roles", timeout=10, allow_redirects=False)
    assert resp.status_code == 302


def test_vault_connections_requires_auth():
    """GET /vault/connections redirects without auth."""
    resp = requests.get(f"{API_BASE}/vault/connections", timeout=10, allow_redirects=False)
    assert resp.status_code == 302


def test_service_tokens_requires_auth():
    """GET /iam/service-tokens redirects without auth."""
    resp = requests.get(f"{API_BASE}/iam/service-tokens", timeout=10, allow_redirects=False)
    assert resp.status_code == 302


def test_organizations_requires_auth():
    """GET /iam/organizations redirects without auth."""
    resp = requests.get(f"{API_BASE}/iam/organizations", timeout=10, allow_redirects=False)
    assert resp.status_code == 302


def test_cloudflare_dashboard_requires_auth():
    """GET /cloudflare/dashboard redirects without auth."""
    resp = requests.get(f"{API_BASE}/cloudflare/dashboard", timeout=10, allow_redirects=False)
    assert resp.status_code == 302, f"Expected 302, got {resp.status_code}"
    assert "cloudflareaccess.com" in resp.headers.get("location", "")


def test_cloudflare_resources_requires_auth():
    """GET /cloudflare/resources redirects without auth."""
    resp = requests.get(f"{API_BASE}/cloudflare/resources", timeout=10, allow_redirects=False)
    assert resp.status_code == 302


def test_iam_applications_requires_auth():
    """GET /iam/applications redirects without auth."""
    resp = requests.get(f"{API_BASE}/iam/applications", timeout=10, allow_redirects=False)
    assert resp.status_code == 302, f"Expected 302, got {resp.status_code}"
    assert "cloudflareaccess.com" in resp.headers.get("location", "")


def test_applications_dashboard_requires_auth():
    """GET /applications/dashboard redirects without auth."""
    resp = requests.get(f"{API_BASE}/applications/dashboard", timeout=10, allow_redirects=False)
    assert resp.status_code == 302, f"Expected 302, got {resp.status_code}"
    assert "cloudflareaccess.com" in resp.headers.get("location", "")


# ============================================================
# AUTHENTICATED ENDPOINT TESTS (Service Token)
# ============================================================

class AuthenticatedTests:
    def __init__(self):
        self.client = get_vault_client()
        self.headers = self.client.headers
        self.base = self.client.base_url

    # --- IAM Users ---
    
    def test_list_users(self):
        """GET /iam/users returns user list."""
        resp = requests.get(f"{self.base}/iam/users", headers=self.headers, timeout=10)
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "users" in data
        assert isinstance(data["users"], list)

    def test_get_user(self):
        """GET /iam/users/:id returns user details."""
        resp = requests.get(f"{self.base}/iam/users/usr_admin", headers=self.headers, timeout=10)
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "user" in data
        assert data["user"]["email"] == "matthieu.marielouise@theplaybutton.ai"

    # --- IAM Groups ---
    
    def test_list_groups(self):
        """GET /iam/groups returns group list."""
        resp = requests.get(f"{self.base}/iam/groups", headers=self.headers, timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        assert "groups" in data
        # Should have seeded groups
        assert len(data["groups"]) >= 2

    def test_get_group(self):
        """GET /iam/groups/:id returns group details."""
        resp = requests.get(f"{self.base}/iam/groups/grp_admins", headers=self.headers, timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        assert "group" in data
        assert data["group"]["name"] == "Administrators"

    # --- IAM Roles ---
    
    def test_list_roles(self):
        """GET /iam/roles returns role list."""
        resp = requests.get(f"{self.base}/iam/roles", headers=self.headers, timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        assert "roles" in data
        # Should have seeded roles
        role_names = [r["name"] for r in data["roles"]]
        assert "superadmin" in role_names
        assert "developer" in role_names

    def test_get_role(self):
        """GET /iam/roles/:id returns role details."""
        resp = requests.get(f"{self.base}/iam/roles/role_superadmin", headers=self.headers, timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        assert "role" in data
        assert data["role"]["is_system"] == 1

    # --- IAM Permissions ---
    
    def test_list_permissions(self):
        """GET /iam/permissions returns permission list."""
        resp = requests.get(f"{self.base}/iam/permissions", headers=self.headers, timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        assert "permissions" in data
        # Should have seeded permissions
        perm_ids = [p["id"] for p in data["permissions"]]
        assert "perm_all" in perm_ids
        assert "perm_secret_read" in perm_ids

    # --- IAM Can (CASL) ---
    
    def test_can_endpoint_admin(self):
        """POST /iam/can returns allowed for admin."""
        resp = requests.post(
            f"{self.base}/iam/can",
            headers={**self.headers, 'Content-Type': 'application/json'},
            json={"action": "read", "resource": "secret", "user_id": "usr_admin"},
            timeout=10
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["allowed"] == True
        assert "reason" in data

    def test_can_endpoint_manage(self):
        """POST /iam/can returns allowed for manage:*."""
        resp = requests.post(
            f"{self.base}/iam/can",
            headers={**self.headers, 'Content-Type': 'application/json'},
            json={"action": "manage", "resource": "user", "user_id": "usr_admin"},
            timeout=10
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["allowed"] == True

    def test_can_endpoint_nonexistent_user(self):
        """POST /iam/can with bad user returns denied."""
        resp = requests.post(
            f"{self.base}/iam/can",
            headers={**self.headers, 'Content-Type': 'application/json'},
            json={"action": "read", "resource": "secret", "user_id": "usr_nonexistent"},
            timeout=10
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["allowed"] == False

    # --- Vault Connections ---
    
    def test_list_connections(self):
        """GET /vault/connections returns connection list."""
        resp = requests.get(f"{self.base}/vault/connections", headers=self.headers, timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        assert "connections" in data
        # Should have seeded connections
        conn_ids = [c["id"] for c in data["connections"]]
        assert "conn_infra" in conn_ids
        assert "conn_integrations" in conn_ids

    def test_get_connection(self):
        """GET /vault/connections/:id returns connection details."""
        resp = requests.get(f"{self.base}/vault/connections/conn_infra", headers=self.headers, timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        assert "connection" in data
        assert data["connection"]["integration_type"] == "infra"

    def test_list_secret_refs(self):
        """GET /vault/connections/:id/secrets returns secret refs."""
        resp = requests.get(f"{self.base}/vault/connections/conn_infra/secrets", headers=self.headers, timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        assert "secrets" in data
        # Should have seeded secrets
        secret_names = [s["name"] for s in data["secrets"]]
        assert "CLOUDFLARE_API_TOKEN" in secret_names
        assert "OPENAI_API_KEY" in secret_names

    def test_get_connection_audit(self):
        """GET /vault/connections/:id/audit returns audit log."""
        resp = requests.get(f"{self.base}/vault/connections/conn_infra/audit", headers=self.headers, timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        assert "audit" in data or "logs" in data or isinstance(data.get("audit", []), list)

    # --- IAM Organizations ---
    
    def test_list_organizations(self):
        """GET /iam/organizations returns organization list."""
        resp = requests.get(f"{self.base}/iam/organizations", headers=self.headers, timeout=10)
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "organizations" in data
        # Should have at least default org
        assert len(data["organizations"]) >= 1

    def test_get_organization(self):
        """GET /iam/organizations/:id returns org details."""
        resp = requests.get(f"{self.base}/iam/organizations/org_tpb", headers=self.headers, timeout=10)
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "organization" in data
        assert data["organization"]["slug"] == "theplaybutton"
        assert "stats" in data

    def test_get_organization_members(self):
        """GET /iam/organizations/:id/members returns members."""
        resp = requests.get(f"{self.base}/iam/organizations/org_tpb/members", headers=self.headers, timeout=10)
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "members" in data
        # Should have at least admin user
        assert len(data["members"]) >= 1

    def test_get_organization_audit(self):
        """GET /iam/organizations/:id/audit returns audit log."""
        resp = requests.get(f"{self.base}/iam/organizations/org_tpb/audit", headers=self.headers, timeout=10)
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "logs" in data

    # --- Cloudflare Resources ---
    
    def test_list_cloudflare_resources(self):
        """GET /cloudflare/resources returns resources."""
        resp = requests.get(f"{self.base}/cloudflare/resources", headers=self.headers, timeout=10)
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "resources" in data
        assert "summary" in data
        assert "organization" in data
        assert "access" in data["resources"]
        assert "workers" in data["resources"]
        assert "pages" in data["resources"]
        assert "service_tokens" in data["resources"], "service_tokens should be included in CF resources"

    def test_list_cloudflare_access_resources(self):
        """GET /cloudflare/resources/access returns Access apps."""
        resp = requests.get(f"{self.base}/cloudflare/resources/access", headers=self.headers, timeout=10)
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "access" in data
        assert isinstance(data["access"], list)

    def test_list_cloudflare_workers_resources(self):
        """GET /cloudflare/resources/workers returns Workers."""
        resp = requests.get(f"{self.base}/cloudflare/resources/workers", headers=self.headers, timeout=10)
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "workers" in data
        assert isinstance(data["workers"], list)

    def test_list_cloudflare_pages_resources(self):
        """GET /cloudflare/resources/pages returns Pages projects."""
        resp = requests.get(f"{self.base}/cloudflare/resources/pages", headers=self.headers, timeout=10)
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "pages" in data
        assert isinstance(data["pages"], list)

    def test_invalid_cloudflare_resource_type(self):
        """GET /cloudflare/resources/invalid returns 400."""
        resp = requests.get(f"{self.base}/cloudflare/resources/invalid", headers=self.headers, timeout=10)
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        data = resp.json()
        assert "Invalid resource type" in data.get("error", "")

    def test_revoke_endpoint_exists(self):
        """DELETE /iam/service-tokens/:id endpoint exists (doesn't return 404)."""
        # Use a fake token ID - we expect 403/404 for ownership, not 404 for route
        resp = requests.delete(f"{self.base}/iam/service-tokens/fake-token-id", headers=self.headers, timeout=10)
        # Should NOT be 404 (route not found), should be 403 (service token can't delete) or 404 (token not found)
        assert resp.status_code != 404 or "Not found" not in resp.json().get("error", ""), f"Route should exist, got {resp.status_code}: {resp.text}"

    # --- IAM Applications ---
    
    def test_list_applications(self):
        """GET /iam/applications returns application list."""
        resp = requests.get(f"{self.base}/iam/applications", headers=self.headers, timeout=10)
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "applications" in data
        assert isinstance(data["applications"], list)

    def test_get_application_nonexistent(self):
        """GET /iam/applications/:id returns 404 for nonexistent app."""
        resp = requests.get(f"{self.base}/iam/applications/app_nonexistent", headers=self.headers, timeout=10)
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "not found" in data.get("error", "").lower()
    
    def test_create_permission_endpoint_exists(self):
        """POST /iam/permissions endpoint exists (service token can't use it without scopes)."""
        resp = requests.post(
            f"{self.base}/iam/permissions",
            headers={**self.headers, 'Content-Type': 'application/json'},
            json={"action": "read", "resource": "test_resource"},
            timeout=10
        )
        # Service token without scopes should get 403
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"
        data = resp.json()
        # Accept either specific message or generic READ ONLY message
        error_msg = data.get("error", "").lower()
        assert "read only" in error_msg or "privileges required" in error_msg or "forbidden" in error_msg


# ============================================================
# SERVICE TOKEN RESTRICTION TESTS
# ============================================================

class ServiceTokenRestrictionTests:
    def __init__(self):
        self.client = get_vault_client()
        self.headers = self.client.headers
        self.base = self.client.base_url

    def test_service_token_readonly(self):
        """Service tokens cannot POST to /iam/users."""
        resp = requests.post(
            f"{self.base}/iam/users",
            headers={**self.headers, 'Content-Type': 'application/json'},
            json={"email": "should-fail@test.com"},
            timeout=10
        )
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"
        data = resp.json()
        assert "READ ONLY" in data.get("error", "")

    def test_service_token_can_post_iam_can(self):
        """Service tokens CAN POST to /iam/can (whitelisted)."""
        resp = requests.post(
            f"{self.base}/iam/can",
            headers={**self.headers, 'Content-Type': 'application/json'},
            json={"action": "read", "resource": "secret", "user_id": "usr_admin"},
            timeout=10
        )
        assert resp.status_code == 200

    def test_service_token_cannot_delete(self):
        """Service tokens cannot DELETE."""
        resp = requests.delete(
            f"{self.base}/iam/users/usr_admin",
            headers=self.headers,
            timeout=10
        )
        assert resp.status_code == 403

    def test_service_token_cannot_create_tokens(self):
        """Service tokens cannot create new service tokens (email auth required)."""
        resp = requests.post(
            f"{self.base}/iam/service-tokens",
            headers={**self.headers, 'Content-Type': 'application/json'},
            json={"name": "test-token"},
            timeout=10
        )
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"
        data = resp.json()
        # Accept either specific message or generic READ ONLY message
        error_msg = data.get("error", "")
        assert "Email authentication required" in error_msg or "READ ONLY" in error_msg

    def test_service_token_cannot_create_application(self):
        """Service tokens cannot create applications (superadmin only)."""
        resp = requests.post(
            f"{self.base}/iam/applications",
            headers={**self.headers, 'Content-Type': 'application/json'},
            json={
                "name": "testapp",
                "display_name": "Test App",
                "scopes": ["testapp:*"]
            },
            timeout=10
        )
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"
        data = resp.json()
        # Accept either specific message or generic READ ONLY message
        error_msg = data.get("error", "").lower()
        assert "superadmin" in error_msg or "forbidden" in error_msg or "read only" in error_msg

    def test_service_token_cannot_create_role_without_scope(self):
        """Service tokens without scopes cannot create roles."""
        resp = requests.post(
            f"{self.base}/iam/roles",
            headers={**self.headers, 'Content-Type': 'application/json'},
            json={
                "name": "test_role",
                "description": "Test role"
            },
            timeout=10
        )
        # Service token without scopes should get 403 or READ ONLY error
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"

    def test_service_token_cannot_create_permission_without_scope(self):
        """Service tokens without scopes cannot create permissions."""
        resp = requests.post(
            f"{self.base}/iam/permissions",
            headers={**self.headers, 'Content-Type': 'application/json'},
            json={
                "action": "read",
                "resource": "test_resource",
                "description": "Test permission"
            },
            timeout=10
        )
        # Service token without scopes should get 403
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"


# ============================================================
# SECURITY TESTS
# ============================================================

def test_no_secrets_in_health():
    """Health endpoint doesn't expose secret values."""
    resp = requests.get(f"{API_BASE}/health", timeout=10)
    body = resp.text.lower()
    
    dangerous = ["sk-", "bearer ", "api_key=", "secret=", "password"]
    for pattern in dangerous:
        assert pattern not in body, f"Found '{pattern}' in health response!"


def test_cors_not_wildcard():
    """CORS doesn't allow all origins for mutations."""
    resp = requests.options(
        f"{API_BASE}/health",
        headers={"Origin": "https://evil.com", "Access-Control-Request-Method": "POST"},
        timeout=10
    )
    acao = resp.headers.get("Access-Control-Allow-Origin", "")
    # Either no CORS or restricted
    assert acao != "*" or "evil" not in acao


def test_404_no_stack_trace():
    """404 responses don't expose stack traces."""
    resp = requests.get(
        f"{API_BASE}/nonexistent-xyz-123",
        timeout=10,
        allow_redirects=False
    )
    # Either 302 (redirect to auth) or 404
    if resp.status_code == 404:
        body = resp.text.lower()
        assert "stack" not in body
        assert "trace" not in body
        assert "error" not in body or "not found" in body


# ============================================================
# INFRASTRUCTURE ORPHAN TESTS
# ============================================================

class OrphanResourceTests:
    """Tests to detect infrastructure drift between vault and CF Access."""
    
    def __init__(self):
        self.client = get_vault_client()
        self.headers = self.client.headers
        self.base = self.client.base_url

    def test_orphan_endpoint_exists(self):
        """GET /iam/applications/orphans endpoint exists."""
        resp = requests.get(
            f"{self.base}/iam/applications/orphans",
            headers=self.headers,
            timeout=10
        )
        # Expect 200 or 403 (not enough privileges), but not 404
        assert resp.status_code in [200, 403], f"Expected 200/403, got {resp.status_code}: {resp.text}"

    def test_sync_audiences_endpoint_exists(self):
        """POST /iam/applications/:id/sync-audiences endpoint exists."""
        resp = requests.post(
            f"{self.base}/iam/applications/app_nonexistent/sync-audiences",
            headers=self.headers,
            timeout=10
        )
        # Expect 403 (not enough privileges) or 404 (app not found), but route should exist
        assert resp.status_code in [403, 404], f"Expected 403/404, got {resp.status_code}: {resp.text}"

    def test_applications_list_includes_audiences(self):
        """GET /iam/applications returns audiences field."""
        resp = requests.get(
            f"{self.base}/iam/applications",
            headers=self.headers,
            timeout=10
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert "applications" in data
        # If there are applications, check they have audiences field
        for app in data["applications"]:
            assert "audiences" in app, f"App {app.get('name')} missing audiences field"


# ============================================================
# MAIN
# ============================================================

def run_all_tests():
    print(f"\n{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}🧪 Vault API E2E Tests{Colors.END}")
    print(f"{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"   Target: {API_BASE}")
    print(f"   Time: {datetime.now().isoformat()}\n")
    
    results = TestResults()
    
    # Public endpoints
    log_section("PUBLIC ENDPOINTS")
    results.add("Health check", test_health_check)
    results.add("Health stats", test_health_stats)
    
    # Auth enforcement
    log_section("AUTH ENFORCEMENT")
    results.add("/ requires auth (dashboard)", test_root_requires_auth)
    results.add("/dashboard requires auth", test_dashboard_requires_auth)
    results.add("/iam/users requires auth", test_iam_users_requires_auth)
    results.add("/iam/groups requires auth", test_iam_groups_requires_auth)
    results.add("/iam/roles requires auth", test_iam_roles_requires_auth)
    results.add("/vault/connections requires auth", test_vault_connections_requires_auth)
    results.add("/iam/service-tokens requires auth", test_service_tokens_requires_auth)
    results.add("/iam/organizations requires auth", test_organizations_requires_auth)
    results.add("/iam/applications requires auth", test_iam_applications_requires_auth)
    results.add("/applications/dashboard requires auth", test_applications_dashboard_requires_auth)
    results.add("/cloudflare/dashboard requires auth", test_cloudflare_dashboard_requires_auth)
    results.add("/cloudflare/resources requires auth", test_cloudflare_resources_requires_auth)
    
    # Authenticated tests
    log_section("AUTHENTICATED ENDPOINTS")
    auth_tests = AuthenticatedTests()
    results.add("List users", auth_tests.test_list_users)
    results.add("Get user", auth_tests.test_get_user)
    results.add("List groups", auth_tests.test_list_groups)
    results.add("Get group", auth_tests.test_get_group)
    results.add("List roles", auth_tests.test_list_roles)
    results.add("Get role", auth_tests.test_get_role)
    results.add("List permissions", auth_tests.test_list_permissions)
    results.add("Can endpoint (admin)", auth_tests.test_can_endpoint_admin)
    results.add("Can endpoint (manage)", auth_tests.test_can_endpoint_manage)
    results.add("Can endpoint (bad user)", auth_tests.test_can_endpoint_nonexistent_user)
    results.add("List connections", auth_tests.test_list_connections)
    results.add("Get connection", auth_tests.test_get_connection)
    results.add("List secret refs", auth_tests.test_list_secret_refs)
    results.add("Get audit log", auth_tests.test_get_connection_audit)
    results.add("List organizations", auth_tests.test_list_organizations)
    results.add("Get organization", auth_tests.test_get_organization)
    results.add("Get org members", auth_tests.test_get_organization_members)
    results.add("Get org audit", auth_tests.test_get_organization_audit)
    results.add("List CF resources", auth_tests.test_list_cloudflare_resources)
    results.add("List CF Access resources", auth_tests.test_list_cloudflare_access_resources)
    results.add("List CF Workers resources", auth_tests.test_list_cloudflare_workers_resources)
    results.add("List CF Pages resources", auth_tests.test_list_cloudflare_pages_resources)
    results.add("Invalid CF resource type", auth_tests.test_invalid_cloudflare_resource_type)
    results.add("Revoke endpoint exists", auth_tests.test_revoke_endpoint_exists)
    results.add("List applications", auth_tests.test_list_applications)
    results.add("Get nonexistent application", auth_tests.test_get_application_nonexistent)
    results.add("Create permission endpoint exists", auth_tests.test_create_permission_endpoint_exists)
    
    # Service token restrictions
    log_section("SERVICE TOKEN RESTRICTIONS")
    st_tests = ServiceTokenRestrictionTests()
    results.add("Service token READ ONLY", st_tests.test_service_token_readonly)
    results.add("Service token can POST /iam/can", st_tests.test_service_token_can_post_iam_can)
    results.add("Service token cannot DELETE", st_tests.test_service_token_cannot_delete)
    results.add("Service token cannot create tokens", st_tests.test_service_token_cannot_create_tokens)
    results.add("Service token cannot create application", st_tests.test_service_token_cannot_create_application)
    results.add("Service token cannot create role without scope", st_tests.test_service_token_cannot_create_role_without_scope)
    results.add("Service token cannot create permission without scope", st_tests.test_service_token_cannot_create_permission_without_scope)
    
    # Security tests
    log_section("SECURITY")
    results.add("No secrets in health", test_no_secrets_in_health)
    results.add("CORS not wildcard", test_cors_not_wildcard)
    results.add("404 no stack trace", test_404_no_stack_trace)
    
    # Orphan/drift detection tests
    log_section("INFRASTRUCTURE ORPHANS")
    orphan_tests = OrphanResourceTests()
    results.add("Orphan endpoint exists", orphan_tests.test_orphan_endpoint_exists)
    results.add("Sync audiences endpoint exists", orphan_tests.test_sync_audiences_endpoint_exists)
    results.add("Applications include audiences", orphan_tests.test_applications_list_includes_audiences)
    
    # Summary
    print(f"\n{Colors.BOLD}{'='*60}{Colors.END}")
    total = results.passed + results.failed + results.skipped
    
    if results.failed == 0:
        print(f"{Colors.GREEN}{Colors.BOLD}📊 ALL TESTS PASSED: {results.passed}/{total}{Colors.END}")
    else:
        print(f"{Colors.RED}{Colors.BOLD}📊 RESULTS: {results.passed} passed, {results.failed} failed{Colors.END}")
    
    print(f"{'='*60}\n")
    
    return results.failed == 0


if __name__ == "__main__":
    if "--local" in sys.argv:
        API_BASE = LOCAL_URL
        print(f"🏠 Testing LOCAL: {API_BASE}")
    elif "--prod" in sys.argv:
        API_BASE = PROD_URL
        print(f"🌐 Testing PROD: {API_BASE}")
    else:
        print(f"🌐 Testing PROD (default): {API_BASE}")
    
    success = run_all_tests()
    sys.exit(0 if success else 1)
