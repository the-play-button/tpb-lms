# LMS Python Setup

## Quick Start

### 1. Create Virtual Environment
```bash
cd tpb_system/04.Execution/lms
python3 -m venv venv
```

### 2. Install Dependencies
```bash
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Test Setup
```bash
# Test a simple script
python scripts/devops/verify_deploy.py

# List available fixtures
python scripts/tests/fixtures.py --list
```

## One-Liner Execution

All Python scripts now include one-liner commands in their docstrings for easy copy-paste execution from the project root:

```bash
# Example: Test API endpoints
cd tpb_system/04.Execution/lms && source venv/bin/activate && python scripts/tests/test_api.py --prod

# Example: Reset database
cd tpb_system/04.Execution/lms && source venv/bin/activate && python scripts/tests/reset_db.py --verify
```

## Dependencies

- **requests**: HTTP client for API calls
- **httpx**: Async HTTP client (for vault_client)
- **PyYAML**: YAML parsing for SOM files and quiz configs
- **pytest**: Testing framework
- **orjson**: Fast JSON handling

## Scripts Overview

### 📁 DevOps (`scripts/devops/`)
- `check_secrets.py` - Verify Cloudflare Worker secrets
- `deploy.py` - Full deployment script
- `verify_deploy.py` - Post-deployment verification

### 📁 Tests (`scripts/tests/`)
- `test_api.py` - E2E API tests
- `reset_db.py` - Database reset utility
- `fixtures.py` - Test data fixtures
- `validate_state.py` - State validation

### 📁 Utilities (`scripts/`)
- `upload_course.py` - Course upload to D1
- `sync_tally_quiz.py` - Sync quizzes to Tally
- `parse_som.py` - Parse SOM folder structure
- `tally_webhook.py` - Tally webhook handler

### 📁 Code Quality (`tpb_sdk.entropy`)
- Comprehensive code quality audit tool (via TPB SDK)
- Detects complexity, duplicates, dead code, etc.
- Config: `.entropy.yaml` at project root





