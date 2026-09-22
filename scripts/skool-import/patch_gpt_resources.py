#!/usr/bin/env python3
"""Re-PATCH the AI Fashion House "Chat GPT bots" lesson with the 8 CLEAN reconstructed
GPT prompt-system docs (replacing the earlier flattened innerText dump).

Reads the 8 reconstructed `.md` from CORSAIR external_resources/gpts/, builds a
`resourcesJson` array of {title, content}, and PATCHes the lesson class.

Target prod domain `lms-api.theplaybutton.ai` (serves the dev-config worker → dev vault PAT).
Auth: `app_lms` PAT (vault `tpb/apps/lms/bastion_token`).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import httpx
from tpb_sdk.bastion import BastionClient

LMS = os.environ.get("LMS_API_URL", "https://lms-api.theplaybutton.ai")
VAULT_PAT_PATH = "tpb/apps/lms/bastion_token"
LESSON_ID = "les_72a7ed15f6cd423e96136c5fb1146862"  # "Chat GPT bots"

GPTS = Path(
    "/Volumes/CORSAIR/live/workspace/skool-mirrors/ai-fashion-house/external_resources/gpts"
)

# (file, human title) — ordered: master gen → editor → specialized lenses → video
DOCS = [
    ("gpt_ai-fh-fashion-director.md", "Fashion Director — master image-gen prompt system"),
    ("gpt_ai-fh-nano-banana-editor.md", "Nano-Banana Editor — image editing prompt system"),
    ("gpt_ai-fh-model-pose-lookalike.md", "Model / Pose Lookalike — front-view ecommerce hero"),
    ("gpt_ai-fh-bg-environment.md", "Background / Environment — scene design & swap"),
    ("gpt_ai-fh-lighting-mood-camera.md", "Lighting / Mood / Camera treatment"),
    ("gpt_ai-fh-raw-nocturnal-shots.md", "Raw Nocturnal Shot — night editorial"),
    ("gpt_ai-fh-artsy-product-placement.md", "Artsy Product Placement — editorial still-life"),
    ("gpt_ai-fh-video-prompter.md", "Video Prompter — still → 6-second clip"),
]


def main() -> None:
    resources = []
    for fname, title in DOCS:
        p = GPTS / fname
        if not p.exists():
            print(f"FATAL: missing {p}", file=sys.stderr)
            sys.exit(2)
        content = p.read_text(encoding="utf-8").strip()
        if not content or "I can't provide" in content or "Réfléchi pendant" in content:
            print(f"FATAL: {fname} still looks like a raw dump", file=sys.stderr)
            sys.exit(2)
        resources.append({"title": title, "content": content})
        print(f"  + {title}  ({len(content)} chars)")

    bc = BastionClient.from_devcontainer()
    pat = os.environ.get("LMS_BASTION_TOKEN") or bc.get_secret(VAULT_PAT_PATH)
    if not pat:
        print(f"FATAL: no PAT (set LMS_BASTION_TOKEN or vault {VAULT_PAT_PATH})", file=sys.stderr)
        sys.exit(2)
    h = {**dict(bc.effective_headers), "Authorization": f"Bearer {pat}", "Content-Type": "application/json"}

    with httpx.Client(timeout=60, headers=h) as cl:
        r = cl.patch(f"{LMS}/api/classes/{LESSON_ID}", json={"resourcesJson": resources})
        print(f"\nPATCH /api/classes/{LESSON_ID} -> {r.status_code}")
        if r.status_code != 200:
            print(r.text[:400], file=sys.stderr)
            sys.exit(1)
        # verify round-trip
        g = cl.get(f"{LMS}/api/classes/{LESSON_ID}")
        body = g.json().get("value") or g.json()
        got = body.get("resources_json") or body.get("resourcesJson") or []
        print(f"verify: {len(got)} resource(s) live on the lesson")
        for item in got:
            print(f"  - {item.get('title', '?')}  ({len(item.get('content', ''))} chars)")


if __name__ == "__main__":
    main()
