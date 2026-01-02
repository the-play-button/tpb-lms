"""
TPB Entropy Checker - Modular code quality analysis.

Detects code entropy to keep codebase clean:
- Line count violations
- Duplicate files and functions
- Dead code (unused exports)
- High cyclomatic complexity
- Deep nesting
- Long functions
- Console.log leaks
- Commented code blocks
- TODO/FIXME density
- Empty catch blocks
- High coupling / god files
- Legacy/deprecated code markers

Usage:
    python -m entropy_check [--path PATH] [--report] [--verbose]
"""

from pathlib import Path
from typing import List, Optional

from .models import FileInfo, Violation, ImportGraph
from .scanner import scan_files
from .graph import build_import_graph
from .report import generate_markdown_report, print_summary
from .checks import (
    check_line_counts,
    check_duplicate_files,
    check_duplicate_functions,
    check_dead_code,
    check_complexity,
    check_nesting,
    check_long_functions,
    check_console_leaks,
    check_commented_code,
    check_todo_density,
    check_empty_catch,
    check_coupling,
    check_legacy_markers,
)


class EntropyChecker:
    """Main facade for entropy checking."""
    
    def __init__(self, root_path: Path, verbose: bool = False):
        self.root = root_path
        self.verbose = verbose
        self.files: List[FileInfo] = []
        self.violations: List[Violation] = []
        self.graph: ImportGraph = ImportGraph()
    
    def log(self, msg: str) -> None:
        """Print if verbose mode."""
        if self.verbose:
            print(f"   {msg}")
    
    def run_all_checks(self) -> bool:
        """Run all entropy checks. Returns True if no violations."""
        print("🔍 Scanning files...")
        self.files = scan_files(self.root, self.log)
        print(f"   Found {len(self.files)} files to analyze")
        
        print("📏 Checking line counts...")
        self.violations.extend(check_line_counts(self.files))
        
        print("📋 Checking duplicate files...")
        self.violations.extend(check_duplicate_files(self.files, self.root))
        
        print("🔄 Checking duplicate functions...")
        self.violations.extend(check_duplicate_functions(self.files, self.root))
        
        print("🔗 Building import graph...")
        self.graph = build_import_graph(self.files, self.root, self.log)
        
        print("💀 Checking dead code...")
        self.violations.extend(check_dead_code(self.files, self.graph, self.root, self.log))
        
        print("🧮 Checking cyclomatic complexity...")
        self.violations.extend(check_complexity(self.files, self.root))
        
        print("📐 Checking nesting depth...")
        self.violations.extend(check_nesting(self.files, self.root))
        
        print("📏 Checking function lengths...")
        self.violations.extend(check_long_functions(self.files, self.root))
        
        print("🖥️  Checking console leaks...")
        self.violations.extend(check_console_leaks(self.files, self.root))
        
        print("💬 Checking commented code blocks...")
        self.violations.extend(check_commented_code(self.files, self.root))
        
        print("📝 Checking TODO density...")
        self.violations.extend(check_todo_density(self.files, self.root))
        
        print("🚫 Checking empty catch blocks...")
        self.violations.extend(check_empty_catch(self.files, self.root))
        
        print("🔌 Checking coupling...")
        self.violations.extend(check_coupling(self.files, self.graph, self.root))
        
        print("🗑️  Checking legacy markers...")
        self.violations.extend(check_legacy_markers(self.files))
        
        return len(self.violations) == 0
    
    def get_report(self) -> str:
        """Generate markdown report."""
        return generate_markdown_report(self.root, self.files, self.violations, self.graph)
    
    def print_summary(self) -> None:
        """Print summary to console."""
        print_summary(self.violations)


__all__ = ['EntropyChecker']
