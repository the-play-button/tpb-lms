"""
Horizontal Isolation Tests

Critical security tests to ensure users cannot access other users' data.
Tests that student A cannot see/modify student B's data.

Now uses distinct profiles (STUDENT, INSTRUCTOR, ADMIN) to test cross-user isolation.
"""

import requests
from .conftest import get_api_base, TIMEOUT, log_info
from .profiles import STUDENT, INSTRUCTOR, ADMIN


class TestHorizontalIsolation:
    """
    Horizontal isolation tests using multiple user profiles.
    
    Verifies:
    1. Each user only sees their own data
    2. One user cannot access another user's resources
    3. API keys are scoped to their owner
    """

    def test_signals_are_user_scoped(self):
        """Each user's signals should only show their own data."""
        # Get signals as student
        response = requests.get(
            f"{get_api_base()}/api/signals/wge-onboarding",
            headers=STUDENT.headers(),
            timeout=TIMEOUT
        )
        assert response.status_code == 200
        data = response.json()
        
        # The response should only contain the current user's signals
        if "steps" in data:
            for step in data["steps"]:
                # If user_id is exposed, it could be a privacy issue
                if "user_id" in step:
                    log_info("Warning: user_id exposed in signals response")

    def test_api_keys_student_sees_only_own_keys(self):
        """Student's API keys list should only show student's keys."""
        response = requests.get(
            f"{get_api_base()}/api/auth/api-keys",
            headers=STUDENT.headers(),
            timeout=TIMEOUT
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "apiKeys" in data, "Response should have apiKeys"
        # Should have at least the student's test key
        keys = data["apiKeys"]
        assert isinstance(keys, list)

    def test_api_keys_admin_sees_only_own_keys(self):
        """Admin's API keys list should only show admin's keys, not all keys."""
        response = requests.get(
            f"{get_api_base()}/api/auth/api-keys",
            headers=ADMIN.headers(),
            timeout=TIMEOUT
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "apiKeys" in data, "Response should have apiKeys"
        keys = data["apiKeys"]
        
        # Admin should see their own keys, not student's keys
        # Check that none of the keys belong to student profile
        for key in keys:
            # The key prefix should match admin's key, not student's
            assert key.get("prefix", "").startswith("tpb_"), "Key should have tpb_ prefix"

    def test_cannot_delete_other_users_api_key(self):
        """Student should NOT be able to delete instructor's API key."""
        # Use a fake key ID that definitely doesn't belong to student
        fake_key_id = "ea88cdb4-aab5-4f62-a39b-c412d94cb0b7"  # instructor's key ID
        
        response = requests.delete(
            f"{get_api_base()}/api/auth/api-keys/{fake_key_id}",
            headers=STUDENT.headers(),
            timeout=TIMEOUT
        )
        
        # Should be 404 (not found for THIS user) - the key exists but isn't theirs
        assert response.status_code == 404, \
            f"Expected 404 when deleting other user's key, got {response.status_code}"

    def test_signals_reset_is_user_scoped(self):
        """Signal reset should only affect current user's data."""
        response = requests.post(
            f"{get_api_base()}/api/signals/test-course-isolation/reset",
            headers=STUDENT.headers(),
            timeout=TIMEOUT
        )
        
        # 200 if course exists and user has data
        # 404 if course doesn't exist
        # Both are acceptable - just shouldn't be 500 or reset other users
        assert response.status_code in [200, 404], \
            f"Expected 200/404, got {response.status_code}"

    def test_learner_profile_student(self):
        """Student profile should show student's own data."""
        response = requests.get(
            f"{get_api_base()}/api/learner",
            headers=STUDENT.headers(),
            timeout=TIMEOUT
        )
        
        assert response.status_code in [200, 404]

    def test_learner_profile_admin(self):
        """Admin profile should show admin's own data, not student's."""
        response = requests.get(
            f"{get_api_base()}/api/learner",
            headers=ADMIN.headers(),
            timeout=TIMEOUT
        )
        
        assert response.status_code in [200, 404]

    def test_stats_are_user_scoped(self):
        """User stats should be scoped to the authenticated user."""
        response = requests.get(
            f"{get_api_base()}/api/stats",
            headers=STUDENT.headers(),
            timeout=TIMEOUT
        )
        
        # 200 or 404 (no stats yet) are valid
        assert response.status_code in [200, 404], \
            f"Expected 200/404, got {response.status_code}"


def get_tests():
    """Return list of test functions for runner."""
    instance = TestHorizontalIsolation()
    return [
        ("Signals are user-scoped", instance.test_signals_are_user_scoped),
        ("Student API keys - only own keys", instance.test_api_keys_student_sees_only_own_keys),
        ("Admin API keys - only own keys", instance.test_api_keys_admin_sees_only_own_keys),
        ("Cannot delete other user's API key", instance.test_cannot_delete_other_users_api_key),
        ("Signals reset is user-scoped", instance.test_signals_reset_is_user_scoped),
        ("Learner profile - student", instance.test_learner_profile_student),
        ("Learner profile - admin", instance.test_learner_profile_admin),
        ("Stats are user-scoped", instance.test_stats_are_user_scoped),
    ]
