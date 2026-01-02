"""
Data models for entropy checker.
Pure dataclasses - no business logic.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Set, Tuple
from collections import defaultdict


@dataclass
class FileInfo:
    """Information about an analyzed file."""
    path: Path
    lines: int
    hash: str
    threshold: int
    content: str = ""


@dataclass
class Violation:
    """A code quality violation."""
    type: str
    severity: str  # P1, P2, P3
    file: str
    detail: str


@dataclass
class ExportInfo:
    """Information about an export."""
    name: str
    file: str
    is_default: bool = False


@dataclass
class FunctionInfo:
    """Information about a function for analysis."""
    name: str
    file: str
    start_line: int
    end_line: int
    body: str
    complexity: int = 0
    max_nesting: int = 0


@dataclass
class ImportGraph:
    """Graph structure for tracking imports/exports."""
    # Map: file -> list of exports
    exports: Dict[str, List[ExportInfo]] = field(default_factory=lambda: defaultdict(list))
    # Map: file -> list of (imported_name, from_file)
    imports: Dict[str, List[Tuple[str, str]]] = field(default_factory=lambda: defaultdict(list))
    # Set of all used exports: (file, export_name)
    used_exports: Set[Tuple[str, str]] = field(default_factory=set)
    # Map: file -> list of files that import it
    imported_by: Dict[str, List[str]] = field(default_factory=lambda: defaultdict(list))
