#!/usr/bin/env python3
"""
LMS API Test Runner - Pentest Style

Runs all test modules in order:
1. Public endpoints (no auth)
2. Auth enforcement (verify protection)
3. RBAC Student (student role tests)
4. RBAC Instructor (instructor role tests)
5. RBAC Admin (admin role tests)
6. Horizontal isolation (user A vs B)
7. Feature tests (Pareto speedruns)
8. Entropy checks (code quality)

Usage:
    python run_all.py          # Test prod (default)
    python run_all.py --prod   # Test production
    python run_all.py --local  # Test localhost:8787
"""

import sys
import os
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tests.conftest import (
    Colors, log_pass, log_fail, log_skip, log_section, log_info,
    set_api_base, get_api_base, PROD_URL, LOCAL_URL
)
from tests.profiles import Profiles

# Import test modules
from tests import test_00_public
from tests import test_01_auth_enforcement
from tests import test_02_rbac_student
from tests import test_03_rbac_instructor
from tests import test_04_rbac_admin
from tests import test_05_isolation
from tests import test_06_features
from tests import test_07_entropy


def run_test_module(module_name, tests):
    """Run a list of tests and return (passed, failed) counts."""
    log_section(module_name)
    
    passed = 0
    failed = 0
    
    for name, test_fn in tests:
        try:
            test_fn()
            log_pass(name)
            passed += 1
        except AssertionError as e:
            log_fail(name, str(e))
            failed += 1
        except Exception as e:
            log_fail(name, f"{type(e).__name__}: {e}")
            failed += 1
    
    return passed, failed


def run_all_tests():
    """Run all test modules."""
    print(f"\n🧪 {Colors.CYAN}LMS API Tests - Pentest Style{Colors.END}")
    print(f"   Target: {get_api_base()}")
    print(f"   Timestamp: {datetime.now().isoformat()}")
    
    # Detect current role for informational purposes
    try:
        role = Profiles.get_current_role()
        log_info(f"Service Token role: {role}")
    except Exception as e:
        log_info(f"Could not detect role: {e}")
    
    total_passed = 0
    total_failed = 0
    
    # Test modules in order
    modules = [
        ("PUBLIC ENDPOINTS", test_00_public.get_tests()),
        ("AUTH ENFORCEMENT", test_01_auth_enforcement.get_tests()),
        ("RBAC: STUDENT", test_02_rbac_student.get_tests()),
        ("RBAC: INSTRUCTOR", test_03_rbac_instructor.get_tests()),
        ("RBAC: ADMIN", test_04_rbac_admin.get_tests()),
        ("HORIZONTAL ISOLATION", test_05_isolation.get_tests()),
        ("FEATURE TESTS", test_06_features.get_tests()),
        ("ENTROPY CHECKS", test_07_entropy.get_tests()),
    ]
    
    for module_name, tests in modules:
        passed, failed = run_test_module(module_name, tests)
        total_passed += passed
        total_failed += failed
    
    # Summary
    print(f"\n{'='*60}")
    if total_failed == 0:
        print(f"{Colors.GREEN}📊 ALL TESTS PASSED: {total_passed}/{total_passed + total_failed}{Colors.END}")
    else:
        print(f"{Colors.RED}📊 RESULTS: {total_passed} passed, {total_failed} failed{Colors.END}")
    print(f"{'='*60}")
    
    return total_failed == 0


def main():
    """Main entry point."""
    # Parse arguments
    if "--local" in sys.argv:
        set_api_base(LOCAL_URL)
        print(f"🏠 Testing LOCAL: {LOCAL_URL}")
    elif "--prod" in sys.argv:
        set_api_base(PROD_URL)
        print(f"🌐 Testing PROD: {PROD_URL}")
    else:
        print(f"🌐 Testing PROD (default): {PROD_URL}")
    
    success = run_all_tests()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

