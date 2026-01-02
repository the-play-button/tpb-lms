#!/usr/bin/env python3
"""
Manual Testing Fixtures - LMS

Fixtures spécialisées pour les tests manuels avec différents profils utilisateur.
Complément à fixtures.py pour les tests automatisés.
"""

import subprocess
import sys
import json
from datetime import datetime, timedelta

# Test profiles for manual testing
PROFILES = {
    'student_alice': {
        'email': 'alice@test.local',
        'name': 'Alice Student',
        'role': 'student',
        'contact_id': 'contact_alice_test'
    },
    'instructor_bob': {
        'email': 'bob@wge.local', 
        'name': 'Bob Instructor',
        'role': 'instructor',
        'contact_id': 'contact_bob_instructor'
    },
    'admin_charlie': {
        'email': 'charlie@wge.local',
        'name': 'Charlie Admin', 
        'role': 'admin',
        'contact_id': 'contact_charlie_admin'
    }
}

def run_d1_command(sql_command):
    """Execute D1 command via wrangler."""
    cmd = [
        'npx', 'wrangler', 'd1', 'execute', 'lms-db', 
        '--remote', '--command', sql_command
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"❌ D1 Error: {result.stderr}")
        return None
    return result.stdout

def setup_test_profiles():
    """Create all test profiles in the database."""
    print("🔧 Setting up test profiles...")
    
    for profile_name, profile in PROFILES.items():
        print(f"  Creating {profile_name} ({profile['role']})...")
        
        # 1. Create crm_contact
        contact_sql = f"""
        INSERT OR REPLACE INTO crm_contact (id, name, emails_json, created_at, updated_at)
        VALUES (
            '{profile['contact_id']}',
            '{profile['name']}',
            '[{{"email":"{profile['email']}","type":"WORK"}}]',
            datetime('now'),
            datetime('now')
        );
        """
        run_d1_command(contact_sql)
        
        # 2. Create hris_employee if instructor/admin
        if profile['role'] in ['instructor', 'admin']:
            roles_json = '["admin"]' if profile['role'] == 'admin' else '["instructor"]'
            employee_sql = f"""
            INSERT OR REPLACE INTO hris_employee (
                id, name, emails_json, employee_roles_json, created_at, updated_at
            ) VALUES (
                'emp_{profile['contact_id']}',
                '{profile['name']}',
                '[{{"email":"{profile['email']}","type":"WORK"}}]',
                '{roles_json}',
                datetime('now'),
                datetime('now')
            );
            """
            run_d1_command(employee_sql)
    
    print("✅ Test profiles created")

def clean_slate(profile_name):
    """Clean slate for a specific profile."""
    if profile_name not in PROFILES:
        print(f"❌ Unknown profile: {profile_name}")
        return
    
    profile = PROFILES[profile_name]
    contact_id = profile['contact_id']
    
    print(f"🧹 Clean slate for {profile_name}...")
    
    # Clear all progress data
    clean_sql = f"""
    DELETE FROM lms_event WHERE user_id = '{contact_id}';
    DELETE FROM lms_signal WHERE user_id = '{contact_id}';
    DELETE FROM lms_video_position WHERE user_id = '{contact_id}';
    """
    run_d1_command(clean_sql)
    print("✅ Clean slate applied")

def video_progress(profile_name):
    """Setup video progress for testing resume."""
    if profile_name not in PROFILES:
        print(f"❌ Unknown profile: {profile_name}")
        return
    
    profile = PROFILES[profile_name]
    contact_id = profile['contact_id']
    
    print(f"🎥 Setting up video progress for {profile_name}...")
    
    # Add some video events and positions
    events_sql = f"""
    INSERT OR REPLACE INTO lms_event (id, user_id, type, course_id, class_id, data_json, occurred_at)
    VALUES 
        ('evt_1_{contact_id}', '{contact_id}', 'VIDEO_PING', 'pw05-2', 'pw05-2-1', '{{"position_sec":45,"duration_sec":120}}', datetime('now', '-1 hour')),
        ('evt_2_{contact_id}', '{contact_id}', 'VIDEO_COMPLETED', 'pw05-2', 'pw05-2-1', '{{"duration_sec":120}}', datetime('now', '-50 minutes'));
    
    INSERT OR REPLACE INTO lms_video_position (user_id, video_id, position_sec, duration_sec, updated_at)
    VALUES ('{contact_id}', 'pw05-2-2', 30, 180, datetime('now', '-10 minutes'));
    """
    run_d1_command(events_sql)
    print("✅ Video progress setup")

def mastery_progression(profile_name):
    """Setup different mastery levels for testing badges."""
    if profile_name not in PROFILES:
        print(f"❌ Unknown profile: {profile_name}")
        return
    
    profile = PROFILES[profile_name]
    contact_id = profile['contact_id']
    
    print(f"🏆 Setting up mastery progression for {profile_name}...")
    
    # Create progression: 25% (bronze), 50% (silver), 75% (gold), 100% (master)
    signals_sql = f"""
    INSERT OR REPLACE INTO lms_signal (id, user_id, type, course_id, class_id, data_json, created_at)
    VALUES 
        ('sig_1_{contact_id}', '{contact_id}', 'VIDEO_COMPLETED', 'course_bronze', 'step1', '{{}}', datetime('now', '-3 days')),
        ('sig_2_{contact_id}', '{contact_id}', 'VIDEO_COMPLETED', 'course_silver', 'step1', '{{}}', datetime('now', '-2 days')),
        ('sig_3_{contact_id}', '{contact_id}', 'VIDEO_COMPLETED', 'course_silver', 'step2', '{{}}', datetime('now', '-2 days')),
        ('sig_4_{contact_id}', '{contact_id}', 'VIDEO_COMPLETED', 'course_gold', 'step1', '{{}}', datetime('now', '-1 day')),
        ('sig_5_{contact_id}', '{contact_id}', 'VIDEO_COMPLETED', 'course_gold', 'step2', '{{}}', datetime('now', '-1 day')),
        ('sig_6_{contact_id}', '{contact_id}', 'VIDEO_COMPLETED', 'course_gold', 'step3', '{{}}', datetime('now', '-1 day')),
        ('sig_7_{contact_id}', '{contact_id}', 'COURSE_COMPLETED', 'course_master', 'final', '{{}}', datetime('now', '-1 hour'));
    """
    run_d1_command(signals_sql)
    print("✅ Mastery progression setup")

def setup_admin(profile_name):
    """Setup admin profile with sample data to view in dashboard."""
    if profile_name not in PROFILES:
        print(f"❌ Unknown profile: {profile_name}")
        return
    
    profile = PROFILES[profile_name]
    
    if profile['role'] != 'admin':
        print(f"❌ Profile {profile_name} is not admin role")
        return
    
    print(f"👑 Setting up admin dashboard data for {profile_name}...")
    
    # Create sample data for admin dashboard
    sample_data_sql = """
    INSERT OR REPLACE INTO lms_event (id, user_id, type, course_id, class_id, data_json, occurred_at)
    VALUES 
        ('admin_sample_1', 'sample_user_1', 'VIDEO_COMPLETED', 'pw05-2', 'step1', '{}', datetime('now', '-2 hours')),
        ('admin_sample_2', 'sample_user_2', 'QUIZ_PASSED', 'pw05-2', 'quiz1', '{"score": 85}', datetime('now', '-1 hour')),
        ('admin_sample_3', 'sample_user_3', 'COURSE_COMPLETED', 'pw05-2', 'final', '{}', datetime('now', '-30 minutes'));
    
    INSERT OR REPLACE INTO lms_signal (id, user_id, type, course_id, class_id, data_json, created_at)
    VALUES 
        ('admin_sig_1', 'sample_user_1', 'VIDEO_COMPLETED', 'pw05-2', 'step1', '{}', datetime('now', '-2 hours')),
        ('admin_sig_2', 'sample_user_2', 'QUIZ_PASSED', 'pw05-2', 'quiz1', '{"score": 85}', datetime('now', '-1 hour')),
        ('admin_sig_3', 'sample_user_3', 'COURSE_COMPLETED', 'pw05-2', 'final', '{}', datetime('now', '-30 minutes'));
    """
    run_d1_command(sample_data_sql)
    print("✅ Admin dashboard data setup")

def main():
    """Main CLI interface."""
    if len(sys.argv) < 2:
        print("Usage: python manual_fixtures.py <command> [--profile <profile_name>]")
        print("\nCommands:")
        print("  setup_test_profiles    - Create all test profiles")
        print("  clean_slate           - Clean all data for profile")
        print("  video_progress        - Setup video progress")
        print("  mastery_progression   - Setup mastery badges")
        print("  setup_admin          - Setup admin dashboard")
        print("\nProfiles: student_alice, instructor_bob, admin_charlie")
        return
    
    command = sys.argv[1]
    profile_name = None
    
    # Parse --profile argument
    if '--profile' in sys.argv:
        profile_idx = sys.argv.index('--profile')
        if profile_idx + 1 < len(sys.argv):
            profile_name = sys.argv[profile_idx + 1]
    
    # Execute command
    if command == 'setup_test_profiles':
        setup_test_profiles()
    elif command == 'clean_slate':
        if not profile_name:
            print("❌ --profile required for clean_slate")
            return
        clean_slate(profile_name)
    elif command == 'video_progress':
        if not profile_name:
            print("❌ --profile required for video_progress")
            return
        video_progress(profile_name)
    elif command == 'mastery_progression':
        if not profile_name:
            print("❌ --profile required for mastery_progression")
            return
        mastery_progression(profile_name)
    elif command == 'setup_admin':
        if not profile_name:
            print("❌ --profile required for setup_admin")
            return
        setup_admin(profile_name)
    else:
        print(f"❌ Unknown command: {command}")

if __name__ == '__main__':
    main()
