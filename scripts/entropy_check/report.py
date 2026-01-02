"""
Report generation for entropy checker.
Console and markdown output.
"""

from typing import List, Dict
from collections import defaultdict
from pathlib import Path

from .models import FileInfo, Violation, ImportGraph


def generate_markdown_report(
    root: Path,
    files: List[FileInfo],
    violations: List[Violation],
    graph: ImportGraph
) -> str:
    """Generate markdown report."""
    lines = [
        "# Entropy Check Report",
        "",
        f"**Path:** `{root}`",
        f"**Files analyzed:** {len(files)}",
        f"**Violations:** {len(violations)}",
        "",
    ]
    
    if not violations:
        lines.append("✅ **All checks passed!**")
        return '\n'.join(lines)
    
    # Group by type
    by_type: Dict[str, List[Violation]] = defaultdict(list)
    for v in violations:
        by_type[v.type].append(v)
    
    for vtype, type_violations in by_type.items():
        lines.append(f"## {vtype.replace('_', ' ').title()}")
        lines.append("")
        lines.append("| Severity | File | Detail |")
        lines.append("|----------|------|--------|")
        for v in type_violations:
            lines.append(f"| {v.severity} | `{v.file}` | {v.detail} |")
        lines.append("")
    
    # Add graph stats
    lines.append("## Import Graph Stats")
    lines.append("")
    lines.append(f"- **Total exports:** {sum(len(e) for e in graph.exports.values())}")
    lines.append(f"- **Total imports:** {sum(len(i) for i in graph.imports.values())}")
    lines.append(f"- **Used exports:** {len(graph.used_exports)}")
    lines.append("")
    
    return '\n'.join(lines)


def print_summary(violations: List[Violation]) -> None:
    """Print summary to console."""
    if not violations:
        print("\n✅ All entropy checks passed!")
        return
    
    print(f"\n❌ Found {len(violations)} violations:\n")
    
    for v in violations:
        icon = "🔴" if v.severity == 'P1' else ("🟡" if v.severity == 'P2' else "🔵")
        print(f"  {icon} [{v.type}] {v.file}")
        print(f"     {v.detail}")
    
    p1 = len([v for v in violations if v.severity == 'P1'])
    p2 = len([v for v in violations if v.severity == 'P2'])
    p3 = len([v for v in violations if v.severity == 'P3'])
    print(f"\n📊 Summary: {p1} P1, {p2} P2, {p3} P3")
