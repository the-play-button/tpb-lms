"""
Public Endpoint Tests - No Authentication Required

Tests endpoints that should be accessible without any auth.
"""

import requests
from .conftest import get_api_base, TIMEOUT


class TestPublicEndpoints:
    """Tests for publicly accessible endpoints."""

    def test_health_check(self):
        """API should respond to health check with DB status."""
        response = requests.get(f"{get_api_base()}/api/health", timeout=TIMEOUT)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["status"] in ["healthy", "ok"], f"Status: {data['status']}"
        assert "timestamp" in data, "Missing timestamp"
        assert "version" in data, "Missing version"
        
        # Check DB status if present
        if "checks" in data:
            assert data["checks"]["database"]["status"] == "up", "DB not up"

    def test_health_response_format(self):
        """Health response should have proper JSON structure."""
        response = requests.get(f"{get_api_base()}/api/health", timeout=TIMEOUT)
        data = response.json()
        
        required_fields = ["status", "timestamp", "version"]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"

    def test_cors_preflight(self):
        """API should return CORS headers on OPTIONS."""
        response = requests.options(
            f"{get_api_base()}/api/health",
            headers={"Origin": "https://example.com"},
            timeout=TIMEOUT
        )
        assert response.status_code == 204, f"Expected 204, got {response.status_code}"

    def test_unknown_endpoint_requires_auth(self):
        """Unknown endpoints should require auth (401 or 302 redirect to CF Access)."""
        response = requests.get(
            f"{get_api_base()}/api/nonexistent-endpoint-xyz",
            timeout=TIMEOUT,
            allow_redirects=False
        )
        # Worker returns 401 directly, or CF Access returns 302 redirect
        assert response.status_code in [401, 302], f"Expected 401/302, got {response.status_code}"


def get_tests():
    """Return list of test functions for runner."""
    instance = TestPublicEndpoints()
    return [
        ("Health check", instance.test_health_check),
        ("Health response format", instance.test_health_response_format),
        ("CORS preflight", instance.test_cors_preflight),
        ("Unknown endpoint requires auth", instance.test_unknown_endpoint_requires_auth),
    ]

