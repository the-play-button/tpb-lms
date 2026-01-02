"""
Empty catch block detection.
Finds silently swallowed errors.
"""

import re
from typing import List
from pathlib import Path

from ..models import FileInfo, Violation


# Pattern for empty catch blocks (with optional whitespace/comments only)
EMPTY_CATCH_PATTERN = re.compile(
    r'catch\s*\([^)]*\)\s*\{\s*(?://[^\n]*)?\s*\}',
    re.MULTILINE
)

# Pattern for catch with only comment
COMMENT_ONLY_CATCH = re.compile(
    r'catch\s*\([^)]*\)\s*\{\s*(?:/\*[^*]*\*/|//[^\n]*)\s*\}',
    re.MULTILINE
)


def check_empty_catch(files: List[FileInfo], root: Path) -> List[Violation]:
    """Check for empty or comment-only catch blocks."""
    violations = []
    
    for f in files:
        if f.path.suffix not in {'.js', '.ts'}:
            continue
        
        content = f.content
        
        for match in EMPTY_CATCH_PATTERN.finditer(content):
            line_num = content[:match.start()].count('\n') + 1
            
            violations.append(Violation(
                type='empty_catch',
                severity='P2',
                file=str(f.path.relative_to(root)),
                detail=f"Empty catch block at line {line_num} - errors silently swallowed"
            ))
        
        # Also check for catch with only comments (different from above pattern)
        for match in COMMENT_ONLY_CATCH.finditer(content):
            # Avoid duplicates if already caught by empty pattern
            line_num = content[:match.start()].count('\n') + 1
            already_reported = any(
                v.file == str(f.path.relative_to(root)) and 
                f"line {line_num}" in v.detail 
                for v in violations
            )
            
            if not already_reported:
                violations.append(Violation(
                    type='empty_catch',
                    severity='P2',
                    file=str(f.path.relative_to(root)),
                    detail=f"Catch block with only comment at line {line_num}"
                ))
    
    return violations

