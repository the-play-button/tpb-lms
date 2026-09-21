#!/usr/bin/env python3
"""import_posts.py — turn a Skool community's social posts into a standard LMS program.

The community feed sometimes holds load-bearing info (announcements, resources, a gdrive
link in a post…). This imports the captured posts (`_raw/community_posts_full.json`) into a
standard **program → course → section → lesson** structure, so posts are browsable in the LMS
exactly like course content.

Design (v1):
- Program  "Communauté — <Community>".
- Course 1 "📌 Épinglés & Ressources" : pinned posts + posts that carry an attachment
  (the high-signal "the info is in a post" case), sorted pinned-first then by upvotes.
- Course 2 "💬 Discussions"           : the remaining substantive posts (content > 50 chars),
  sorted by upvotes.
Each post → a LESSON whose contentMd = the post body (Skool markup → markdown) + an author/
date/engagement footer. Idempotent (deterministic ids `les_post_<postId>`).

Auth + env: reuses import_course.LmsApi (LMS_API_URL + LMS_BASTION_TOKEN env override, else
dev vault). Run: `PYTHONPATH=<dir> python3 import_posts.py --data-root <mirror> --community "Génération IA"`.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from import_course import LmsApi, slugify  # reuse the env-driven API client + slug


# ── Skool markup → Markdown ────────────────────────────────────────────────────
_MENTION = re.compile(r"\[@([^\]]+)\]\(obj://[^)]+\)")
_LINK = re.compile(r"\[([^\]]+)\]\((https?://[^)]+)\)")


def skool_markup_to_md(text: str) -> str:
    """Convert Skool's inline post markup to Markdown (best-effort, lossless-ish)."""
    if not text:
        return ""
    s = text
    s = _MENTION.sub(r"**@\1**", s)          # mentions → bold handle
    s = _LINK.sub(r"[\1](\2)", s)            # [text](url) already markdown-ish → keep
    s = s.replace("\\(", "(").replace("\\)", ")").replace("\\[", "[").replace("\\]", "]")
    # ordered lists: [ol:N][li]a[li]b  → 1. a \n 2. b
    def _ol(m: re.Match) -> str:
        items = [x for x in m.group(1).split("[li]") if x.strip()]
        return "\n" + "\n".join(f"{i+1}. {it.strip()}" for i, it in enumerate(items)) + "\n"
    s = re.sub(r"\[ol(?::\d+)?\]((?:\[li\][^\[]*)+)", _ol, s)
    # unordered lists: [ul][li]a[li]b → - a \n - b
    def _ul(m: re.Match) -> str:
        items = [x for x in m.group(1).split("[li]") if x.strip()]
        return "\n" + "\n".join(f"- {it.strip()}" for it in items) + "\n"
    s = re.sub(r"\[ul\]((?:\[li\][^\[]*)+)", _ul, s)
    # stray leftover list tokens
    s = s.replace("[li]", "\n- ").replace("[ul]", "").replace("[ol]", "")
    return s.strip()


def _title_for(p: dict) -> str:
    t = (p.get("title") or "").strip()
    if t:
        return t[:120]
    body = (p.get("content") or "").strip().splitlines()
    first = body[0].strip() if body else ""
    first = re.sub(r"\[[^\]]*\]", "", first)  # drop markup tokens from the derived title
    return (first[:80] or "(sans titre)").strip()


def _lesson_md(p: dict) -> str:
    parts = [skool_markup_to_md(p.get("content") or "")]
    if p.get("attachments"):
        parts.append(f"\n> 📎 *Ce post a une pièce jointe Skool (`{p['attachments']}`).*")
    footer = f"\n\n---\n*Posté par **{p.get('author') or p.get('authorHandle') or 'membre'}**"
    if p.get("createdAt"):
        footer += f" · {p['createdAt'][:10]}"
    if p.get("upvotes"):
        footer += f" · 👍 {p['upvotes']}"
    if p.get("comments"):
        footer += f" · 💬 {p['comments']}"
    footer += "*"
    parts.append(footer)
    return "\n".join(parts).strip()


def _sort_key(p: dict):
    return (0 if p.get("pinned") else 1, -(p.get("upvotes") or 0))


def import_posts(posts: list[dict], community: str, api: LmsApi) -> dict:
    report = {"program": community, "courses": 0, "lessons": 0, "errors": []}
    prog_id = f"program_communaute_{slugify(community)}"
    api.create_program(prog_id, f"Communauté — {community}", None)

    substantive = [p for p in posts if len((p.get("content") or "")) > 50 or p.get("attachments")]
    resources = sorted([p for p in substantive if p.get("pinned") or p.get("attachments")], key=_sort_key)
    res_ids = {p["id"] for p in resources}
    discussions = sorted([p for p in substantive if p["id"] not in res_ids], key=_sort_key)

    courses = [
        ("epingles-ressources", "📌 Épinglés & Ressources", resources),
        ("discussions", "💬 Discussions", discussions),
    ]
    for ci, (slug, name, bucket) in enumerate(courses, start=1):
        if not bucket:
            continue
        course_id = f"course_posts_{slugify(community)}_{slug}"
        api.upsert("courses", {"id": course_id, "name": name, "description": f"{len(bucket)} posts",
                               "progressionMode": "free", "programId": prog_id, "sysOrderIndex": ci,
                               "mediaJson": []}, report)
        report["courses"] += 1
        sec_id = f"sec_posts_{slugify(community)}_{slug}"
        api.upsert("classes", {"id": sec_id, "courseId": course_id, "nodeKind": "SECTION",
                               "name": "Posts", "sysOrderIndex": 1}, report)
        for li, p in enumerate(bucket, start=1):
            api.upsert("classes", {
                "id": f"les_post_{p['id']}", "courseId": course_id, "parentClassId": sec_id,
                "nodeKind": "LESSON", "name": _title_for(p), "sysOrderIndex": li,
                "stepType": "CONTENT", "contentMd": _lesson_md(p), "mediaJson": [],
            }, report)
            report["lessons"] += 1
    return report


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-root", required=True)
    ap.add_argument("--community", required=True, help='Display name, e.g. "Génération IA".')
    ap.add_argument("--sleep-ms", type=int, default=60)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    root = Path(args.data_root)
    posts_p = root / "_raw" / "community_posts_full.json"
    if not posts_p.exists():
        print(f"FATAL: {posts_p} missing — run crawl-posts first.", file=sys.stderr)
        return 2
    posts = json.loads(posts_p.read_text())
    api = LmsApi(args.dry_run, args.sleep_ms)
    rep = import_posts(posts, args.community, api)
    print(f"\n{'[DRY] ' if args.dry_run else ''}program '{rep['program']}': "
          f"{rep['courses']} courses, {rep['lessons']} post-lessons, {len(rep['errors'])} errors")
    for e in rep["errors"][:10]:
        print("  !", e)
    return 0 if not rep["errors"] else 1


if __name__ == "__main__":
    sys.exit(main())
