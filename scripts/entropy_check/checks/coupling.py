"""
Coupling analysis.
Detects files with too many imports or that are imported by too many others.
"""

from typing import List
from pathlib import Path

from ..config import (
    COUPLING_THRESHOLD, GOD_FILE_THRESHOLD,
    COUPLING_EXCEPTIONS, GOD_FILE_EXCEPTIONS
)
from ..models import FileInfo, Violation, ImportGraph


def _matches_exception(file_path: str, exceptions: set) -> bool:
    """Check if file matches any exception pattern."""
    for exc in exceptions:
        if file_path.endswith(exc) or exc in file_path:
            return True
    return False


def check_coupling(
    files: List[FileInfo],
    graph: ImportGraph,
    root: Path
) -> List[Violation]:
    """Check for high coupling (many imports or god files)."""
    violations = []
    
    # Check files with too many imports
    for file_path, imports in graph.imports.items():
        # Skip exceptions (entry points are expected to import many files)
        if _matches_exception(file_path, COUPLING_EXCEPTIONS):
            continue
            
        unique_sources = set(imp[1] for imp in imports if not imp[1].startswith('node_modules'))
        
        if len(unique_sources) > COUPLING_THRESHOLD:
            violations.append(Violation(
                type='high_coupling',
                severity='P3',
                file=file_path,
                detail=f"Imports from {len(unique_sources)} different files (threshold: {COUPLING_THRESHOLD})"
            ))
    
    # Check for god files (imported by too many others)
    for file_path, importers in graph.imported_by.items():
        # Skip exceptions (shared utilities are expected to be imported everywhere)
        if _matches_exception(file_path, GOD_FILE_EXCEPTIONS):
            continue
            
        unique_importers = set(importers)
        
        if len(unique_importers) > GOD_FILE_THRESHOLD:
            violations.append(Violation(
                type='god_file',
                severity='P3',
                file=file_path,
                detail=f"Imported by {len(unique_importers)} files (threshold: {GOD_FILE_THRESHOLD})"
            ))
    
    return violations

