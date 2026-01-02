"""
Line count check - files exceeding threshold.
"""

from typing import List
from ..models import FileInfo, Violation


def check_line_counts(files: List[FileInfo]) -> List[Violation]:
    """Check for files exceeding line thresholds."""
    violations = []
    
    for f in files:
        if f.lines > f.threshold:
            severity = 'P1' if f.lines > f.threshold * 1.5 else 'P2'
            violations.append(Violation(
                type='lines_exceeded',
                severity=severity,
                file=str(f.path),
                detail=f"{f.lines} lines (threshold: {f.threshold})"
            ))
    
    return violations

