"""
Legacy Code Detection

Detects semantic markers indicating:
- Legacy/deprecated code
- Old implementations kept "just in case"
- TODOs and FIXMEs not addressed
- Backup/unused code blocks
- Temporary hacks

Priority: P2 (should be addressed before production)
"""

import re
from typing import List
from ..models import FileInfo, Violation

# Patterns that indicate legacy/removable code
LEGACY_PATTERNS = [
    # Direct legacy markers
    (r'\b(legacy|LEGACY)\b', 'legacy marker'),
    (r'\b(deprecated|DEPRECATED)\b', 'deprecated marker'),
    (r'\b(obsolete|OBSOLETE)\b', 'obsolete marker'),
    
    # Old code kept around
    (r'\bold[_-]?(code|impl|version|api|endpoint|handler)\b', 'old code reference'),
    (r'\b(previous|prev)[_-]?(version|impl|code)\b', 'previous version reference'),
    (r'v[0-9]+[_-]?(old|legacy|deprecated)', 'versioned legacy marker'),
    
    # Backup/unused markers
    (r'\b(backup|BACKUP)[_-]?\b', 'backup marker'),
    (r'\bunused[_-]?\b', 'unused marker'),
    (r'\b(dead[_-]?code|DEAD[_-]?CODE)\b', 'dead code marker'),
    
    # Deletion markers
    (r'\b(to[_-]?delete|TO[_-]?DELETE)\b', 'to-delete marker'),
    (r'\b(remove[_-]?me|REMOVE[_-]?ME)\b', 'remove-me marker'),
    (r'\b(delete[_-]?this|DELETE[_-]?THIS)\b', 'delete-this marker'),
    (r'\b(can[_-]?be[_-]?removed)\b', 'can-be-removed marker'),
    
    # Temporary code
    (r'\b(temp|TEMP|temporary|TEMPORARY)\b(?![a-zA-Z])', 'temporary marker'),
    (r'\b(hack|HACK)\b', 'hack marker'),
    (r'\b(workaround|WORKAROUND)\b', 'workaround marker'),
    (r'\b(hotfix|HOTFIX)\b(?![a-zA-Z])', 'hotfix marker'),
    (r'\b(quick[_-]?fix|QUICK[_-]?FIX)\b', 'quick-fix marker'),
    
    # TODO/FIXME with urgency indicators
    (r'TODO[:\s]*(urgent|asap|now|important|critical|p0|p1)', 'urgent TODO'),
    (r'FIXME[:\s]*(urgent|asap|now|important|critical|p0|p1)', 'urgent FIXME'),
    # XXX only when standalone (not _xxx placeholder like contact_xxx)
    (r'(?<![_a-zA-Z])XXX(?![_a-zA-Z0-9])', 'XXX marker (needs attention)'),
    
    # Commented out code markers (word boundary to avoid "Older" matching "old")
    (r'//\s*\b(old|legacy|deprecated|backup)\b', 'commented legacy reference'),
    (r'#\s*\b(old|legacy|deprecated|backup)\b', 'commented legacy reference'),
    
    # Keep-for-reference patterns (anti-pattern)
    (r'\b(keep[_-]?for[_-]?reference)\b', 'keep-for-reference marker'),
    (r'\b(just[_-]?in[_-]?case)\b', 'just-in-case marker'),
    (r'\b(might[_-]?need[_-]?later)\b', 'might-need-later marker'),
    
    # Backward compatibility that should be removed
    (r'\b(backward[_-]?compat|backwards[_-]?compat)\b', 'backward compatibility marker'),
    (r'\b(for[_-]?backwards?[_-]?compatibility)\b', 'backward compatibility marker'),
]

# File name patterns that indicate legacy
LEGACY_FILE_PATTERNS = [
    r'\.old\.',
    r'\.bak\.',
    r'\.backup\.',
    r'_old\.',
    r'_backup\.',
    r'_legacy\.',
    r'_deprecated\.',
    r'\.orig\.',
    r'_v[0-9]+\.',  # versioned files like handler_v1.js
    r'\.copy\.',
]

# Exceptions - patterns in these contexts are OK
EXCEPTION_PATTERNS = [
    r'backward.?compat.+comment',  # Documenting why backward compat exists
    r'migration.+from.+legacy',  # Migration documentation
    r'deprecated.+since',  # Proper deprecation notices
    r'["\'].*xxx.*["\']',  # Placeholders in strings like "contact_xxx"
    r'/path/to/',  # Example paths in docs
]


def check_legacy_markers(files: List[FileInfo]) -> List[Violation]:
    """Check for legacy code markers that should be cleaned up."""
    violations = []
    
    for file_info in files:
        file_path_str = str(file_info.path)
        
        # Check file name for legacy patterns
        for pattern in LEGACY_FILE_PATTERNS:
            if re.search(pattern, file_path_str, re.IGNORECASE):
                violations.append(Violation(
                    type='legacy_file',
                    severity='P2',
                    file=file_path_str,
                    detail=f"File name suggests legacy/backup code"
                ))
                break
        
        # Check file content for legacy patterns
        try:
            with open(file_info.path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
        except Exception:
            continue
        
        for line_num, line in enumerate(lines, 1):
            # Skip if line matches exception patterns
            if any(re.search(ep, line, re.IGNORECASE) for ep in EXCEPTION_PATTERNS):
                continue
            
            for pattern, marker_type in LEGACY_PATTERNS:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    # Get context (the matched text)
                    context = line.strip()[:80]
                    if len(line.strip()) > 80:
                        context += '...'
                    
                    violations.append(Violation(
                        type='legacy_marker',
                        severity='P2',
                        file=file_path_str,
                        detail=f"Line {line_num}: {marker_type} - {context}"
                    ))
                    break  # One violation per line max
    
    return violations

