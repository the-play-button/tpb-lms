"""
Dead code detection - unused exports.
"""

import re
from pathlib import Path
from typing import List, Callable

from ..config import ENTRY_POINTS
from ..models import FileInfo, Violation, ImportGraph


def check_dead_code(
    files: List[FileInfo],
    graph: ImportGraph,
    root: Path,
    log: Callable[[str], None] = lambda x: None
) -> List[Violation]:
    """Check for unused exports (dead code)."""
    violations = []
    
    for file_path, exports in graph.exports.items():
        # Skip entry points
        if file_path in ENTRY_POINTS:
            continue
        
        # Find the file content
        file_content = ""
        for f in files:
            try:
                if str(f.path.relative_to(root)) == file_path:
                    file_content = f.content
                    break
            except ValueError:
                continue
        
        for export in exports:
            key = (file_path, export.name)
            
            # Skip if already marked as used
            if key in graph.used_exports:
                continue
            
            # Skip CONSTANTS (ALL_CAPS)
            if export.name.isupper() or (export.name[0].isupper() and '_' in export.name):
                continue
            
            # Skip if used locally (count > 1 means used beyond export)
            occurrences = len(re.findall(rf'\b{re.escape(export.name)}\b', file_content))
            if occurrences > 1:
                log(f"Local usage found ({occurrences}x): {file_path}::{export.name}")
                continue
            
            # Check if file is imported anywhere
            file_imported = any(
                file_path in imp[1] 
                for imps in graph.imports.values() 
                for imp in imps
            )
            
            if file_imported:
                violations.append(Violation(
                    type='unused_export',
                    severity='P3',
                    file=file_path,
                    detail=f"Export '{export.name}' is never imported"
                ))
                log(f"Dead code: {file_path}::{export.name}")
    
    return violations

