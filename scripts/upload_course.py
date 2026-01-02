#!/usr/bin/env python3
"""
Upload Course to LMS D1 Database

Usage:
    python upload_course.py --config <path_to_course.json>
    python upload_course.py --config courses/wge-onboarding.json
    python upload_course.py --list
    python upload_course.py --delete <course_id>

One-liner (in Dev Container):
    python tpb_system/04.Execution/lms/scripts/upload_course.py --list
    python3 tpb_system/04.Execution/lms/scripts/upload_course.py   --config tpb_system/03.Orchestration/lms/courses/pw05-2.json

Directive: 02.Directives/lms/deploy_som_draft.md
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

# D1 Database configuration
DATABASE_NAME = "lms-db"
WRANGLER_DIR = Path(__file__).parent


def run_d1_command(sql: str, expect_results: bool = False) -> dict:
    """Execute SQL on D1 database."""
    cmd = [
        "npx", "wrangler", "d1", "execute", DATABASE_NAME,
        "--command", sql,
        "--remote"
    ]
    
    if expect_results:
        cmd.append("--json")
    
    # Set up environment for nvm
    env = os.environ.copy()
    
    result = subprocess.run(
        cmd,
        cwd=WRANGLER_DIR,
        capture_output=True,
        text=True,
        env=env
    )
    
    if result.returncode != 0:
        print(f"❌ D1 error: {result.stderr}")
        return None
    
    if expect_results:
        try:
            # Find JSON array in output (skip nvm messages)
            output = result.stdout
            start_idx = output.find('[')
            if start_idx >= 0:
                json_str = output[start_idx:]
                return json.loads(json_str)
        except json.JSONDecodeError as e:
            print(f"❌ JSON parse error: {e}")
            return None
    
    return {"success": True}


def escape_sql(value: str) -> str:
    """Escape single quotes for SQL."""
    if value is None:
        return "NULL"
    return value.replace("'", "''")


def upload_course(config_path: str):
    """Upload a course from JSON config to D1."""
    
    config_file = Path(config_path)
    if not config_file.exists():
        print(f"❌ Config file not found: {config_path}")
        sys.exit(1)
    
    with open(config_file) as f:
        course = json.load(f)
    
    course_id = course.get("id")
    if not course_id:
        print("❌ Course config must have 'id' field")
        sys.exit(1)
    
    # Support both 'name' and 'title' keys
    course_name = course.get("name") or course.get("title", "")
    print(f"📚 Uploading course: {course_name or course_id}")
    
    # 1. Insert/Update course
    categories_json = json.dumps(course.get("categories", []))
    
    course_sql = f"""
        INSERT INTO lms_course (id, name, description, categories_json, is_active, created_at, updated_at)
        VALUES (
            '{escape_sql(course_id)}',
            '{escape_sql(course_name)}',
            '{escape_sql(course.get("description", ""))}',
            '{escape_sql(categories_json)}',
            1,
            datetime('now'),
            datetime('now')
        )
        ON CONFLICT(id) DO UPDATE SET
            name = '{escape_sql(course_name)}',
            description = '{escape_sql(course.get("description", ""))}',
            categories_json = '{escape_sql(categories_json)}',
            updated_at = datetime('now');
    """
    
    result = run_d1_command(course_sql)
    if result is None:
        print("❌ Failed to insert course")
        sys.exit(1)
    
    print(f"  ✓ Course '{course_id}' created/updated")
    
    # 2. Insert classes
    classes = course.get("classes", [])
    for cls in classes:
        class_id = cls.get("id")
        if not class_id:
            print(f"  ⚠️ Skipping class without 'id'")
            continue
        
        media_json = json.dumps(cls.get("media", []))
        # Support both step_order (new) and order_index (old)
        order_idx = cls.get("step_order", cls.get("order_index", 0))
        
        # TPB-specific fields go in raw_json (Unified.to pattern)
        raw_data = {
            "tpb_step_type": cls.get("step_type", "VIDEO"),
            "tpb_step_order": order_idx,
            "tpb_content_md": cls.get("content_md", ""),
            "correct_answers": cls.get("correct_answers", {})  # Quiz correct answers
        }
        raw_json = json.dumps(raw_data)
        
        class_sql = f"""
            INSERT INTO lms_class (id, course_id, name, description, media_json, order_index, raw_json, created_at, updated_at)
            VALUES (
                '{escape_sql(class_id)}',
                '{escape_sql(course_id)}',
                '{escape_sql(cls.get("name", ""))}',
                '{escape_sql(cls.get("description", ""))}',
                '{escape_sql(media_json)}',
                {order_idx},
                '{escape_sql(raw_json)}',
                datetime('now'),
                datetime('now')
            )
            ON CONFLICT(id) DO UPDATE SET
                name = '{escape_sql(cls.get("name", ""))}',
                description = '{escape_sql(cls.get("description", ""))}',
                media_json = '{escape_sql(media_json)}',
                order_index = {order_idx},
                raw_json = '{escape_sql(raw_json)}',
                updated_at = datetime('now');
        """
        
        result = run_d1_command(class_sql)
        if result is None:
            print(f"  ❌ Failed to insert class '{class_id}'")
        else:
            print(f"  ✓ Class '{cls.get('name', class_id)}' [{raw_data['tpb_step_type']}]")
    
    print(f"\n✅ Course '{course.get('name', course_id)}' deployed with {len(classes)} classes")
    print(f"   View at: https://lms-viewer.matthieu-marielouise.workers.dev/?som={course_id}")


def list_courses():
    """List all courses in D1."""
    sql = "SELECT id, name, is_active, created_at FROM lms_course ORDER BY name;"
    result = run_d1_command(sql, expect_results=True)
    
    if result and isinstance(result, list) and len(result) > 0:
        courses = result[0].get("results", [])
        if courses:
            print("📚 Courses in LMS:")
            for c in courses:
                status = "✓" if c.get("is_active") else "○"
                print(f"  {status} {c.get('id')}: {c.get('name')}")
            
            # Also list classes
            class_sql = "SELECT course_id, id, name, order_index FROM lms_class ORDER BY course_id, order_index;"
            class_result = run_d1_command(class_sql, expect_results=True)
            if class_result and isinstance(class_result, list) and len(class_result) > 0:
                classes = class_result[0].get("results", [])
                if classes:
                    print("\n📖 Classes:")
                    current_course = None
                    for cls in classes:
                        if cls.get("course_id") != current_course:
                            current_course = cls.get("course_id")
                            print(f"\n  [{current_course}]")
                        print(f"    {cls.get('order_index', 0)}. {cls.get('name')}")
        else:
            print("📚 No courses found")
    else:
        print("❌ Failed to list courses")


def delete_course(course_id: str):
    """Delete a course and its classes from D1."""
    print(f"🗑️ Deleting course: {course_id}")
    
    # Delete classes first (foreign key)
    class_sql = f"DELETE FROM lms_class WHERE course_id = '{escape_sql(course_id)}';"
    run_d1_command(class_sql)
    print(f"  ✓ Classes deleted")
    
    # Delete course
    course_sql = f"DELETE FROM lms_course WHERE id = '{escape_sql(course_id)}';"
    result = run_d1_command(course_sql)
    
    if result:
        print(f"✅ Course '{course_id}' deleted")
    else:
        print(f"❌ Failed to delete course")


def main():
    parser = argparse.ArgumentParser(
        description="Upload courses to LMS D1 database",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python upload_course.py --config ../../../03.Orchestration/lms/courses/wge-onboarding.json
  python upload_course.py --list
  python upload_course.py --delete wge-onboarding
        """
    )
    
    parser.add_argument("--config", "-c", help="Path to course JSON config file")
    parser.add_argument("--list", "-l", action="store_true", help="List all courses")
    parser.add_argument("--delete", "-d", metavar="COURSE_ID", help="Delete a course")
    
    args = parser.parse_args()
    
    if args.list:
        list_courses()
    elif args.delete:
        delete_course(args.delete)
    elif args.config:
        upload_course(args.config)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
