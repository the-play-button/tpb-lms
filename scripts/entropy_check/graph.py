"""
Import graph builder for dead code detection.
Parses JS/TS files to build import/export relationships.
"""

import re
from pathlib import Path
from typing import List, Callable

from .models import FileInfo, ImportGraph, ExportInfo


# Regex patterns for JS/TS parsing
EXPORT_NAMED = re.compile(r'export\s+(?:async\s+)?(?:function|const|let|var|class)\s+(\w+)')
EXPORT_DEFAULT = re.compile(r'export\s+default\s+(?:function\s+)?(\w+)?')
EXPORT_FROM = re.compile(r"export\s*\{([^}]+)\}\s*from\s*['\"]([^'\"]+)['\"]")
IMPORT_NAMED = re.compile(r"import\s*\{([^}]+)\}\s*from\s*['\"]([^'\"]+)['\"]")
IMPORT_DEFAULT = re.compile(r"import\s+(\w+)\s+from\s*['\"]([^'\"]+)['\"]")
IMPORT_ALL = re.compile(r"import\s*\*\s*as\s+(\w+)\s+from\s*['\"]([^'\"]+)['\"]")
WINDOW_EXPOSE = re.compile(r'window\.(\w+)\s*=\s*(\w+)')


def resolve_import_path(from_file: Path, import_path: str, root: Path) -> str:
    """Resolve relative import path to absolute path."""
    if not import_path.startswith('.'):
        return import_path  # External package
    
    # Resolve relative path
    base_dir = from_file.parent
    resolved = (base_dir / import_path).resolve()
    
    # Try with .js extension
    if not resolved.exists():
        for ext in ['.js', '.ts', '/index.js', '/index.ts']:
            test_path = Path(str(resolved) + ext)
            if test_path.exists():
                resolved = test_path
                break
    
    try:
        return str(resolved.relative_to(root))
    except ValueError:
        return import_path


def build_import_graph(
    files: List[FileInfo], 
    root: Path,
    log: Callable[[str], None] = lambda x: None
) -> ImportGraph:
    """Build import/export graph from file list."""
    graph = ImportGraph()
    
    for f in files:
        if f.path.suffix not in {'.js', '.ts'}:
            continue
        
        content = f.content
        rel_path = str(f.path.relative_to(root))
        
        # Find named exports
        for match in EXPORT_NAMED.finditer(content):
            export_name = match.group(1)
            graph.exports[rel_path].append(
                ExportInfo(name=export_name, file=rel_path)
            )
            log(f"Export: {rel_path} -> {export_name}")
        
        # Find default exports
        named_exports = {e.name for e in graph.exports[rel_path]}
        for match in EXPORT_DEFAULT.finditer(content):
            export_name = match.group(1) or 'default'
            if export_name not in named_exports:
                graph.exports[rel_path].append(
                    ExportInfo(name=export_name, file=rel_path, is_default=True)
                )
        
        # Find named imports
        for match in IMPORT_NAMED.finditer(content):
            imports_str = match.group(1)
            from_path = match.group(2)
            resolved = resolve_import_path(f.path, from_path, root)
            
            for imp in imports_str.split(','):
                imp = imp.strip()
                if ' as ' in imp:
                    imp = imp.split(' as ')[0].strip()
                if imp:
                    graph.imports[rel_path].append((imp, resolved))
                    graph.used_exports.add((resolved, imp))
                    graph.imported_by[resolved].append(rel_path)
                    log(f"Import: {rel_path} <- {imp} from {resolved}")
        
        # Find default imports
        for match in IMPORT_DEFAULT.finditer(content):
            imp_name = match.group(1)
            from_path = match.group(2)
            resolved = resolve_import_path(f.path, from_path, root)
            graph.imports[rel_path].append((imp_name, resolved))
            graph.used_exports.add((resolved, 'default'))
            graph.used_exports.add((resolved, imp_name))
            graph.imported_by[resolved].append(rel_path)
        
        # Find * imports (marks all exports as used)
        for match in IMPORT_ALL.finditer(content):
            from_path = match.group(2)
            resolved = resolve_import_path(f.path, from_path, root)
            for exp in graph.exports.get(resolved, []):
                graph.used_exports.add((resolved, exp.name))
            graph.imported_by[resolved].append(rel_path)
        
        # Find window.X = X (frontend global exposure)
        for match in WINDOW_EXPOSE.finditer(content):
            func_name = match.group(2)
            graph.used_exports.add((rel_path, func_name))
            log(f"Window exposed: {rel_path} -> {func_name}")
    
    return graph
