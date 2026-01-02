#!/usr/bin/env python3
"""
Sync quiz YAML files from SOM to Tally forms.

This script reads STEP*_quiz.yaml files, creates Tally forms, and stores
the form IDs in .tally_ids.json for use by parse_som.py and upload_course.py.

Usage:
    python sync_tally_quiz.py --som-path "/path/to/SOM_xxx"
    python sync_tally_quiz.py --som-path "/path/to/SOM_xxx" --dry-run
    python sync_tally_quiz.py --som-path "/path/to/SOM_xxx" --webhook-url https://api/webhook

One-liner (in Dev Container):
    cd 04.Execution/lms && python scripts/sync_tally_quiz.py --som-path "/path/to/SOM_xxx" --dry-run
"""

import os
import sys
import json
import uuid
import argparse
from pathlib import Path
from typing import Optional

import yaml
import requests

# Add parent directory to path for vault_client
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from vault_client import VaultClient


def _get_tally_api_key():
    """Get Tally API key from vault (cached)."""
    if not hasattr(_get_tally_api_key, "_cache"):
        _get_tally_api_key._cache = VaultClient.from_devcontainer().get_secret("integrations/tally_api_key")
    return _get_tally_api_key._cache


TALLY_API_BASE = "https://api.tally.so"


def generate_uuid() -> str:
    """Generate a UUID for Tally blocks."""
    return str(uuid.uuid4())


def quiz_yaml_to_tally_blocks(quiz: dict) -> list[dict]:
    """Convert quiz YAML structure to Tally blocks."""
    blocks = []
    
    for idx, question in enumerate(quiz.get("questions", [])):
        q_text = question.get("text", f"Question {idx + 1}")
        q_type = question.get("type", "multiple_choice")
        options = question.get("options", [])
        
        if q_type == "multiple_choice":
            # Title block
            title_group_uuid = generate_uuid()
            blocks.append({
                "uuid": generate_uuid(),
                "type": "TITLE",
                "groupUuid": title_group_uuid,
                "groupType": "QUESTION",
                "payload": {
                    "safeHTMLSchema": [[q_text]]
                }
            })
            
            # Option blocks
            options_group_uuid = generate_uuid()
            for i, opt in enumerate(options):
                opt_text = opt.get("text", opt) if isinstance(opt, dict) else opt
                blocks.append({
                    "uuid": generate_uuid(),
                    "type": "MULTIPLE_CHOICE_OPTION",
                    "groupUuid": options_group_uuid,
                    "groupType": "MULTIPLE_CHOICE",
                    "payload": {
                        "index": i,
                        "isRequired": True,
                        "isFirst": i == 0,
                        "isLast": i == len(options) - 1,
                        "text": opt_text
                    }
                })
    
    return blocks


def create_tally_form(title: str, blocks: list[dict], webhook_url: Optional[str] = None) -> Optional[str]:
    """Create a Tally form via API and return the form ID."""
    tally_api_key = _get_tally_api_key()
    if not tally_api_key:
        print("❌ TALLY_API_KEY not found in vault (conn_integrations)")
        return None
    
    headers = {
        "Authorization": f"Bearer {tally_api_key}",
        "Content-Type": "application/json"
    }
    
    # Create form
    form_data = {
        "name": title,
        "status": "PUBLISHED",
        "blocks": blocks,
        "settings": {
            "progress": True,
            "redirectOnCompletion": True,
            "language": "FR"
        }
    }
    
    try:
        response = requests.post(
            f"{TALLY_API_BASE}/forms",
            headers=headers,
            json=form_data
        )
        
        if response.status_code not in [200, 201]:
            print(f"❌ Failed to create form: {response.status_code}")
            print(f"   Response: {response.text[:500]}")
            return None
        
        form = response.json()
        form_id = form.get("id")
        
        # Add webhook if specified
        if webhook_url and form_id:
            webhook_data = {
                "url": webhook_url,
                "signingSecret": generate_uuid()
            }
            webhook_response = requests.post(
                f"{TALLY_API_BASE}/forms/{form_id}/webhooks",
                headers=headers,
                json=webhook_data
            )
            if webhook_response.status_code in [200, 201]:
                print(f"   📡 Webhook configured: {webhook_url}")
        
        return form_id
        
    except Exception as e:
        print(f"❌ Error creating form: {e}")
        return None


def sync_som_quizzes(som_path: Path, webhook_url: Optional[str] = None, dry_run: bool = False) -> dict:
    """
    Sync all quiz YAML files from a SOM to Tally.
    
    Returns a dict mapping quiz keys to Tally form IDs.
    """
    steps_path = som_path / "STEPS"
    if not steps_path.exists():
        steps_path = som_path / "PROCEDURES"
        if not steps_path.exists():
            print(f"❌ No STEPS/ or PROCEDURES/ folder found in {som_path}")
            return {}
    
    # Find all quiz YAML files
    quiz_files = sorted(steps_path.glob("STEP*_quiz.yaml"))
    
    if not quiz_files:
        print("⚠️ No quiz YAML files found")
        return {}
    
    print(f"📋 Found {len(quiz_files)} quiz file(s)")
    
    # Load existing tally_ids
    tally_ids_file = som_path / ".tally_ids.json"
    existing_ids = {}
    if tally_ids_file.exists():
        with open(tally_ids_file, 'r', encoding='utf-8') as f:
            existing_ids = json.load(f)
    
    new_ids = {}
    
    for quiz_file in quiz_files:
        quiz_key = quiz_file.stem  # e.g., "STEP01_quiz"
        
        # Check if already synced
        if quiz_key in existing_ids:
            print(f"⏭️  {quiz_key}: Already synced (form_id: {existing_ids[quiz_key]})")
            new_ids[quiz_key] = existing_ids[quiz_key]
            continue
        
        # Load quiz YAML
        try:
            with open(quiz_file, 'r', encoding='utf-8') as f:
                quiz = yaml.safe_load(f)
        except Exception as e:
            print(f"❌ {quiz_key}: Failed to parse YAML: {e}")
            continue
        
        title = quiz.get("title", quiz_key)
        blocks = quiz_yaml_to_tally_blocks(quiz)
        
        print(f"\n📝 {quiz_key}: {title}")
        print(f"   Questions: {len(quiz.get('questions', []))}")
        print(f"   Blocks: {len(blocks)}")
        
        if dry_run:
            print("   [DRY-RUN] Would create Tally form")
            continue
        
        # Create Tally form
        form_id = create_tally_form(title, blocks, webhook_url)
        
        if form_id:
            new_ids[quiz_key] = form_id
            print(f"   ✅ Created: https://tally.so/r/{form_id}")
        else:
            print(f"   ❌ Failed to create form")
    
    # Save tally_ids
    if not dry_run and new_ids:
        all_ids = {**existing_ids, **new_ids}
        with open(tally_ids_file, 'w', encoding='utf-8') as f:
            json.dump(all_ids, f, indent=2)
        print(f"\n💾 Saved {len(all_ids)} form ID(s) to .tally_ids.json")
    
    return new_ids


def main():
    parser = argparse.ArgumentParser(description='Sync quiz YAML files to Tally')
    parser.add_argument('--som-path', required=True, help='Path to SOM folder')
    parser.add_argument('--webhook-url', help='Webhook URL for form submissions')
    parser.add_argument('--dry-run', action='store_true', help='Preview without creating forms')
    args = parser.parse_args()
    
    som_path = Path(args.som_path)
    if not som_path.exists():
        print(f"❌ SOM path not found: {som_path}")
        return 1
    
    print(f"🔄 Syncing quizzes from: {som_path}")
    
    result = sync_som_quizzes(som_path, args.webhook_url, args.dry_run)
    
    if result:
        print(f"\n✅ Synced {len(result)} quiz(es)")
    
    return 0


if __name__ == "__main__":
    exit(main())

