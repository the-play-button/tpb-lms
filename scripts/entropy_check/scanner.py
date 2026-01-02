"""
File scanner for entropy checker.
Handles file discovery, hashing, and line counting.
"""

import hashlib
from pathlib import Path
from typing import List, Callable

from .config import THRESHOLDS, IGNORE_PATTERNS, ANALYZE_EXTENSIONS
from .models import FileInfo


def should_ignore(path: Path) -> bool:
    """Check if path should be ignored."""
    path_str = str(path)
    return any(pattern in path_str for pattern in IGNORE_PATTERNS)


def get_threshold(path: Path) -> int:
    """Get line threshold for file type."""
    path_str = str(path)
    
    if path.suffix == '.css':
        return THRESHOLDS['css']
    elif 'backend/' in path_str or 'worker_api/' in path_str:
        return THRESHOLDS['backend']
    elif 'frontend/' in path_str:
        return THRESHOLDS['frontend']
    else:
        return THRESHOLDS['default']


def hash_file(path: Path) -> str:
    """Calculate SHA256 hash of file content."""
    try:
        content = path.read_bytes()
        return hashlib.sha256(content).hexdigest()[:16]
    except Exception:
        return ""


def count_lines(path: Path) -> int:
    """Count non-empty lines in file."""
    try:
        content = path.read_text(encoding='utf-8')
        return len([l for l in content.split('\n') if l.strip()])
    except Exception:
        return 0


def read_content(path: Path) -> str:
    """Read file content safely."""
    try:
        return path.read_text(encoding='utf-8')
    except Exception:
        return ""


def scan_files(root: Path, log: Callable[[str], None] = lambda x: None) -> List[FileInfo]:
    """Scan all relevant files in the codebase."""
    files = []
    
    for path in root.rglob('*'):
        if path.is_file() and not should_ignore(path):
            if path.suffix in ANALYZE_EXTENSIONS:
                content = read_content(path)
                files.append(FileInfo(
                    path=path,
                    lines=len([l for l in content.split('\n') if l.strip()]),
                    hash=hash_file(path),
                    threshold=get_threshold(path),
                    content=content
                ))
                log(f"Scanned: {path}")
    
    return files
