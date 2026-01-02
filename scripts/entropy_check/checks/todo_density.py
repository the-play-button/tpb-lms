"""
TODO/FIXME density check.
Tracks technical debt markers.
"""

import re
from typing import List, Dict
from pathlib import Path
from collections import defaultdict

from ..models import FileInfo, Violation


# Technical debt markers
DEBT_MARKERS = ['TODO', 'FIXME', 'HACK', 'XXX', 'BUG', 'OPTIMIZE']
MARKER_PATTERN = re.compile(r'\b(' + '|'.join(DEBT_MARKERS) + r')\b', re.IGNORECASE)


def check_todo_density(files: List[FileInfo], root: Path) -> List[Violation]:
    """Check for TODO/FIXME markers and report density."""
    violations = []
    file_markers: Dict[str, List[tuple]] = defaultdict(list)
    
    for f in files:
        if f.path.suffix not in {'.js', '.ts', '.py'}:
            continue
        
        lines = f.content.split('\n')
        rel_path = str(f.path.relative_to(root))
        
        for i, line in enumerate(lines):
            matches = MARKER_PATTERN.findall(line)
            for marker in matches:
                file_markers[rel_path].append((marker.upper(), i + 1, line.strip()[:60]))
    
    # Report files with multiple markers
    for file_path, markers in file_markers.items():
        if len(markers) >= 3:  # Report if 3+ markers in one file
            marker_summary = ', '.join([f"{m[0]} (line {m[1]})" for m in markers[:5]])
            if len(markers) > 5:
                marker_summary += f" ... and {len(markers) - 5} more"
            
            violations.append(Violation(
                type='todo_density',
                severity='P3',
                file=file_path,
                detail=f"{len(markers)} debt markers: {marker_summary}"
            ))
    
    return violations

