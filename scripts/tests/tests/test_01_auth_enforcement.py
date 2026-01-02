"""
Auth Enforcement Tests

Verifies that all protected endpoints require authentication.
Anonymous requests should get 302 redirect to CF Access login.
"""

import requests
from .conftest import get_api_base, TIMEOUT


# All protected endpoints to test
PROTECTED_ENDPOINTS = [
    ("GET", "/api/courses"),
    ("GET", "/api/courses/wge-onboarding"),
    ("GET", "/api/signals/wge-onboarding"),
    ("POST", "/api/events"),
    ("GET", "/api/badges"),
    ("GET", "/api/leaderboard"),
    ("GET", "/api/learner"),
    ("GET", "/api/auth/session"),
    ("GET", "/api/auth/api-keys"),
    ("POST", "/api/auth/api-keys"),
    ("GET", "/api/admin/stats"),  # Third Pareto: Admin endpoint
]


class TestAuthEnforcement:
    """Verify authentication is required for protected endpoints."""

    def test_courses_requires_auth(self):
        """GET /api/courses should require authentication (401 or 302)."""
        response = requests.get(
            f"{get_api_base()}/api/courses",
            timeout=TIMEOUT,
            allow_redirects=False
        )
        # Worker returns 401 directly, or CF Access returns 302
        assert response.status_code in [401, 302], f"Expected 401/302, got {response.status_code}"

    def test_signals_requires_auth(self):
        """GET /api/signals/:courseId should require authentication."""
        response = requests.get(
            f"{get_api_base()}/api/signals/wge-onboarding",
            timeout=TIMEOUT,
            allow_redirects=False
        )
        assert response.status_code in [401, 302], f"Expected 401/302, got {response.status_code}"

    def test_events_requires_auth(self):
        """POST /api/events should require authentication."""
        response = requests.post(
            f"{get_api_base()}/api/events",
            json={
                "type": "VIDEO_PING",
                "course_id": "test",
                "class_id": "test",
                "payload": {"position_sec": 10, "duration_sec": 100}
            },
            timeout=TIMEOUT,
            allow_redirects=False
        )
        assert response.status_code in [401, 302], f"Expected 401/302, got {response.status_code}"

    def test_leaderboard_requires_auth(self):
        """GET /api/leaderboard should require authentication."""
        response = requests.get(
            f"{get_api_base()}/api/leaderboard",
            timeout=TIMEOUT,
            allow_redirects=False
        )
        assert response.status_code in [401, 302], f"Expected 401/302, got {response.status_code}"

    def test_admin_stats_requires_auth(self):
        """GET /api/admin/stats should require authentication."""
        response = requests.get(
            f"{get_api_base()}/api/admin/stats",
            timeout=TIMEOUT,
            allow_redirects=False
        )
        assert response.status_code in [401, 302], f"Expected 401/302, got {response.status_code}"

    def test_tally_webhook_rejects_invalid_secret(self):
        """Tally webhook should reject invalid secrets."""
        response = requests.post(
            f"{get_api_base()}/api/tally-webhook?secret=wrong_secret",
            json={"eventType": "FORM_RESPONSE", "data": {}},
            timeout=TIMEOUT
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"

    def test_invalid_api_key_returns_403(self):
        """Invalid API key should return 403."""
        response = requests.get(
            f"{get_api_base()}/api/courses",
            headers={"Authorization": "Bearer tpb_invalid_key_12345"},
            timeout=TIMEOUT
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        assert "error" in data
        assert "Invalid" in data["error"]

    def test_wrong_api_key_format_returns_403(self):
        """API key without tpb_ prefix should return 403."""
        response = requests.get(
            f"{get_api_base()}/api/courses",
            headers={"Authorization": "Bearer wrong_format_key"},
            timeout=TIMEOUT
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        assert "Invalid API key format" in data.get("error", "")


def get_tests():
    """Return list of test functions for runner."""
    instance = TestAuthEnforcement()
    return [
        ("Courses requires auth", instance.test_courses_requires_auth),
        ("Signals requires auth", instance.test_signals_requires_auth),
        ("Events requires auth", instance.test_events_requires_auth),
        ("Leaderboard requires auth", instance.test_leaderboard_requires_auth),
        ("Admin stats requires auth", instance.test_admin_stats_requires_auth),
        ("Tally webhook rejects invalid secret", instance.test_tally_webhook_rejects_invalid_secret),
        ("Invalid API key returns 403", instance.test_invalid_api_key_returns_403),
        ("Wrong API key format returns 403", instance.test_wrong_api_key_format_returns_403),
    ]

