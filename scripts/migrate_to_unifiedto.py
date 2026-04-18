# entropy-single-export-ok: CLI migration script with tightly-coupled helper functions for D1 queries and class migration
# entropy-console-leak-ok: print() in migrate_to_unifiedto for operator terminal output
#!/usr/bin/env python3
"""
Migrate LMS Data to Unified.to Conformity

This script migrates existing lms_class data to the new unified.to compliant format:
1. Reads step_type and content_md from each class
2. Stores them in raw_json under tpb_step_type and tpb_content_md
3. Updates media_json with unified.to compliant format (with url field)

Prerequisites:
- Run migration 004_unifiedto_conformity.sql first
- Have wrangler configured with access to lms-db

Usage:
    python migrate_to_unifiedto.py --dry-run    # Preview changes
    python migrate_to_unifiedto.py --execute    # Apply changes
"""

import argparse
import json
import subprocess
from pathlib import Path
from typing import Any

_CLI_SEPARATOR_WIDTH = 50  # entropy-python-magic-numbers-ok: display width constant in migrate_to_unifiedto for terminal formatting


def run_d1_query(sql: str, cwd: Path | None = None) -> dict[str, Any]:  # entropy-python-optional-handling-ok: cwd has fallback in subprocess call
    """Execute a D1 query via wrangler.

    Args:
        sql: SQL query string to execute.
        cwd: Working directory for the wrangler command.

    Returns:
        Parsed query result dict.
    """
    cmd = [
        "npx", "wrangler", "d1", "execute", "lms-db", "--remote",
        "--command", sql
    ]
    
    result = subprocess.run(
        cmd, 
        capture_output=True, 
        text=True, 
        cwd=cwd or Path(__file__).parent.parent
    )
    
    if result.returncode != 0:
        raise RuntimeError(f"D1 query failed: {result.stderr}")
    
    # Parse JSON output
    output = result.stdout
    json_start = output.find('[')
    if json_start == -1:
        return {"results": []}
    
    try:
        data = json.loads(output[json_start:])
        return data[0] if data else {"results": []}
    except json.JSONDecodeError:
        return {"results": []}


def run_d1_command(sql: str, cwd: Path | None = None) -> bool:  # entropy-python-optional-handling-ok: cwd has fallback in subprocess call
    """Execute a D1 command (INSERT/UPDATE) via wrangler.

    Args:
        sql: SQL command string to execute.
        cwd: Working directory for the wrangler command.

    Returns:
        True if the command succeeded.
    """
    cmd = [
        "npx", "wrangler", "d1", "execute", "lms-db", "--remote",
        "--command", sql
    ]
    
    result = subprocess.run(
        cmd, 
        capture_output=True, 
        text=True, 
        cwd=cwd or Path(__file__).parent.parent
    )
    
    if result.returncode != 0:
        print(f"⚠️ Command failed: {result.stderr}")
        return False
    
    return True


def fetch_classes() -> list[dict[str, Any]]:
    """Fetch all lms_class records."""
    sql = """
        SELECT id, course_id, name, step_type, content_md, media_json, raw_json, sys_order_index
        FROM lms_class
        ORDER BY course_id, sys_order_index
    """
    
    result = run_d1_query(sql)
    return result.get("results", [])


def migrate_class(cls: dict[str, Any], dry_run: bool = True) -> dict[str, Any]:  # entropy-python-long-function-ok + entropy-python-complexity-ok: orchestration with error handling paths
    """Migrate a single class to unified.to format.

    Args:
        cls: Class record dict from the database.
        dry_run: If True, preview changes without applying.

    Returns:
        Result dict with class ID, changes list, and status.
    """
    class_id = cls["id"]
    
    # Parse existing JSON fields
    media_json = cls.get("media_json") or "[]"
    raw_json = cls.get("raw_json") or "{}"
    
    try:
        media = json.loads(media_json) if isinstance(media_json, str) else media_json
    except json.JSONDecodeError:
        media = []
    
    try:
        raw = json.loads(raw_json) if isinstance(raw_json, str) else raw_json
    except json.JSONDecodeError:
        raw = {}
    
    changes = []
    
    # 1. Migrate step_type to raw_json.tpb_step_type
    step_type = cls.get("step_type", "CONTENT")
    if step_type and "tpb_step_type" not in raw:
        raw["tpb_step_type"] = step_type
        changes.append(f"Added tpb_step_type={step_type}")
    
    # 2. Migrate content_md to raw_json.tpb_content_md (if present)
    content_md = cls.get("content_md", "")
    if content_md and "tpb_content_md" not in raw:
        raw["tpb_content_md"] = content_md
        changes.append(f"Added tpb_content_md ({len(content_md)} chars)")
    
    # 3. Update media_json to unified.to format
    updated_media = []
    for m in media:
        new_m = dict(m)
        
        # Add url field for VIDEO with stream_id
        if m.get("type") == "VIDEO" and m.get("stream_id") and not m.get("url"):
            new_m["url"] = f"https://iframe.cloudflarestream.com/{m['stream_id']}"
            changes.append(f"Added VIDEO url for stream_id={m['stream_id']}")
        
        # Convert QUIZ to WEB with url
        if m.get("type") == "QUIZ" and m.get("tally_form_id") and not m.get("url"):
            new_m["type"] = "WEB"
            new_m["url"] = f"https://tally.so/r/{m['tally_form_id']}"
            changes.append(f"Converted QUIZ to WEB with tally_form_id={m['tally_form_id']}")
        
        updated_media.append(new_m)
    
    if not changes:
        return {"id": class_id, "changes": [], "skipped": True}
    
    # Build UPDATE SQL
    new_raw_json = json.dumps(raw, ensure_ascii=False)
    new_media_json = json.dumps(updated_media, ensure_ascii=False)
    
    # Escape single quotes for SQL
    new_raw_json_escaped = new_raw_json.replace("'", "''")
    new_media_json_escaped = new_media_json.replace("'", "''")
    
    sql = f"""
        UPDATE lms_class 
        SET raw_json = '{new_raw_json_escaped}',
            media_json = '{new_media_json_escaped}',
            updated_at = datetime('now')
        WHERE id = '{class_id}'
    """
    
    if dry_run:
        print(f"\n📝 {class_id}:")
        for change in changes:
            print(f"   • {change}")
    else:
        print(f"\n🔄 Migrating {class_id}...")
        if run_d1_command(sql):
            print(f"   ✓ Updated ({len(changes)} changes)")
        else:
            print(f"   ✗ Failed")
            return {"id": class_id, "changes": changes, "error": True}
    
    return {"id": class_id, "changes": changes}


def main() -> int:
    """ Parse CLI args and migrate LMS class data to unified.to format."""
    parser = argparse.ArgumentParser(description="Migrate LMS data to unified.to format")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without applying")
    parser.add_argument("--execute", action="store_true", help="Apply changes to database")
    args = parser.parse_args()
    
    if not args.dry_run and not args.execute:
        print("❌ Please specify --dry-run or --execute")
        return 1
    
    print("🔄 LMS Unified.to Migration")
    print("=" * _CLI_SEPARATOR_WIDTH)
    
    if args.dry_run:
        print("📋 DRY RUN - No changes will be made\n")
    else:
        print("⚠️  EXECUTING - Changes will be applied to database\n")
    
    # Fetch all classes
    print("📥 Fetching classes from D1...")
    try:
        classes = fetch_classes()
    except (RuntimeError, subprocess.SubprocessError, OSError) as e:  # entropy-python-error-handling-ok: CLI entry-point boundary
        print(f"❌ Failed to fetch classes: {e}")
        return 1
    
    print(f"   Found {len(classes)} classes\n")
    
    # Migrate each class
    results = []
    for cls in classes:
        result = migrate_class(cls, dry_run=args.dry_run)
        results.append(result)
    
    # Summary
    print("\n" + "=" * 50)  # entropy-python-magic-numbers-ok: display width constant in migrate_to_unifiedto for terminal formatting
    migrated = [r for r in results if not r.get("skipped")]
    skipped = [r for r in results if r.get("skipped")]
    errors = [r for r in results if r.get("error")]
    
    print(f"✅ Migrated: {len(migrated)}")
    print(f"⏭️  Skipped (already done): {len(skipped)}")
    print(f"❌ Errors: {len(errors)}")
    
    if args.dry_run and migrated:
        print(f"\n💡 Run with --execute to apply these {len(migrated)} changes")
    
    return 0


if __name__ == "__main__":
    exit(main())
