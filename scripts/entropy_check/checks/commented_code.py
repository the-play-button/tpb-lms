"""
Commented code block detection.
Finds large blocks of commented-out code.
"""

import re
from typing import List
from pathlib import Path

from ..config import COMMENTED_BLOCK_THRESHOLD
from ..models import FileInfo, Violation


def check_commented_code(files: List[FileInfo], root: Path) -> List[Violation]:
    """Check for large blocks of commented code."""
    violations = []
    
    for f in files:
        if f.path.suffix not in {'.js', '.ts', '.py'}:
            continue
        
        lines = f.content.split('\n')
        consecutive_comments = 0
        block_start = 0
        in_jsdoc = False
        
        for i, line in enumerate(lines):
            # Skip file headers (first 25 lines - typically docstrings)
            if i < 25:
                continue
            
            stripped = line.strip()
            
            # Track JSDoc blocks (/** ... */)
            if stripped.startswith('/**'):
                in_jsdoc = True
                continue
            if in_jsdoc:
                if stripped.endswith('*/') or stripped == '*/':
                    in_jsdoc = False
                continue  # Skip all lines inside JSDoc
            
            # Check for single-line comments (excluding JSDoc lines)
            is_comment = (
                stripped.startswith('//') or 
                stripped.startswith('#') or
                stripped.startswith('/*')
            )
            
            # Exclude documentation patterns
            is_doc = (
                stripped.startswith('///') or
                stripped.startswith('# -') or
                'license' in stripped.lower() or
                'copyright' in stripped.lower() or
                '@param' in stripped or
                '@returns' in stripped or
                '@type' in stripped
            )
            
            if is_comment and not is_doc:
                if consecutive_comments == 0:
                    block_start = i + 1
                consecutive_comments += 1
            else:
                if consecutive_comments >= COMMENTED_BLOCK_THRESHOLD:
                    violations.append(Violation(
                        type='commented_block',
                        severity='P3',
                        file=str(f.path.relative_to(root)),
                        detail=f"{consecutive_comments} consecutive comment lines starting at line {block_start}"
                    ))
                consecutive_comments = 0
        
        # Check final block
        if consecutive_comments >= COMMENTED_BLOCK_THRESHOLD:
            violations.append(Violation(
                type='commented_block',
                severity='P3',
                file=str(f.path.relative_to(root)),
                detail=f"{consecutive_comments} consecutive comment lines starting at line {block_start}"
            ))
    
    return violations

