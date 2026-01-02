"""
Configuration constants for entropy checker.
TPB Framework - Code quality thresholds and patterns.
"""

# Line count thresholds per file type
THRESHOLDS = {
    'backend': 500,      # JS files in backend/
    'frontend': 300,     # JS files in frontend/
    'css': 600,          # CSS files (per module, after split)
    'default': 500       # Other files
}

# Files/directories to ignore
IGNORE_PATTERNS = [
    'node_modules',
    '__pycache__',
    '.git',
    'yarn.lock',
    'package-lock.json',
    '.wrangler',
    'dist',
    'build',
    'entropy_check',  # Don't analyze ourselves
    '.venv',          # Python virtual environments
    'venv',
    'env',
    'site-packages',
    'vault-api'       # Separate subproject
]

# Extensions to analyze
ANALYZE_EXTENSIONS = {'.js', '.py', '.css', '.ts', '.jsx', '.tsx'}

# Cyclomatic complexity threshold (15 = pragmatic, 10 = strict)
COMPLEXITY_THRESHOLD = 15

# Nesting depth threshold (5 = pragmatic for try/catch handlers)
NESTING_THRESHOLD = 5

# Function length threshold (lines) - 60 is pragmatic for handlers
FUNCTION_LENGTH_THRESHOLD = 60

# Commented code block threshold (consecutive lines)
COMMENTED_BLOCK_THRESHOLD = 5

# Coupling threshold (imports per file)
COUPLING_THRESHOLD = 10

# Files allowed to have high coupling (entry points, orchestrators)
COUPLING_EXCEPTIONS = {
    'backend/index.js',
    'frontend/app/index.js',
}

# God file threshold (files importing this one)
GOD_FILE_THRESHOLD = 5

# Files expected to be "god files" (shared utilities by design)
GOD_FILE_EXCEPTIONS = {
    'backend/cors.js',           # CORS config used everywhere
    'frontend/app/api.js',       # API client used everywhere
    'frontend/app/state.js',     # State management (by design)
}

# Entry points that are always "used" for dead code detection
ENTRY_POINTS = {'backend/index.js', 'frontend/app/index.js', 'index.js'}
