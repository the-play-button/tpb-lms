"""
Test Profiles - Multi-Role Authentication

Provides distinct profiles for testing different user roles:
- STUDENT: Default user with read-only access
- INSTRUCTOR: Can manage courses
- ADMIN: Full admin access

Each profile uses its own API key linked to a user with the correct role.
Role resolution happens via vault-api based on the user's email/group membership.
"""

import requests
from .conftest import get_api_key_headers, get_api_base, TIMEOUT, log_info, API_KEYS


class Profile:
    """
    A test profile representing a user with a specific role.
    """
    def __init__(self, role, email):
        self.role = role
        self.email = email
        self._cached_session = None
    
    def headers(self):
        """Get auth headers for this profile."""
        return get_api_key_headers(self.role)
    
    def get_session(self, force_refresh=False):
        """Get session info from API for this profile."""
        if self._cached_session and not force_refresh:
            return self._cached_session
        
        try:
            resp = requests.get(
                f"{get_api_base()}/api/learner",
                headers=self.headers(),
                timeout=TIMEOUT
            )
            if resp.status_code == 200:
                self._cached_session = resp.json()
                return self._cached_session
        except Exception as e:
            log_info(f"Failed to get session for {self.role}: {e}")
        
        return None
    
    def clear_cache(self):
        """Clear cached session."""
        self._cached_session = None


# ============================================
# Pre-configured Profiles
# ============================================

STUDENT = Profile('student', 'matthieu.marielouise@komdab.net')
INSTRUCTOR = Profile('instructor', 'wayzate@gmail.com')
ADMIN = Profile('admin', 'matthieu.marielouise@gmail.com')


# ============================================
# Legacy Compatibility
# ============================================

class Profiles:
    """
    Legacy compatibility class.
    Use STUDENT, INSTRUCTOR, ADMIN profiles directly instead.
    """
    
    @classmethod
    def get_api_key_headers(cls):
        """Get API key auth headers (defaults to student)."""
        return STUDENT.headers()
    
    @classmethod
    def get_service_token_headers(cls):
        """Alias for get_api_key_headers."""
        return cls.get_api_key_headers()
    
    @classmethod
    def get_anonymous_headers(cls):
        """Get headers for unauthenticated requests."""
        return {}
    
    @classmethod
    def get_session(cls, force_refresh=False):
        """Get current session info (as student)."""
        return STUDENT.get_session(force_refresh)
    
    @classmethod
    def get_current_role(cls):
        """Get the role of the current profile."""
        return STUDENT.role
    
    @classmethod
    def clear_cache(cls):
        """Clear all cached sessions."""
        STUDENT.clear_cache()
        INSTRUCTOR.clear_cache()
        ADMIN.clear_cache()
    
    @classmethod
    def is_role(cls, *expected_roles):
        """Check if current role matches."""
        return STUDENT.role in expected_roles
    
    @classmethod
    def require_role(cls, *expected_roles):
        """Check if current role matches (for skipping tests)."""
        if STUDENT.role in expected_roles:
            return True, None
        return False, f"Test requires {expected_roles}, current is '{STUDENT.role}'"


def skip_unless_role(*roles):
    """
    Helper for skipping tests based on role.
    Usage: can_run, reason = skip_unless_role('admin')
    """
    return Profiles.require_role(*roles)
