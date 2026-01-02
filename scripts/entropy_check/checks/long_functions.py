"""
Long function check.
Detects functions exceeding line threshold.
"""

import re
from typing import List
from pathlib import Path

from ..config import FUNCTION_LENGTH_THRESHOLD
from ..models import FileInfo, Violation


def check_long_functions(files: List[FileInfo], root: Path) -> List[Violation]:
    """Check for functions exceeding line length threshold."""
    violations = []
    
    # Pattern for function declarations
    func_pattern = re.compile(
        r'(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{',
        re.MULTILINE
    )
    
    # Pattern for arrow functions
    arrow_pattern = re.compile(
        r'(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{',
        re.MULTILINE
    )
    
    for f in files:
        if f.path.suffix not in {'.js', '.ts'}:
            continue
        
        content = f.content
        lines = content.split('\n')
        
        for pattern in [func_pattern, arrow_pattern]:
            for match in pattern.finditer(content):
                name = match.group(1)
                start_pos = match.end() - 1
                
                # Find matching closing brace
                depth = 1
                pos = start_pos + 1
                while pos < len(content) and depth > 0:
                    if content[pos] == '{':
                        depth += 1
                    elif content[pos] == '}':
                        depth -= 1
                    pos += 1
                
                if depth == 0:
                    # Calculate line count
                    func_content = content[match.start():pos]
                    func_lines = len([l for l in func_content.split('\n') if l.strip()])
                    start_line = content[:match.start()].count('\n') + 1
                    
                    if func_lines > FUNCTION_LENGTH_THRESHOLD:
                        violations.append(Violation(
                            type='long_function',
                            severity='P2',
                            file=str(f.path.relative_to(root)),
                            detail=f"Function '{name}' has {func_lines} lines (threshold: {FUNCTION_LENGTH_THRESHOLD}) at line {start_line}"
                        ))
    
    return violations

