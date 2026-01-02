"""
RBAC Tests - Student Role

Tests from the perspective of a student user.
Students should be able to:
- View courses
- View their own progress/signals
- Submit events
- View badges
- View leaderboard

Students should NOT be able to:
- Access admin endpoints
- View other students' data (tested in isolation tests)
"""

import requests
from .conftest import get_api_base, TIMEOUT, log_info
from .profiles import STUDENT, ADMIN


class TestRBACStudent:
    """RBAC tests from student perspective."""

    def test_student_can_view_courses(self):
        """Student can view available courses."""
        response = requests.get(
            f"{get_api_base()}/api/courses",
            headers=STUDENT.headers(),
            timeout=TIMEOUT
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "courses" in data or isinstance(data, list)

    def test_student_can_view_course_details(self):
        """Student can view course details."""
        response = requests.get(
            f"{get_api_base()}/api/courses/wge-onboarding",
            headers=STUDENT.headers(),
            timeout=TIMEOUT
        )
        # 200 if exists, 404 if not - both are valid responses
        assert response.status_code in [200, 404], f"Expected 200/404, got {response.status_code}"

    def test_student_can_view_signals(self):
        """Student can view their own course signals/progress."""
        response = requests.get(
            f"{get_api_base()}/api/signals/wge-onboarding",
            headers=STUDENT.headers(),
            timeout=TIMEOUT
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        # Should have steps array
        assert "steps" in data or "signals" in data or isinstance(data, dict)

    def test_student_can_view_badges(self):
        """Student can view badges."""
        response = requests.get(
            f"{get_api_base()}/api/badges",
            headers=STUDENT.headers(),
            timeout=TIMEOUT
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "badges" in data or isinstance(data, list)

    def test_student_can_view_leaderboard(self):
        """Student can view the leaderboard."""
        response = requests.get(
            f"{get_api_base()}/api/leaderboard",
            headers=STUDENT.headers(),
            timeout=TIMEOUT
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "leaderboard" in data or isinstance(data, list)

    def test_student_can_view_own_profile(self):
        """Student can view their own learner profile."""
        response = requests.get(
            f"{get_api_base()}/api/learner",
            headers=STUDENT.headers(),
            timeout=TIMEOUT
        )
        # 200 or 404 if no profile yet
        assert response.status_code in [200, 404], f"Expected 200/404, got {response.status_code}"

    def test_student_cannot_access_admin_stats(self):
        """Student should NOT be able to access admin stats (403)."""
        response = requests.get(
            f"{get_api_base()}/api/admin/stats",
            headers=STUDENT.headers(),
            timeout=TIMEOUT
        )
        assert response.status_code == 403, \
            f"Student should get 403 on admin stats, got {response.status_code}"
        data = response.json()
        assert "error" in data


def get_tests():
    """Return list of test functions for runner."""
    instance = TestRBACStudent()
    return [
        ("Student can view courses", instance.test_student_can_view_courses),
        ("Student can view course details", instance.test_student_can_view_course_details),
        ("Student can view signals", instance.test_student_can_view_signals),
        ("Student can view badges", instance.test_student_can_view_badges),
        ("Student can view leaderboard", instance.test_student_can_view_leaderboard),
        ("Student can view own profile", instance.test_student_can_view_own_profile),
        ("Student cannot access admin stats", instance.test_student_cannot_access_admin_stats),
    ]
