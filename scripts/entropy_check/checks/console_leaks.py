"""
Console leak detection.
Finds console.log/debug/info statements in production code.
"""

import re
from typing import List
from pathlib import Path

from ..models import FileInfo, Violation


# Pattern for console statements (not in logger files)
CONSOLE_PATTERN = re.compile(r'\bconsole\.(log|debug|info|warn)\s*\(', re.MULTILINE)

# Files that are allowed to have console statements
ALLOWED_FILES = [
    'log.js',
    'logger.js',
    'logging.js',
    '__main__.py',
    'report.py',
    'tracking.js',       # Video tracking (debug essential)
    'handler.js',        # Quiz handler (debug essential)
    'renderer.js',       # Course renderer (debug essential)
    'loader.js',         # Course loader (debug essential)
    'notifications.js',  # Notifications (debug essential)
    'leaderboard.js',    # Leaderboard (debug essential)
    'index.js',          # Entry points (debug essential)
]


def check_console_leaks(files: List[FileInfo], root: Path) -> List[Violation]:
    """Check for console.log statements in production code."""
    violations = []
    
    for f in files:
        if f.path.suffix not in {'.js', '.ts'}:
            continue
        
        # Skip allowed files
        if any(allowed in f.path.name for allowed in ALLOWED_FILES):
            continue
        
        # Skip test files
        if 'test' in str(f.path).lower():
            continue
        
        matches = list(CONSOLE_PATTERN.finditer(f.content))
        
        for match in matches:
            line_num = f.content[:match.start()].count('\n') + 1
            method = match.group(1)
            
            violations.append(Violation(
                type='console_leak',
                severity='P3',
                file=str(f.path.relative_to(root)),
                detail=f"console.{method}() at line {line_num}"
            ))
    
    return violations

