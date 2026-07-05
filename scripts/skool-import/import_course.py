#!/usr/bin/env python3
"""import_course.py — upload one Skool course into tpb-lms, 100% via the API.

Self-contained importer (initiative `2026-07-05_skool-classroom-upload-and-video-provider-port`).
Zero re-hosting, zero external push:

- structure (course / sections / lessons) via `POST /api/courses` + `POST /api/classes`
  then `PATCH` to refresh fields → idempotent (deterministic ids from Skool ids).
- lesson text = inline `contentMd` (raw_json.tpb_content_md, rendered inline by the viewer).
- videos = direct Loom / YouTube embeds (media VIDEO url, no re-host).
- course cover = the public Skool CDN url (media IMAGE).
- markdown body images (relative disk paths) → rewritten to their public Skool CDN url
  via `_asset_urls.resolve_asset_url` (reverse of the extractor's asset_url_to_local map).

Auth: the `app_lms` service-token PAT (vault `tpb/apps/lms/bastion_token`, carries `lms:*`).

Usable standalone (one course) or imported (`import_one_course`) by `import_all.py`.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

import httpx
from tpb_sdk.bastion import BastionClient

from _asset_urls import resolve_asset_url

LMS = "https://lms-api.matthieu-marielouise.workers.dev"
VAULT_PAT_PATH = "tpb/apps/lms/bastion_token"

_IMG_RE = re.compile(r"!\[([^\]]*)\]\(([^)\s]+)(\s+\"[^\"]*\")?\)")
_PREFIX_RE = re.compile(r"^\d+_")
_SLUG_STRIP_RE = re.compile(r"[^a-z0-9\s-]")


def slugify(s: str) -> str:
    """Skool-style slug: lowercase, drop non-alnum (keep space/hyphen), spaces→hyphens."""
    s = _SLUG_STRIP_RE.sub("", s.lower())
    return re.sub(r"-+", "-", re.sub(r"\s+", "-", s)).strip("-")


def _after_prefix(name: str) -> str:
    """Strip the leading `NN_` ordinal prefix from a dir/file name."""
    return _PREFIX_RE.sub("", name)


def align(titles: list[str], candidates: list) -> list:
    """Map each title to a candidate path: slug-match first (robust to extra/misordered
    dirs like a course-level 'about' section), then assign leftovers by order. Returns a
    list of (candidate | None, method) aligned to `titles`. `candidate.name` / `.stem` is
    slugified after stripping its numeric prefix."""
    slug_index: dict[str, object] = {}
    for c in candidates:
        stem = c.stem if c.is_file() else c.name
        slug_index.setdefault(slugify(_after_prefix(stem)), c)
    used: set = set()
    result: list = [None] * len(titles)
    # pass 1 — slug match
    for i, t in enumerate(titles):
        c = slug_index.get(slugify(t))
        if c is not None and c not in used:
            used.add(c)
            result[i] = (c, "slug")
    # pass 2 — leftovers by order
    leftover = [c for c in candidates if c not in used]
    li = 0
    for i in range(len(titles)):
        if result[i] is None:
            result[i] = (leftover[li], "order") if li < len(leftover) else (None, "missing")
            if li < len(leftover):
                used.add(leftover[li])
                li += 1
    return result


def classify_video(url: str | None) -> str | None:
    """loom | youtube | other | None — mirrors the frontend parseMediaUrl sources."""
    if not url:
        return None
    if "loom.com" in url:
        return "loom"
    if "youtu.be" in url or "youtube.com" in url:
        return "youtube"
    return "other"


def strip_metadata_header(md: str) -> str:
    """Drop the leading extractor metadata block (title + breadcrumb + Video/MP4/Duration/
    Thumbnail/Updated bullets) up to and including the first `---` rule."""
    lines = md.splitlines()
    for i, ln in enumerate(lines):
        if ln.strip() == "---":
            return "\n".join(lines[i + 1 :]).lstrip("\n")
    return md  # no separator → keep whole file


def rewrite_images_to_cdn(md: str, md_path: Path, data_root: Path, report: dict) -> str:
    """Rewrite relative markdown image refs to their public Skool CDN url. Unmapped/relative
    refs are LEFT AS-IS with a visible WARNING (never silently dropped, § ALWAYS FAIL HARD)."""

    def repl(m: re.Match) -> str:
        alt, url, title = m.group(1), m.group(2), m.group(3) or ""
        if url.startswith(("http://", "https://", "data:")):
            return m.group(0)
        cdn = resolve_asset_url(url, md_path, data_root)
        if cdn:
            report["img_cdn"] += 1
            return f"![{alt}]({cdn}{title})"
        report["img_unmapped"] += 1
        report.setdefault("unmapped_refs", []).append(url)
        print(f"      ! asset not in map, left as-is: {url}")
        return m.group(0)

    return _IMG_RE.sub(repl, md)


class LmsApi:
    def __init__(self, dry_run: bool, sleep_ms: int = 60) -> None:
        self.dry_run = dry_run
        self.sleep_s = sleep_ms / 1000.0
        bc = BastionClient.from_devcontainer()
        pat = bc.get_secret(VAULT_PAT_PATH)
        if not pat:
            print(f"FATAL: no PAT at {VAULT_PAT_PATH}", file=sys.stderr)
            sys.exit(2)
        self.h = {**dict(bc.headers), "Authorization": f"Bearer {pat}", "Content-Type": "application/json"}
        self.cl = httpx.Client(timeout=40, headers=self.h)

    def _req(self, method: str, url: str, json_body: dict) -> httpx.Response | None:
        """One request that backs off on 429 (respecting Retry-After — the LMS limits
        POST /api/{coll} to 100/min per IP) and retries transient failures (timeout / 5xx)."""
        transient_left = 2
        rate_waits_left = 12
        while True:
            try:
                r = self.cl.request(method, url, json=json_body)
            except (httpx.TimeoutException, httpx.TransportError) as e:
                if transient_left <= 0:
                    print(f"      ! {method} {url} transport error: {e}")
                    return None
                transient_left -= 1
                time.sleep(0.5)
                continue
            if r.status_code == 429 and rate_waits_left > 0:
                retry_after = int(r.headers.get("Retry-After") or "5")
                time.sleep(min(max(retry_after, 1), 60) + 1)
                rate_waits_left -= 1
                continue
            if r.status_code >= 500 and transient_left > 0:
                transient_left -= 1
                time.sleep(0.5)
                continue
            return r

    def upsert(self, coll: str, body: dict, report: dict) -> None:
        """POST (create-if-absent, idempotent by id) then PATCH (refresh fields)."""
        label = f"{coll[:-1]} {body.get('name', '')[:38]!r} ({body['id']})"
        if self.dry_run:
            return
        r = self._req("POST", f"{LMS}/api/{coll}", body)
        if r is None or r.status_code not in (200, 201):
            msg = f"POST {coll} {label} -> {getattr(r, 'status_code', 'ERR')} {getattr(r, 'text', '')[:140]}"
            report["errors"].append(msg)
            print(f"      ! {msg}")
            return
        patch = {k: v for k, v in body.items() if k not in ("id", "courseId", "nodeKind", "parentClassId")}
        p = self._req("PATCH", f"{LMS}/api/{coll}/{body['id']}", patch)
        if p is None or p.status_code != 200:
            msg = f"PATCH {coll} {label} -> {getattr(p, 'status_code', 'ERR')} {getattr(p, 'text', '')[:140]}"
            report["errors"].append(msg)
            print(f"      ! {msg}")
        if self.sleep_s:
            time.sleep(self.sleep_s)

    def create_program(self, program_id: str, name: str, cover_url: str | None) -> bool:
        """POST /api/programs (idempotent by deterministic id; no update endpoint)."""
        if self.dry_run:
            print(f"  [dry-run] program {name!r} ({program_id})")
            return True
        body = {"id": program_id, "name": name,
                "mediaJson": [{"type": "IMAGE", "url": cover_url, "name": "cover"}] if cover_url else []}
        r = self._req("POST", f"{LMS}/api/programs", body)
        ok = r is not None and r.status_code in (200, 201)
        print(f"  {'OK' if ok else '!'} program {name!r} ({program_id})"
              + ("" if ok else f" -> {getattr(r, 'status_code', 'ERR')} {getattr(r, 'text', '')[:120]}"))
        return ok


def import_one_course(course: dict, classroom_dir: Path, api: LmsApi, data_root: Path,
                      progression_mode: str, program_id: str | None = None,
                      sys_order_index: int | None = None) -> dict:
    """Upload one course tree (course → SECTION → LESSON) and return a report dict.
    program_id attaches the course to its Program (Plan 10) ; sys_order_index sets its
    position in the classroom (Plan 12, from the course_trees.json order)."""
    report = {"course": course["title"], "sections": 0, "lessons": 0, "loom": 0,
              "youtube": 0, "other_vid": 0, "no_vid": 0, "img_cdn": 0, "img_unmapped": 0,
              "warnings": [], "errors": []}

    course_id = f"course_{course['id']}"
    sets = [c for c in course.get("children", []) if c.get("type") == "set"]
    section_dirs = sorted(d for d in classroom_dir.iterdir() if d.is_dir()) if classroom_dir.is_dir() else []

    cover = course.get("coverImage")
    course_body = {
        "id": course_id, "name": course["title"], "description": course.get("desc") or "",
        "progressionMode": progression_mode,
        "mediaJson": [{"type": "IMAGE", "url": cover, "name": "cover"}] if cover else [],
    }
    if program_id:
        course_body["programId"] = program_id
    if sys_order_index is not None:
        course_body["sysOrderIndex"] = sys_order_index
    api.upsert("courses", course_body, report)

    # Slug-match each tree set to its disk dir (robust to extra dirs like a course-level
    # 'about' section that has no set), order-fallback for leftovers.
    sec_matches = align([s["title"] for s in sets], section_dirs)

    print(f"  Course {course['title']!r} → {course_id} ({len(sets)} sections)")
    for si, s in enumerate(sets):
        sec_id = f"sec_{s['id']}"
        api.upsert("classes", {
            "id": sec_id, "courseId": course_id, "nodeKind": "SECTION",
            "name": s["title"], "sysOrderIndex": si + 1,
        }, report)
        report["sections"] += 1

        sec_dir, sec_method = sec_matches[si]
        if sec_dir is None:
            report["warnings"].append(f"no disk dir for section '{s['title']}'")
            print(f"    ! no disk dir for section {s['title']!r}")
        elif sec_method == "order":
            report["warnings"].append(f"section '{s['title']}' matched by ORDER → {sec_dir.name}")
            print(f"    ~ section {s['title']!r} matched by order → {sec_dir.name}")

        modules = [c for c in s.get("children", []) if c.get("type") == "module"]
        md_files = (sorted(f for f in sec_dir.glob("*.md") if f.name.lower() != "readme.md")
                    if sec_dir is not None else [])
        mod_matches = align([m["title"] for m in modules], md_files)

        for mi, m in enumerate(modules):
            body_md = ""
            md_file, mod_method = mod_matches[mi]
            if md_file is not None:
                if mod_method == "order":
                    report["warnings"].append(f"lesson '{m['title'][:40]}' matched by ORDER → {md_file.name}")
                body_md = rewrite_images_to_cdn(strip_metadata_header(md_file.read_text()), md_file, data_root, report)
            else:
                report["warnings"].append(f"no md file for module '{m['title']}'")

            vid = m.get("videoLink")
            kind = classify_video(vid)
            if kind == "loom":
                report["loom"] += 1
            elif kind == "youtube":
                report["youtube"] += 1
            elif kind == "other":
                report["other_vid"] += 1
            else:
                report["no_vid"] += 1
            media = [{"type": "VIDEO", "url": vid, "name": m["title"]}] if vid else []

            api.upsert("classes", {
                "id": f"les_{m['id']}", "courseId": course_id, "parentClassId": sec_id,
                "nodeKind": "LESSON", "name": m["title"], "sysOrderIndex": mi + 1,
                "stepType": "MIXED" if vid else "CONTENT", "contentMd": body_md, "mediaJson": media,
            }, report)
            report["lessons"] += 1

    return report


def _classroom_dir_for(root: Path, course_key: str, tree: dict, override: str | None) -> Path:
    """Map a course key to its classroom/<subdir> by tree order ↔ sorted classroom dirs."""
    if override:
        return root / "classroom" / override
    keys = list(tree.keys())
    dirs = sorted(d for d in (root / "classroom").iterdir() if d.is_dir())
    idx = keys.index(course_key)
    return dirs[idx] if idx < len(dirs) else (root / "classroom" / course_key)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-root", required=True)
    ap.add_argument("--course-key", required=True)
    ap.add_argument("--classroom-subdir", default=None, help="override the auto-mapped subdir")
    ap.add_argument("--progression-mode", default="free", choices=["free", "linear"])
    ap.add_argument("--sleep-ms", type=int, default=60)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    root = Path(args.data_root)
    tree = json.loads((root / "_raw" / "course_trees.json").read_text())
    course = tree.get(args.course_key)
    if not course:
        print(f"FATAL: course key {args.course_key} not in tree", file=sys.stderr)
        return 2
    classroom_dir = _classroom_dir_for(root, args.course_key, tree, args.classroom_subdir)

    api = LmsApi(args.dry_run, args.sleep_ms)
    rep = import_one_course(course, classroom_dir, api, root, args.progression_mode)
    print(f"\n{'[dry-run] ' if args.dry_run else ''}{rep['course']}: "
          f"{rep['sections']} sections · {rep['lessons']} lessons · "
          f"loom {rep['loom']} / yt {rep['youtube']} / other {rep['other_vid']} / none {rep['no_vid']} · "
          f"img cdn {rep['img_cdn']} / unmapped {rep['img_unmapped']} · "
          f"warnings {len(rep['warnings'])} · errors {len(rep['errors'])}")
    return 1 if rep["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
