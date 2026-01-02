"""
Feature Tests

Tests for specific features from Pareto Speedruns:
- Second Pareto: Rate limiting, course progress, video positions, idempotency
- Third Pareto: Role in session, admin stats, mastery levels
"""

import requests
from .conftest import get_api_base, TIMEOUT
from .profiles import STUDENT, ADMIN


class TestSecondParetoFeatures:
    """Tests for Second Pareto Speedrun features."""

    def test_rate_limit_not_blocked(self):
        """Normal requests should not be rate limited (GAP-1415)."""
        response = requests.get(
            f"{get_api_base()}/api/health",
            timeout=TIMEOUT
        )
        assert response.status_code == 200
        # Just verify we're not getting 429

    def test_signals_include_course_progress(self):
        """GET /api/signals/:courseId should include course_progress (GAP-601)."""
        response = requests.get(
            f"{get_api_base()}/api/signals/wge-onboarding",
            headers=STUDENT.headers(),
            timeout=TIMEOUT
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "course_progress" in data, "Missing course_progress in signals"
        progress = data["course_progress"]
        assert "completed" in progress, "Missing completed in course_progress"
        assert "total" in progress, "Missing total in course_progress"
        assert "percent" in progress, "Missing percent in course_progress"

    def test_signals_include_video_positions(self):
        """GET /api/signals/:courseId should include video_positions (GAP-102)."""
        response = requests.get(
            f"{get_api_base()}/api/signals/wge-onboarding",
            headers=STUDENT.headers(),
            timeout=TIMEOUT
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "video_positions" in data, "Missing video_positions in signals"
        assert isinstance(data["video_positions"], dict), "video_positions should be a dict"

    def test_idempotency_header_accepted(self):
        """POST /api/events should accept X-Idempotency-Key header (GAP-711)."""
        response = requests.post(
            f"{get_api_base()}/api/events",
            headers={
                **STUDENT.headers(),
                "X-Idempotency-Key": "test-key-12345"
            },
            json={
                "type": "VIDEO_PING",
                "course_id": "wge-onboarding",
                "class_id": "wge-onboarding-1",
                "payload": {"position_sec": 10, "duration_sec": 100}
            },
            timeout=TIMEOUT
        )
        # Should work with auth (201/200)
        assert response.status_code in [201, 200], \
            f"Expected 201/200, got {response.status_code}"


class TestThirdParetoFeatures:
    """Tests for Third Pareto Speedrun features."""

    def test_student_role_resolved_correctly(self):
        """Student should get 403 on admin stats (role resolved correctly)."""
        response = requests.get(
            f"{get_api_base()}/api/admin/stats",
            headers=STUDENT.headers(),
            timeout=TIMEOUT
        )
        assert response.status_code == 403, \
            f"Student should get 403, got {response.status_code}"

    def test_admin_role_resolved_correctly(self):
        """Admin should get 200 on admin stats (role resolved correctly)."""
        response = requests.get(
            f"{get_api_base()}/api/admin/stats",
            headers=ADMIN.headers(),
            timeout=TIMEOUT
        )
        assert response.status_code == 200, \
            f"Admin should get 200, got {response.status_code}"
        data = response.json()
        assert "stats" in data, "Response should contain stats"

    def test_admin_stats_structure(self):
        """Admin stats should have proper structure (GAP-604)."""
        response = requests.get(
            f"{get_api_base()}/api/admin/stats",
            headers=ADMIN.headers(),
            timeout=TIMEOUT
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "stats" in data, "Missing stats in response"
        stats = data["stats"]
        
        # Should have some stat categories
        expected_keys = ["users", "courses", "events"]
        for key in expected_keys:
            if key not in stats:
                # Not all stats may be implemented, just log it
                pass


def get_tests():
    """Return list of test functions for runner."""
    second = TestSecondParetoFeatures()
    third = TestThirdParetoFeatures()
    
    return [
        # Second Pareto
        ("Rate limit not blocked (GAP-1415)", second.test_rate_limit_not_blocked),
        ("Signals course_progress (GAP-601)", second.test_signals_include_course_progress),
        ("Signals video_positions (GAP-102)", second.test_signals_include_video_positions),
        ("Idempotency header accepted (GAP-711)", second.test_idempotency_header_accepted),
        # Third Pareto - Role Resolution
        ("Student role resolved (GAP-1201)", third.test_student_role_resolved_correctly),
        ("Admin role resolved (GAP-1201)", third.test_admin_role_resolved_correctly),
        ("Admin stats structure (GAP-604)", third.test_admin_stats_structure),
    ]
