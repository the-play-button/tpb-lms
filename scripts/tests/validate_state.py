#!/usr/bin/env python3
"""
validate_state.py - Verify DB state after human testing

Queries the D1 database via wrangler to validate expected state
after manual testing scenarios.

Usage:
    python3 scripts/tests/validate_state.py fresh_user
    python3 scripts/tests/validate_state.py video_resume
    python3 scripts/tests/validate_state.py quiz_complete
    python3 scripts/tests/validate_state.py --list

One-liner (in Dev Container):
    cd 04.Execution/lms && python scripts/tests/validate_state.py --list

Scenarios:
    fresh_user    - Verify clean slate (no progress, no events)
    video_resume  - Verify video position saved
    quiz_complete - Verify quiz submitted and badges awarded
    step_progress - Verify step completion state
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Optional, Dict, Any, List

# Colors
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
DIM = "\033[2m"
RESET = "\033[0m"

# Project root
LMS_ROOT = Path(__file__).parent.parent.parent


def log(msg: str, level: str = "info"):
    """Print colored log message."""
    colors = {"info": CYAN, "success": GREEN, "warn": YELLOW, "error": RED, "dim": DIM}
    print(f"{colors.get(level, RESET)}{msg}{RESET}")


def run_sql(query: str) -> Optional[List[Dict[str, Any]]]:
    """Execute SQL query via wrangler and return results."""
    cmd = [
        "npx", "wrangler", "d1", "execute", "lms-db",
        "--remote", "--command", query
    ]
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=LMS_ROOT,
            timeout=30
        )
        
        if result.returncode != 0:
            log(f"SQL error: {result.stderr}", "error")
            return None
        
        # Parse JSON output from wrangler
        output = result.stdout + result.stderr
        lines = output.split('\n')
        
        for i, line in enumerate(lines):
            if line.strip().startswith('['):
                json_str = '\n'.join(lines[i:])
                try:
                    data = json.loads(json_str)
                    if data and data[0].get('results'):
                        return data[0]['results']
                    return []
                except json.JSONDecodeError:
                    pass
        
        return []
        
    except subprocess.TimeoutExpired:
        log("Query timed out", "error")
        return None
    except Exception as e:
        log(f"Error: {e}", "error")
        return None


def get_user_id() -> Optional[str]:
    """Get the latest user_id from database."""
    results = run_sql(
        "SELECT user_id FROM v_user_progress ORDER BY updated_at DESC LIMIT 1;"
    )
    if results and len(results) > 0:
        return results[0].get('user_id')
    return None


# =============================================================================
# VALIDATION SCENARIOS
# =============================================================================

def validate_fresh_user(user_id: str) -> bool:
    """Validate fresh user state (clean_slate fixture)."""
    log("\n🔍 Validating: Fresh User State", "info")
    
    all_pass = True
    
    # Check no progress
    progress = run_sql(f"""
        SELECT COUNT(*) as count FROM v_user_progress 
        WHERE user_id = '{user_id}'
    """)
    
    progress_count = progress[0]['count'] if progress else 0
    if progress_count == 0:
        log("  ✅ No progress records (expected)", "success")
    else:
        log(f"  ❌ Found {progress_count} progress records (expected 0)", "error")
        all_pass = False
    
    # Check no events
    events = run_sql(f"""
        SELECT COUNT(*) as count FROM lms_event 
        WHERE user_id = '{user_id}'
    """)
    
    event_count = events[0]['count'] if events else 0
    if event_count == 0:
        log("  ✅ No event records (expected)", "success")
    else:
        log(f"  ❌ Found {event_count} event records (expected 0)", "error")
        all_pass = False
    
    # Check no badges
    badges = run_sql(f"""
        SELECT COUNT(*) as count FROM gamification_award 
        WHERE user_id = '{user_id}'
    """)
    
    badge_count = badges[0]['count'] if badges else 0
    if badge_count == 0:
        log("  ✅ No badge awards (expected)", "success")
    else:
        log(f"  ❌ Found {badge_count} badge awards (expected 0)", "error")
        all_pass = False
    
    return all_pass


def validate_video_resume(user_id: str) -> bool:
    """Validate video resume state (video position saved)."""
    log("\n🔍 Validating: Video Resume State", "info")
    
    all_pass = True
    
    # Check video position exists
    positions = run_sql(f"""
        SELECT class_id, video_max_position_sec, video_duration_sec
        FROM v_user_progress 
        WHERE user_id = '{user_id}' AND video_max_position_sec > 0
        ORDER BY updated_at DESC LIMIT 5
    """)
    
    if positions and len(positions) > 0:
        log(f"  ✅ Found {len(positions)} video position(s) saved", "success")
        for pos in positions:
            pct = round((pos['video_max_position_sec'] / pos['video_duration_sec']) * 100) if pos['video_duration_sec'] else 0
            log(f"     {pos['class_id']}: {pos['video_max_position_sec']}s / {pos['video_duration_sec']}s ({pct}%)", "dim")
    else:
        log("  ❌ No video positions found", "error")
        all_pass = False
    
    # Check VIDEO_PING events
    pings = run_sql(f"""
        SELECT COUNT(*) as count FROM lms_event 
        WHERE user_id = '{user_id}' AND type = 'VIDEO_PING'
    """)
    
    ping_count = pings[0]['count'] if pings else 0
    if ping_count > 0:
        log(f"  ✅ Found {ping_count} VIDEO_PING events", "success")
    else:
        log("  ⚠️  No VIDEO_PING events (video tracking may not have fired)", "warn")
    
    return all_pass


def validate_quiz_complete(user_id: str) -> bool:
    """Validate quiz completion state."""
    log("\n🔍 Validating: Quiz Complete State", "info")
    
    all_pass = True
    
    # Check quiz events
    quizzes = run_sql(f"""
        SELECT class_id, payload_json FROM lms_event 
        WHERE user_id = '{user_id}' AND type = 'QUIZ_SUBMIT'
        ORDER BY occurred_at DESC LIMIT 5
    """)
    
    if quizzes and len(quizzes) > 0:
        log(f"  ✅ Found {len(quizzes)} QUIZ_SUBMIT event(s)", "success")
        for quiz in quizzes:
            try:
                payload = json.loads(quiz['payload_json'])
                passed = "✅ PASS" if payload.get('passed') else "❌ FAIL"
                score = payload.get('score', '?')
                max_score = payload.get('max_score', '?')
                log(f"     {quiz['class_id']}: {score}/{max_score} {passed}", "dim")
            except:
                pass
    else:
        log("  ❌ No QUIZ_SUBMIT events found", "error")
        all_pass = False
    
    # Check quiz_passed in progress
    passed = run_sql(f"""
        SELECT class_id, quiz_passed FROM v_user_progress 
        WHERE user_id = '{user_id}' AND quiz_passed = 1
    """)
    
    if passed and len(passed) > 0:
        log(f"  ✅ {len(passed)} quiz(zes) marked as passed in progress", "success")
    else:
        log("  ⚠️  No quizzes marked as passed in v_user_progress", "warn")
    
    # Check badges earned
    badges = run_sql(f"""
        SELECT b.name, a.awarded_at 
        FROM gamification_award a 
        JOIN gamification_badge b ON b.id = a.badge_id
        WHERE a.user_id = '{user_id}'
        ORDER BY a.awarded_at DESC
    """)
    
    if badges and len(badges) > 0:
        log(f"  ✅ {len(badges)} badge(s) earned", "success")
        for badge in badges:
            log(f"     🏅 {badge['name']}", "dim")
    else:
        log("  ⚠️  No badges earned yet", "warn")
    
    return all_pass


def validate_step_progress(user_id: str) -> bool:
    """Validate step completion progress."""
    log("\n🔍 Validating: Step Progress State", "info")
    
    all_pass = True
    
    # Get progress summary
    progress = run_sql(f"""
        SELECT 
            course_id,
            COUNT(*) as total_steps,
            SUM(CASE WHEN video_completed = 1 OR quiz_passed = 1 THEN 1 ELSE 0 END) as completed_steps
        FROM v_user_progress 
        WHERE user_id = '{user_id}'
        GROUP BY course_id
    """)
    
    if progress and len(progress) > 0:
        log("  ✅ Progress found:", "success")
        for p in progress:
            pct = round((p['completed_steps'] / p['total_steps']) * 100) if p['total_steps'] else 0
            log(f"     {p['course_id']}: {p['completed_steps']}/{p['total_steps']} ({pct}%)", "dim")
    else:
        log("  ❌ No progress records found", "error")
        all_pass = False
    
    # Get XP summary (points_reward is in gamification_badge table)
    xp = run_sql(f"""
        SELECT COALESCE(SUM(b.points_reward), 0) as total_xp
        FROM gamification_award a
        JOIN gamification_badge b ON b.id = a.badge_id
        WHERE a.user_id = '{user_id}'
    """)
    
    total_xp = xp[0]['total_xp'] if xp and xp[0]['total_xp'] else 0
    log(f"  ⚡ Total XP: {total_xp}", "info")
    
    return all_pass


# =============================================================================
# MAIN
# =============================================================================

SCENARIOS = {
    "fresh_user": {
        "func": validate_fresh_user,
        "desc": "Verify clean slate (no progress, no events)"
    },
    "video_resume": {
        "func": validate_video_resume,
        "desc": "Verify video position saved"
    },
    "quiz_complete": {
        "func": validate_quiz_complete,
        "desc": "Verify quiz submitted and badges awarded"
    },
    "step_progress": {
        "func": validate_step_progress,
        "desc": "Verify step completion state"
    },
}


def list_scenarios():
    """Print available scenarios."""
    print(f"\n{CYAN}Available validation scenarios:{RESET}\n")
    for name, info in SCENARIOS.items():
        print(f"  {GREEN}{name}{RESET}")
        print(f"    {info['desc']}")
    print()


def main():
    parser = argparse.ArgumentParser(
        description="Validate DB state after human testing",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python3 validate_state.py fresh_user
    python3 validate_state.py video_resume
    python3 validate_state.py quiz_complete
    python3 validate_state.py step_progress
    python3 validate_state.py --list
        """
    )
    parser.add_argument("scenario", nargs="?", help="Scenario to validate")
    parser.add_argument("--list", "-l", action="store_true", help="List available scenarios")
    parser.add_argument("--user-id", "-u", help="User ID (auto-detected if not provided)")
    
    args = parser.parse_args()
    
    if args.list or not args.scenario:
        list_scenarios()
        sys.exit(0)
    
    if args.scenario not in SCENARIOS:
        log(f"Unknown scenario: {args.scenario}", "error")
        list_scenarios()
        sys.exit(1)
    
    # Get user ID
    user_id = args.user_id
    if not user_id:
        log("Detecting user_id...", "info")
        user_id = get_user_id()
        if user_id:
            log(f"Found: {user_id}", "success")
        else:
            log("No user found in database. Run some tests first.", "error")
            sys.exit(1)
    
    print(f"\n{CYAN}{'='*50}{RESET}")
    print(f"{CYAN}🔍 LMS State Validation{RESET}")
    print(f"{CYAN}{'='*50}{RESET}")
    print(f"   Scenario: {args.scenario}")
    print(f"   User: {user_id}")
    
    # Run validation
    scenario_info = SCENARIOS[args.scenario]
    success = scenario_info["func"](user_id)
    
    print()
    if success:
        print(f"{GREEN}✅ VALIDATION PASSED{RESET}")
        sys.exit(0)
    else:
        print(f"{RED}❌ VALIDATION FAILED{RESET}")
        sys.exit(1)


if __name__ == "__main__":
    main()

