"""
Cyclomatic complexity check.
Counts decision points in functions.
"""

import re
from typing import List
from pathlib import Path

from ..config import COMPLEXITY_THRESHOLD
from ..models import FileInfo, Violation


# Decision point patterns (each adds 1 to complexity)
DECISION_PATTERNS = [
    r'\bif\s*\(',           # if statements
    r'\belse\s+if\s*\(',    # else if
    r'\bfor\s*\(',          # for loops
    r'\bwhile\s*\(',        # while loops
    r'\bswitch\s*\(',       # switch statements
    r'\bcase\s+',           # case clauses
    r'\bcatch\s*\(',        # catch blocks
    r'\?\s*[^:]+\s*:',      # ternary operators
    r'\&\&',                # logical AND
    r'\|\|',                # logical OR
    r'\?\?',                # nullish coalescing
]


def calculate_complexity(code: str) -> int:
    """Calculate cyclomatic complexity of a code block."""
    complexity = 1  # Base complexity
    
    for pattern in DECISION_PATTERNS:
        matches = re.findall(pattern, code)
        complexity += len(matches)
    
    return complexity


def extract_functions(content: str) -> List[tuple]:
    """Extract function definitions with their bodies."""
    functions = []
    
    # Pattern for function declarations
    func_pattern = re.compile(
        r'(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{',
        re.MULTILINE
    )
    
    # Pattern for arrow functions assigned to const
    arrow_pattern = re.compile(
        r'(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{',
        re.MULTILINE
    )
    
    for pattern in [func_pattern, arrow_pattern]:
        for match in pattern.finditer(content):
            name = match.group(1)
            start = match.end() - 1  # Position of opening brace
            
            # Find matching closing brace
            depth = 1
            pos = start + 1
            while pos < len(content) and depth > 0:
                if content[pos] == '{':
                    depth += 1
                elif content[pos] == '}':
                    depth -= 1
                pos += 1
            
            if depth == 0:
                body = content[start:pos]
                functions.append((name, body, match.start()))
    
    return functions


def check_complexity(files: List[FileInfo], root: Path) -> List[Violation]:
    """Check for functions with high cyclomatic complexity."""
    violations = []
    
    for f in files:
        if f.path.suffix not in {'.js', '.ts'}:
            continue
        
        functions = extract_functions(f.content)
        
        for name, body, pos in functions:
            complexity = calculate_complexity(body)
            
            if complexity > COMPLEXITY_THRESHOLD:
                # Calculate line number
                line_num = f.content[:pos].count('\n') + 1
                
                violations.append(Violation(
                    type='high_complexity',
                    severity='P2',
                    file=str(f.path.relative_to(root)),
                    detail=f"Function '{name}' has complexity {complexity} (threshold: {COMPLEXITY_THRESHOLD}) at line {line_num}"
                ))
    
    return violations

