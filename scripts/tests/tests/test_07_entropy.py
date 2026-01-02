"""
Entropy Tests

Code quality checks per directive 1.17.
Verifies no P1 (critical) entropy violations.
"""

import os
import subprocess


class TestEntropy:
    """Entropy checks to ensure code stays clean."""

    def test_entropy_violations(self):
        """Run entropy_check module and verify no P1 violations."""
        # Get paths
        script_dir = os.path.dirname(os.path.abspath(__file__))
        tests_dir = os.path.dirname(script_dir)  # tests/
        scripts_dir = os.path.dirname(tests_dir)  # scripts/
        lms_root = os.path.dirname(scripts_dir)  # lms/
        
        result = subprocess.run(
            ['python3', '-m', 'entropy_check', '--path', lms_root],
            capture_output=True,
            text=True,
            cwd=scripts_dir
        )
        
        # Check summary line for P1 count
        # Expected format: "📊 Summary: 0 P1, X P2, Y P3"
        import re
        summary_match = re.search(r'(\d+)\s+P1', result.stdout)
        
        if summary_match:
            p1_count = int(summary_match.group(1))
            if p1_count > 0:
                # Extract only P1 violations (🔴 markers)
                lines = result.stdout.split('\n')
                p1_lines = [l for l in lines if '🔴' in l]
                assert False, f"P1 entropy violations found ({p1_count}):\n" + "\n".join(p1_lines)
        # P2 and P3 are acceptable (warnings/info)


def get_tests():
    """Return list of test functions for runner."""
    instance = TestEntropy()
    return [
        ("Entropy violations check", instance.test_entropy_violations),
    ]

