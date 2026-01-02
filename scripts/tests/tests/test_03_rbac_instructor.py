"""
RBAC Tests - Instructor Role

Tests from the perspective of an instructor user.
Instructors should be able to:
- Everything students can do
- View all student progress (for courses they teach)

Instructors should NOT be able to:
- Access admin-only endpoints
"""

import requests
from .conftest import get_api_base, TIMEOUT, log_info
from .profiles import INSTRUCTOR


class TestRBACInstructor:
    """RBAC tests from instructor perspective."""

    def test_instructor_can_view_courses(self):
        """Instructor can view available courses."""
        response = requests.get(
            f"{get_api_base()}/api/courses",
            headers=INSTRUCTOR.headers(),
            timeout=TIMEOUT
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "courses" in data or isinstance(data, list)

    def test_instructor_can_view_leaderboard(self):
        """Instructor can view the leaderboard."""
        response = requests.get(
            f"{get_api_base()}/api/leaderboard",
            headers=INSTRUCTOR.headers(),
            timeout=TIMEOUT
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    def test_instructor_can_view_badges(self):
        """Instructor can view badges."""
        response = requests.get(
            f"{get_api_base()}/api/badges",
            headers=INSTRUCTOR.headers(),
            timeout=TIMEOUT
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    def test_instructor_cannot_access_admin_stats(self):
        """Instructor should NOT be able to access admin stats (403)."""
        response = requests.get(
            f"{get_api_base()}/api/admin/stats",
            headers=INSTRUCTOR.headers(),
            timeout=TIMEOUT
        )
        assert response.status_code == 403, \
            f"Instructor should get 403 on admin stats, got {response.status_code}"


def get_tests():
    """Return list of test functions for runner."""
    instance = TestRBACInstructor()
    return [
        ("Instructor can view courses", instance.test_instructor_can_view_courses),
        ("Instructor can view leaderboard", instance.test_instructor_can_view_leaderboard),
        ("Instructor can view badges", instance.test_instructor_can_view_badges),
        ("Instructor cannot access admin stats", instance.test_instructor_cannot_access_admin_stats),
    ]
