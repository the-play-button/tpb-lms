"""
Check registry - exports all available checks.
"""

from .line_count import check_line_counts
from .duplicates import check_duplicate_files, check_duplicate_functions
from .dead_code import check_dead_code
from .complexity import check_complexity
from .nesting import check_nesting
from .long_functions import check_long_functions
from .console_leaks import check_console_leaks
from .commented_code import check_commented_code
from .todo_density import check_todo_density
from .empty_catch import check_empty_catch
from .coupling import check_coupling
from .legacy_markers import check_legacy_markers

__all__ = [
    'check_line_counts',
    'check_duplicate_files',
    'check_duplicate_functions',
    'check_dead_code',
    'check_complexity',
    'check_nesting',
    'check_long_functions',
    'check_console_leaks',
    'check_commented_code',
    'check_todo_density',
    'check_empty_catch',
    'check_coupling',
    'check_legacy_markers',
]
