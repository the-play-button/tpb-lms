"""
RBAC Tests - Admin Role

Tests from the perspective of an admin user.
Admins should be able to:
- Everything instructors can do
- Access admin stats endpoint
- Manage API keys for other users

Tests also verify that non-admins are rejected from admin endpoints.
"""

import requests
from .conftest import get_api_base, TIMEOUT, log_info
from .profiles import ADMIN, STUDENT, INSTRUCTOR


class TestRBACAdmin:
    """RBAC tests from admin perspective."""

    def test_admin_can_view_courses(self):
        """Admin can view available courses."""
        response = requests.get(
            f"{get_api_base()}/api/courses",
            headers=ADMIN.headers(),
            timeout=TIMEOUT
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    def test_admin_can_view_leaderboard(self):
        """Admin can view the leaderboard."""
        response = requests.get(
            f"{get_api_base()}/api/leaderboard",
            headers=ADMIN.headers(),
            timeout=TIMEOUT
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    def test_admin_can_access_stats(self):
        """Admin CAN access admin stats."""
        response = requests.get(
            f"{get_api_base()}/api/admin/stats",
            headers=ADMIN.headers(),
            timeout=TIMEOUT
        )
        assert response.status_code == 200, \
            f"Admin should get 200 on admin stats, got {response.status_code}"
        data = response.json()
        assert "stats" in data, "Response should contain stats"

    def test_student_cannot_access_admin_stats(self):
        """Student should NOT be able to access admin stats."""
        response = requests.get(
            f"{get_api_base()}/api/admin/stats",
            headers=STUDENT.headers(),
            timeout=TIMEOUT
        )
        assert response.status_code == 403, \
            f"Student should get 403 on admin stats, got {response.status_code}"

    def test_instructor_cannot_access_admin_stats(self):
        """Instructor should NOT be able to access admin stats."""
        response = requests.get(
            f"{get_api_base()}/api/admin/stats",
            headers=INSTRUCTOR.headers(),
            timeout=TIMEOUT
        )
        assert response.status_code == 403, \
            f"Instructor should get 403 on admin stats, got {response.status_code}"

    def test_admin_can_list_own_api_keys(self):
        """Admin can list their own API keys."""
        response = requests.get(
            f"{get_api_base()}/api/auth/api-keys",
            headers=ADMIN.headers(),
            timeout=TIMEOUT
        )
        assert response.status_code == 200, \
            f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "apiKeys" in data, "Response should contain apiKeys"


def get_tests():
    """Return list of test functions for runner."""
    instance = TestRBACAdmin()
    return [
        ("Admin can view courses", instance.test_admin_can_view_courses),
        ("Admin can view leaderboard", instance.test_admin_can_view_leaderboard),
        ("Admin can access stats", instance.test_admin_can_access_stats),
        ("Student cannot access admin stats", instance.test_student_cannot_access_admin_stats),
        ("Instructor cannot access admin stats", instance.test_instructor_cannot_access_admin_stats),
        ("Admin can list own API keys", instance.test_admin_can_list_own_api_keys),
    ]
