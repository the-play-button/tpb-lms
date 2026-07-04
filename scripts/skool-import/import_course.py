#!/usr/bin/env python3
"""import_course.py — upload one Skool course into tpb-lms, 100% via the API.

Self-contained POC importer (initiative `2026-07-05_skool-classroom-upload-and-video-provider-port`
Plan 03). Zero external hosting:

- structure (course / sections / lessons) via `POST /api/courses` + `POST /api/classes`
  then `PATCH` to refresh fields → idempotent (deterministic ids derived from Skool ids).
- lesson text = inline `contentMd` (raw_json.tpb_content_md, rendered inline by the viewer).
- videos = direct Loom / YouTube embeds (media VIDEO url, no re-host).
- course cover = the public Skool CDN url (media IMAGE).
- markdown body images (relative disk paths) → inlined as base64 data URIs.

Auth: the `app_lms` service-token PAT (vault `tpb/apps/lms/bastion_token`), which
carries `lms:*` (→ lms:course:write / lms:class:write via prefix-wildcard hasScope,
SDK ≥ 15.17). CF Access SA + Bearer PAT via `BastionClient.from_devcontainer()`.

Usage:
  python3 import_course.py \
      --data-root "/…/Nick Saraev - Maker School" \
      --course-key ab5cf4d1 \
      --classroom-subdir 01_pre-program-start-here \
      --progression-mode free \
      [--dry-run]
"""
from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import re
import sys
from pathlib import Path

import httpx
from tpb_sdk.bastion import BastionClient

LMS = "https://lms-api.matthieu-marielouise.workers.dev"
VAULT_PAT_PATH = "tpb/apps/lms/bastion_token"

_IMG_RE = re.compile(r"!\[([^\]]*)\]\(([^)\s]+)(\s+\"[^\"]*\")?\)")


def strip_metadata_header(md: str) -> str:
    """Drop the leading extractor metadata block (title + breadcrumb + Video/MP4/
    Duration/Thumbnail/Updated bullets) up to and including the first `---` rule."""
    lines = md.splitlines()
    for i, ln in enumerate(lines):
        if ln.strip() == "---":
            return "\n".join(lines[i + 1 :]).lstrip("\n")
    return md  # no separator → keep whole file


def inline_relative_images(md: str, md_path: Path) -> tuple[str, int]:
    """Rewrite relative image refs to base64 data URIs (self-contained, no host)."""
    count = 0

    def repl(m: re.Match) -> str:
        nonlocal count
        alt, url, title = m.group(1), m.group(2), m.group(3) or ""
        if url.startswith(("http://", "https://", "data:")):
            return m.group(0)
        target = (md_path.parent / url).resolve()
        if not target.is_file():
            print(f"    ! missing image {url} → left as-is")
            return m.group(0)
        mime = mimetypes.guess_type(str(target))[0] or "image/jpeg"
        b64 = base64.b64encode(target.read_bytes()).decode("ascii")
        count += 1
        return f"![{alt}](data:{mime};base64,{b64}{title})"

    return _IMG_RE.sub(repl, md), count


class LmsApi:
    def __init__(self, dry_run: bool) -> None:
        self.dry_run = dry_run
        bc = BastionClient.from_devcontainer()
        pat = bc.get_secret(VAULT_PAT_PATH)
        if not pat:
            print(f"FATAL: no PAT at {VAULT_PAT_PATH}", file=sys.stderr)
            sys.exit(2)
        self.h = {**dict(bc.headers), "Authorization": f"Bearer {pat}", "Content-Type": "application/json"}
        self.cl = httpx.Client(timeout=30, headers=self.h)

    def _upsert(self, kind: str, coll: str, id_path: str, body: dict) -> None:
        """POST (create-if-absent, idempotent by id) then PATCH (refresh fields)."""
        label = f"{kind} {body.get('name', '')[:40]!r} ({body['id']})"
        if self.dry_run:
            print(f"    [dry-run] upsert {label}")
            return
        r = self.cl.post(f"{LMS}/api/{coll}", json=body)
        if r.status_code not in (200, 201):
            print(f"    ! POST {coll} {label} -> {r.status_code} {r.text[:160]}")
            return
        patch = {k: v for k, v in body.items() if k not in ("id", "courseId", "nodeKind", "parentClassId")}
        p = self.cl.patch(f"{LMS}/api/{coll}/{body['id']}", json=patch)
        ok = p.status_code == 200
        print(f"    {'OK' if ok else '!'} upsert {label}" + ("" if ok else f" (PATCH {p.status_code} {p.text[:120]})"))

    def upsert_course(self, body: dict) -> None:
        self._upsert("course", "courses", body["id"], body)

    def upsert_class(self, body: dict) -> None:
        self._upsert(body["nodeKind"].lower(), "classes", body["id"], body)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-root", required=True, help="Path to the '<Author> - <School>' dir")
    ap.add_argument("--course-key", required=True, help="Key in _raw/course_trees.json (e.g. ab5cf4d1)")
    ap.add_argument("--classroom-subdir", required=True, help="e.g. 01_pre-program-start-here")
    ap.add_argument("--progression-mode", default="free", choices=["free", "linear"])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    root = Path(args.data_root)
    tree = json.loads((root / "_raw" / "course_trees.json").read_text())
    course = tree.get(args.course_key)
    if not course:
        print(f"FATAL: course key {args.course_key} not in tree", file=sys.stderr)
        return 2

    classroom_dir = root / "classroom" / args.classroom_subdir
    section_dirs = sorted(d for d in classroom_dir.iterdir() if d.is_dir())
    sets = [c for c in course.get("children", []) if c.get("type") == "set"]

    api = LmsApi(args.dry_run)
    course_id = f"course_{course['id']}"
    print(f"Course: {course['title']!r} → {course_id} ({len(sets)} sections)")

    cover = course.get("coverImage")
    api.upsert_course({
        "id": course_id,
        "name": course["title"],
        "description": course.get("desc") or "",
        "progressionMode": args.progression_mode,
        "mediaJson": [{"type": "IMAGE", "url": cover, "name": "cover"}] if cover else [],
    })

    n_sec = n_les = 0
    for si, s in enumerate(sets):
        sec_id = f"sec_{s['id']}"
        api.upsert_class({
            "id": sec_id, "courseId": course_id, "nodeKind": "SECTION",
            "name": s["title"], "sysOrderIndex": si + 1,
        })
        n_sec += 1

        modules = [c for c in s.get("children", []) if c.get("type") == "module"]
        md_files = sorted(f for f in section_dirs[si].glob("*.md") if f.name.lower() != "readme.md") if si < len(section_dirs) else []
        for mi, m in enumerate(modules):
            body_md = ""
            n_img = 0
            if mi < len(md_files):
                raw_md = md_files[mi].read_text()
                body_md, n_img = inline_relative_images(strip_metadata_header(raw_md), md_files[mi])
            media = []
            vid = m.get("videoLink")
            if vid:
                media.append({"type": "VIDEO", "url": vid, "name": m["title"]})
            api.upsert_class({
                "id": f"les_{m['id']}", "courseId": course_id, "parentClassId": sec_id,
                "nodeKind": "LESSON", "name": m["title"], "sysOrderIndex": mi + 1,
                "stepType": "MIXED" if vid else "CONTENT",
                "contentMd": body_md,
                "mediaJson": media,
            })
            n_les += 1
            print(f"      lesson {m['title'][:44]!r} vid={'Y' if vid else '-'} img={n_img} md={len(body_md)}c")

    print(f"\nDONE — course + {n_sec} sections + {n_les} lessons {'(dry-run)' if args.dry_run else 'upserted'}.")
    print(f"View: https://lms.theplaybutton.dev  (course id {course_id})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
