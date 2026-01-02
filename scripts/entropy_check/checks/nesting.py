"""
Nesting depth check.
Detects deeply nested code blocks.
"""

import re
from typing import List
from pathlib import Path

from ..config import NESTING_THRESHOLD
from ..models import FileInfo, Violation


def calculate_max_nesting(code: str) -> tuple:
    """Calculate maximum nesting depth and the line where it occurs."""
    max_depth = 0
    current_depth = 0
    max_line = 1
    current_line = 1
    
    in_string = False
    string_char = None
    prev_char = None
    
    for char in code:
        if char == '\n':
            current_line += 1
        
        # Handle string literals
        if char in ('"', "'", '`') and prev_char != '\\':
            if not in_string:
                in_string = True
                string_char = char
            elif char == string_char:
                in_string = False
                string_char = None
        
        if not in_string:
            if char == '{':
                current_depth += 1
                if current_depth > max_depth:
                    max_depth = current_depth
                    max_line = current_line
            elif char == '}':
                current_depth = max(0, current_depth - 1)
        
        prev_char = char
    
    return max_depth, max_line


def check_nesting(files: List[FileInfo], root: Path) -> List[Violation]:
    """Check for deeply nested code."""
    violations = []
    
    for f in files:
        if f.path.suffix not in {'.js', '.ts'}:
            continue
        
        max_depth, line_num = calculate_max_nesting(f.content)
        
        if max_depth > NESTING_THRESHOLD:
            violations.append(Violation(
                type='deep_nesting',
                severity='P2',
                file=str(f.path.relative_to(root)),
                detail=f"Max nesting depth {max_depth} (threshold: {NESTING_THRESHOLD}) near line {line_num}"
            ))
    
    return violations

