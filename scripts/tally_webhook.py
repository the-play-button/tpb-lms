#!/usr/bin/env python3
"""
Tally Webhook Handler for LMS Quiz Integration.

This script processes Tally form submissions and forwards them to the LMS API.
Can be used as a standalone webhook endpoint or for testing.

Usage:
    # Test with a sample payload
    python tally_webhook.py --test
    
    # Process a webhook payload from stdin
    cat payload.json | python tally_webhook.py --process
    
    # Create quiz definition
    python tally_webhook.py --create-quiz --form-id FORM_ID --som-id PA06.2 --answers answers.json

One-liner (in Dev Container):
    cd 04.Execution/lms && python scripts/tally_webhook.py --test
"""

import argparse
import json
import sys
from pathlib import Path
from datetime import datetime

# Configuration
LMS_API_URL = "https://lms-api.matthieu-marielouise.workers.dev"


def process_tally_webhook(payload: dict) -> dict:
    """Process a Tally webhook payload and extract quiz data."""
    
    if payload.get("eventType") != "FORM_RESPONSE":
        return {"ignored": True, "reason": "Not a form response"}
    
    data = payload.get("data", {})
    fields = data.get("fields", [])
    form_id = data.get("formId")
    form_name = data.get("formName", "Unknown Quiz")
    submission_id = data.get("submissionId")
    
    # Extract hidden fields
    user_id = None
    som_id = None
    answers = {}
    
    for field in fields:
        key = field.get("key", "")
        label = field.get("label", "")
        value = field.get("value")
        
        if "user_id" in key.lower() or "user" in label.lower():
            user_id = value
        elif "som_id" in key.lower() or "som" in label.lower():
            som_id = value
        elif value is not None:
            # This is a question answer
            answers[key] = value
    
    if not user_id:
        return {"error": "Missing user_id in submission"}
    
    return {
        "submission_id": submission_id,
        "form_id": form_id,
        "form_name": form_name,
        "user_id": user_id,
        "som_id": som_id,
        "answers": answers,
        "submitted_at": payload.get("createdAt", datetime.now().isoformat())
    }


def calculate_score(answers: dict, correct_answers: dict) -> tuple:
    """Calculate quiz score based on correct answers."""
    
    score = 0
    max_score = len(correct_answers)
    
    for question_key, correct_value in correct_answers.items():
        user_answer = answers.get(question_key)
        
        # Handle multi-select (comma-separated)
        if isinstance(correct_value, list):
            correct_set = set(correct_value)
            user_set = set(user_answer.split(",")) if user_answer else set()
            if correct_set == user_set:
                score += 1
        else:
            if user_answer == correct_value:
                score += 1
    
    return score, max_score


def submit_to_lms(user_id: str, quiz_id: str, som_id: str, score: int, max_score: int, answers: dict) -> dict:
    """Submit quiz result to LMS API."""
    import requests
    
    payload = {
        "userId": user_id,
        "quizId": quiz_id,
        "somId": som_id,
        "score": score,
        "maxScore": max_score,
        "answers": answers
    }
    
    try:
        response = requests.post(
            f"{LMS_API_URL}/api/quiz-submission",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        return response.json()
    except Exception as e:
        return {"error": str(e)}


def create_quiz_definition(form_id: str, som_id: str, name: str, correct_answers: dict) -> dict:
    """Create a quiz definition for scoring."""
    
    definition = {
        "form_id": form_id,
        "som_id": som_id,
        "name": name,
        "passing_score": 80,
        "correct_answers": correct_answers,
        "created_at": datetime.now().isoformat()
    }
    
    # Save to file (in production, this would go to D1)
    output_path = Path(__file__).parent / "quiz_definitions" / f"{form_id}.json"
    output_path.parent.mkdir(exist_ok=True)
    
    with open(output_path, "w") as f:
        json.dump(definition, f, indent=2)
    
    print(f"✅ Quiz definition saved to: {output_path}")
    return definition


def load_quiz_definition(form_id: str) -> dict:
    """Load quiz definition from file."""
    
    definition_path = Path(__file__).parent / "quiz_definitions" / f"{form_id}.json"
    
    if definition_path.exists():
        with open(definition_path) as f:
            return json.load(f)
    
    return None


def main():
    parser = argparse.ArgumentParser(description="Tally Webhook Handler for LMS")
    parser.add_argument("--test", action="store_true", help="Run with test payload")
    parser.add_argument("--process", action="store_true", help="Process payload from stdin")
    parser.add_argument("--create-quiz", action="store_true", help="Create quiz definition")
    parser.add_argument("--form-id", help="Tally form ID")
    parser.add_argument("--som-id", help="SOM ID")
    parser.add_argument("--name", help="Quiz name")
    parser.add_argument("--answers", help="Path to correct answers JSON file")
    
    args = parser.parse_args()
    
    if args.create_quiz:
        if not args.form_id or not args.answers:
            print("❌ Error: --form-id and --answers required for --create-quiz")
            sys.exit(1)
        
        with open(args.answers) as f:
            correct_answers = json.load(f)
        
        name = args.name or f"Quiz {args.form_id}"
        result = create_quiz_definition(args.form_id, args.som_id, name, correct_answers)
        print(json.dumps(result, indent=2))
    
    elif args.test:
        # Test payload
        test_payload = {
            "eventType": "FORM_RESPONSE",
            "createdAt": datetime.now().isoformat(),
            "data": {
                "formId": "test_form_123",
                "formName": "SOM PA06.2 - Test Quiz",
                "submissionId": "sub_123",
                "fields": [
                    {"key": "user_id", "label": "User ID", "value": "user_test_123"},
                    {"key": "som_id", "label": "SOM ID", "value": "PA06.2"},
                    {"key": "question_1", "label": "Question 1", "value": "C"},
                    {"key": "question_2", "label": "Question 2", "value": "A,B"},
                    {"key": "question_3", "label": "Question 3", "value": "B"}
                ]
            }
        }
        
        print("📥 Processing test payload...")
        result = process_tally_webhook(test_payload)
        print(json.dumps(result, indent=2))
        
        # Try to score with definition
        definition = load_quiz_definition(result.get("form_id"))
        if definition:
            score, max_score = calculate_score(result["answers"], definition["correct_answers"])
            print(f"\n📊 Score: {score}/{max_score} ({100*score//max_score}%)")
    
    elif args.process:
        # Read from stdin
        payload = json.load(sys.stdin)
        result = process_tally_webhook(payload)
        
        if "error" in result:
            print(json.dumps(result))
            sys.exit(1)
        
        # Try to score
        definition = load_quiz_definition(result.get("form_id"))
        if definition:
            score, max_score = calculate_score(result["answers"], definition["correct_answers"])
            
            # Submit to LMS
            lms_result = submit_to_lms(
                result["user_id"],
                result["form_id"],
                result.get("som_id"),
                score,
                max_score,
                result["answers"]
            )
            print(json.dumps(lms_result, indent=2))
        else:
            # No scoring, just output parsed data
            print(json.dumps(result, indent=2))
    
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

