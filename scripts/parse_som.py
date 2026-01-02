#!/usr/bin/env python3
"""
Parse a SOM folder structure and generate JSON for upload_course.py.

This script reads the standardized SOM folder structure:
- SOM_xxx_index.md (main file with frontmatter)
- STEPS/STEP*.md (learning steps with stream_id, tally_form_id)
- ASSETS/REFERENCES/VIDEOS/*.videolink.md (video metadata)

And generates a JSON file compatible with upload_course.py.

Usage:
    python parse_som.py --som-path "/path/to/outputs/SOM_PW05.2_Onboarding_WGE"
    python parse_som.py --som-path "/path/to/SOM_xxx" --output "/path/to/output.json"
    python parse_som.py --som-path "/path/to/SOM_xxx" --upload  # Direct upload to D1

One-liner (in Dev Container):
    cd 04.Execution/lms && python scripts/parse_som.py --som-path "/path/to/SOM_xxx"
"""

import os
import re
import json
import argparse
import subprocess
from pathlib import Path
from datetime import datetime
import yaml


# =============================================================================
# YAML FRONTMATTER PARSER
# =============================================================================

def parse_frontmatter(content: str) -> dict:
    """Extract YAML frontmatter from markdown file.
    
    Supports both simple key: value and YAML arrays like:
    keywords:
      - "keyword1"
      - "keyword2"
    """
    match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
    if not match:
        return {}
    
    frontmatter = {}
    lines = match.group(1).split('\n')
    current_key = None
    current_array = None
    
    for line in lines:
        # Skip comments
        if line.strip().startswith('#'):
            continue
            
        # Check for array item (starts with "  - ")
        array_item_match = re.match(r'^\s+-\s*["\']?([^"\']+)["\']?\s*$', line)
        if array_item_match and current_key:
            if current_array is None:
                current_array = []
            current_array.append(array_item_match.group(1).strip())
            continue
        
        # Check for key: value
        if ':' in line and not line.startswith(' '):
            # Save previous array if any
            if current_key and current_array is not None:
                frontmatter[current_key] = current_array
                current_array = None
            
            key, value = line.split(':', 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            current_key = key
            
            if value:  # Simple key: value
                frontmatter[key] = value
            # else: might be start of array, wait for next lines
    
    # Save last array if any
    if current_key and current_array is not None:
        frontmatter[current_key] = current_array
    
    return frontmatter


def extract_markdown_body(content: str) -> str:
    """Extract markdown content after frontmatter."""
    match = re.match(r'^---\n.*?\n---\n?(.*)', content, re.DOTALL)
    if match:
        return match.group(1).strip()
    return content.strip()


# =============================================================================
# SOM PARSING
# =============================================================================

def parse_som_main(som_path: Path) -> dict:
    """Parse the main SOM_xxx_index.md file."""
    # Find main SOM file (either _index.md or just .md)
    som_files = list(som_path.glob("SOM_*_index.md"))
    if not som_files:
        som_files = list(som_path.glob("SOM_*.md"))
    if not som_files:
        raise FileNotFoundError(f"No SOM_*.md file found in {som_path}")
    
    main_file = som_files[0]
    with open(main_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    frontmatter = parse_frontmatter(content)
    
    return {
        "id": frontmatter.get("som_id", som_path.name.replace("SOM_", "").replace("_", "-").lower()),
        "title": frontmatter.get("title", "Untitled SOM"),
        "description": frontmatter.get("description", ""),
        "category": frontmatter.get("category", ""),
        "target_roles": frontmatter.get("target_roles", []),
        "skill_level": frontmatter.get("skill_level", "beginner"),
        "estimated_time": frontmatter.get("estimated_time", ""),
        "status": frontmatter.get("status", "draft"),
        "version": frontmatter.get("version", "1.0"),
        "created_date": frontmatter.get("created_date", ""),
        "last_update": frontmatter.get("last_update", ""),
        "authors": frontmatter.get("authors", []),
    }


def load_quiz_yaml(quiz_file: Path) -> dict:
    """Load and parse a STEP*_quiz.yaml file."""
    if not quiz_file.exists():
        return None
    
    try:
        with open(quiz_file, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    except Exception as e:
        print(f"⚠️ Warning: Failed to parse quiz file {quiz_file}: {e}")
        return None


def extract_correct_answers(quiz_data: dict) -> dict:
    """Extrait les bonnes reponses du quiz YAML.
    
    Format: {label_question: texte_bonne_reponse}
    On utilise le label car Tally renvoie le label dans le webhook.
    """
    correct_answers = {}
    for q in quiz_data.get("questions", []):
        question_text = q.get("text", "")
        for opt in q.get("options", []):
            if opt.get("correct"):
                correct_answers[question_text] = opt.get("text")
                break
    return correct_answers


def load_tally_ids(som_path: Path) -> dict:
    """Load .tally_ids.json file mapping quiz names to Tally form IDs."""
    tally_ids_file = som_path / ".tally_ids.json"
    if not tally_ids_file.exists():
        return {}
    
    try:
        with open(tally_ids_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"⚠️ Warning: Failed to load .tally_ids.json: {e}")
        return {}


def parse_steps(som_path: Path) -> list:
    """Parse all STEPS/STEP*.md files and associated _quiz.yaml files."""
    steps_path = som_path / "STEPS"
    if not steps_path.exists():
        # Fallback to PROCEDURES for backward compatibility
        steps_path = som_path / "PROCEDURES"
        if not steps_path.exists():
            return []
    
    # Load Tally form IDs mapping
    tally_ids = load_tally_ids(som_path)
    
    steps = []
    step_files = sorted(steps_path.glob("STEP*.md"))
    
    for step_file in step_files:
        with open(step_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        frontmatter = parse_frontmatter(content)
        body = extract_markdown_body(content)
        
        # Check for associated quiz file (STEP01_quiz.yaml for STEP01_xxx.md)
        step_base = step_file.stem.split("_")[0]  # "STEP01" from "STEP01_Valeurs_WGE"
        quiz_file = steps_path / f"{step_base}_quiz.yaml"
        quiz_data = load_quiz_yaml(quiz_file)
        
        # Get tally_form_id from frontmatter or .tally_ids.json
        stream_id = frontmatter.get("stream_id")
        tally_form_id = frontmatter.get("tally_form_id")
        
        # If quiz file exists but no tally_form_id, check .tally_ids.json
        if quiz_data and not tally_form_id:
            quiz_key = f"{step_base}_quiz"
            tally_form_id = tally_ids.get(quiz_key)
        
        # Determine step_type
        has_quiz = quiz_data is not None or tally_form_id
        if stream_id and has_quiz:
            step_type = "MIXED"
        elif stream_id:
            step_type = "VIDEO"
        elif has_quiz:
            step_type = "QUIZ"
        else:
            step_type = "CONTENT"
        
        step = {
            "id": step_file.stem.lower().replace("_", "-"),
            "name": frontmatter.get("title", step_file.stem),
            "step_order": int(frontmatter.get("step_order", 0)),
            "step_type": step_type,
            "content_md": body,
            "media": [],
            "quiz": quiz_data  # Include raw quiz data for sync_tally_quiz.py
        }
        
        # Extract correct answers if quiz data exists
        if quiz_data:
            step["correct_answers"] = extract_correct_answers(quiz_data)
        
        # Add video if present
        if stream_id:
            step["media"].append({
                "type": "VIDEO",
                "stream_id": stream_id,
                "name": frontmatter.get("title", "Video")
            })
        
        # Add quiz if present (with or without tally_form_id)
        if has_quiz:
            quiz_media = {
                "type": "QUIZ",
                "name": quiz_data.get("title", "Quiz") if quiz_data else "Quiz",
                "pass_threshold": quiz_data.get("pass_threshold", 80) if quiz_data else 80
            }
            if tally_form_id:
                quiz_media["tally_form_id"] = tally_form_id
            step["media"].append(quiz_media)
        
        steps.append(step)
    
    # Sort by step_order
    steps.sort(key=lambda s: s["step_order"])
    
    return steps


def parse_videos(som_path: Path) -> dict:
    """Parse ASSETS/REFERENCES/VIDEOS/*.videolink.md files and return a dict by stream_id."""
    # New structure: ASSETS/REFERENCES/VIDEOS/
    videos_path = som_path / "ASSETS" / "REFERENCES" / "VIDEOS"
    if not videos_path.exists():
        # Fallback to old structure
        videos_path = som_path / "ASSETS" / "VIDEOS"
        if not videos_path.exists():
            return {}
    
    videos = {}
    # Search recursively for videolink.md files
    for video_file in videos_path.rglob("*.videolink.md"):
        with open(video_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        frontmatter = parse_frontmatter(content)
        stream_id = frontmatter.get("stream_id")
        
        if stream_id:
            videos[stream_id] = {
                "title": frontmatter.get("title", ""),
                "presenter": frontmatter.get("presenter", ""),
                "duration": frontmatter.get("duration", ""),
                "uploaded_at": frontmatter.get("uploaded_at", ""),
            }
    
    return videos


def parse_som(som_path: Path) -> dict:
    """Parse entire SOM folder and generate course JSON."""
    som_path = Path(som_path)
    
    if not som_path.exists():
        raise FileNotFoundError(f"SOM path not found: {som_path}")
    
    # Parse main SOM file
    course = parse_som_main(som_path)
    
    # Parse steps
    steps = parse_steps(som_path)
    
    # Parse video metadata
    videos = parse_videos(som_path)
    
    # Enrich steps with video metadata
    for step in steps:
        for media in step.get("media", []):
            if media.get("type") == "VIDEO" and media.get("stream_id") in videos:
                video_meta = videos[media["stream_id"]]
                media["name"] = video_meta.get("title") or media.get("name")
                media["presenter"] = video_meta.get("presenter")
                media["duration"] = video_meta.get("duration")
    
    # Build final JSON structure (compatible with upload_course.py)
    return {
        "id": course["id"].lower().replace(".", "-"),
        "title": course["title"],
        "description": course["description"],
        "category": course["category"],
        "is_active": True,
        "metadata": {
            "target_roles": course.get("target_roles", []),
            "skill_level": course.get("skill_level", "beginner"),
            "estimated_time": course.get("estimated_time", ""),
            "version": course.get("version", "1.0"),
            "authors": course.get("authors", []),
        },
        "classes": [
            {
                "id": step["id"],
                "name": step["name"],
                "step_order": step["step_order"],
                "step_type": step["step_type"],
                "content_md": step["content_md"],
                "media": step["media"],
                "correct_answers": step.get("correct_answers", {})
            }
            for step in steps
        ]
    }


# =============================================================================
# MAIN
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description='Parse SOM folder and generate JSON for upload_course.py')
    parser.add_argument('--som-path', required=True, help='Path to SOM folder (e.g., outputs/SOM_PW05.2_xxx/)')
    parser.add_argument('--output', help='Output JSON file path (default: <som_id>.json in courses/)')
    parser.add_argument('--upload', action='store_true', help='Directly upload to D1 via upload_course.py')
    parser.add_argument('--dry-run', action='store_true', help='Show parsed data without writing')
    args = parser.parse_args()
    
    som_path = Path(args.som_path)
    print(f"📁 Parsing SOM: {som_path}")
    
    try:
        course_json = parse_som(som_path)
    except Exception as e:
        print(f"❌ Error parsing SOM: {e}")
        return 1
    
    print(f"✅ Parsed: {course_json['title']}")
    print(f"   ID: {course_json['id']}")
    print(f"   Steps: {len(course_json['classes'])}")
    for step in course_json['classes']:
        media_str = ", ".join([m['type'] for m in step.get('media', [])])
        print(f"     {step['step_order']}. {step['name']} [{step['step_type']}] {media_str}")
    
    if args.dry_run:
        print("\n📋 JSON output (dry-run):")
        print(json.dumps(course_json, indent=2, ensure_ascii=False))
        return 0
    
    # Determine output path
    output_path = args.output
    if not output_path:
        script_dir = Path(__file__).parent
        output_dir = script_dir.parent.parent / "03.Orchestration" / "lms" / "courses"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / f"{course_json['id']}.json"
    
    output_path = Path(output_path)
    
    # Write JSON
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(course_json, f, indent=2, ensure_ascii=False)
    
    print(f"\n📄 JSON written to: {output_path}")
    
    # Upload if requested
    if args.upload:
        print("\n🚀 Uploading to D1...")
        script_dir = Path(__file__).parent
        upload_script = script_dir / "upload_course.py"
        
        result = subprocess.run(
            ["python3", str(upload_script), "--config", str(output_path)],
            capture_output=True,
            text=True
        )
        
        print(result.stdout)
        if result.returncode != 0:
            print(f"❌ Upload failed: {result.stderr}")
            return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
