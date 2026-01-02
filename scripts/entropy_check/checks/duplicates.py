"""
Duplicate detection - files and functions.
"""

import re
from pathlib import Path
from typing import List, Dict
from collections import defaultdict

from ..models import FileInfo, Violation


def check_duplicate_files(files: List[FileInfo], root: Path) -> List[Violation]:
    """Check for duplicate files (same content, different paths)."""
    violations = []
    hash_to_files: Dict[str, List[Path]] = defaultdict(list)
    
    for f in files:
        if f.hash:
            hash_to_files[f.hash].append(f.path)
    
    for file_hash, paths in hash_to_files.items():
        if len(paths) > 1:
            rel_paths = [str(p.relative_to(root)) for p in paths]
            violations.append(Violation(
                type='duplicate_file',
                severity='P2',
                file=rel_paths[0],
                detail=f"Identical to: {', '.join(rel_paths[1:])}"
            ))
    
    return violations


def check_duplicate_functions(files: List[FileInfo], root: Path) -> List[Violation]:
    """Check for duplicate function definitions across files."""
    violations = []
    func_pattern = re.compile(
        r'(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}',
        re.MULTILINE
    )
    
    func_bodies: Dict[str, List[tuple]] = defaultdict(list)
    
    for f in files:
        if f.path.suffix in {'.js', '.ts'}:
            matches = func_pattern.findall(f.content)
            for name, body in matches:
                normalized = re.sub(r'\s+', ' ', body.strip())
                key = f"{name}:{normalized[:200]}"
                func_bodies[key].append((name, str(f.path.relative_to(root))))
    
    for key, occurrences in func_bodies.items():
        if len(occurrences) > 1:
            func_name = occurrences[0][0]
            file_list = [occ[1] for occ in occurrences]
            violations.append(Violation(
                type='duplicate_function',
                severity='P2',
                file=file_list[0],
                detail=f"Function '{func_name}' duplicated in: {', '.join(file_list[1:])}"
            ))
    
    return violations

