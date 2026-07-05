#!/usr/bin/env python3
"""import_all.py — batch driver over the 12 Maker School courses.

Walks `course_trees.json` (tree order), skips empty courses (WIP), and imports each via
`import_one_course`. Idempotent (POST create + PATCH refresh by deterministic id), so any
run is safely re-runnable. Aggregates a per-course report table.

Usage:
  python3 import_all.py --data-root "<…/Nick Saraev - Maker School>" [--dry-run]
      [--only <key> …] [--skip <key> …] [--from <key>] [--sleep-ms 60]
      [--progression-mode free]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from import_course import LmsApi, import_one_course, _classroom_dir_for


def _program_id(name: str) -> str:
    slug = re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", name.lower())).strip("-")
    return f"program_{slug}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-root", required=True)
    ap.add_argument("--only", action="append", default=[], help="course key (repeatable)")
    ap.add_argument("--skip", action="append", default=[], help="course key to skip (repeatable)")
    ap.add_argument("--from", dest="from_key", default=None, help="resume from this key (tree order)")
    ap.add_argument("--progression-mode", default="free", choices=["free", "linear"])
    ap.add_argument("--program-name", default=None, help="group the imported courses under this Program (Plan 10)")
    ap.add_argument("--sleep-ms", type=int, default=60)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    root = Path(args.data_root)
    tree = json.loads((root / "_raw" / "course_trees.json").read_text())
    keys = list(tree.keys())

    if args.from_key:
        if args.from_key not in keys:
            print(f"FATAL: --from {args.from_key} not a course key", file=sys.stderr)
            return 2
        keys = keys[keys.index(args.from_key):]
    selected = []
    for k in keys:
        if args.only and k not in args.only:
            continue
        if k in args.skip:
            continue
        c = tree[k]
        n_mod = sum(len(s.get("children", [])) for s in c.get("children", []) if s.get("type") == "set")
        if n_mod == 0:
            print(f"skip empty course {k} ({c.get('title')})")
            continue
        selected.append(k)

    if not selected:
        print("nothing selected", file=sys.stderr)
        return 2

    api = LmsApi(args.dry_run, args.sleep_ms)

    # Optional Program grouping (Plan 10): create it once, cover = first selected
    # course's Skool cover, then attach every imported course to it.
    program_id = None
    if args.program_name:
        program_id = _program_id(args.program_name)
        cover = next((tree[k].get("coverImage") for k in selected if tree[k].get("coverImage")), None)
        api.create_program(program_id, args.program_name, cover)

    # Course order = position in course_trees.json (the Skool classroom order), 1-based.
    order_of = {k: i + 1 for i, k in enumerate(tree.keys())}

    reports = []
    for k in selected:
        classroom_dir = _classroom_dir_for(root, k, tree, None)
        rep = import_one_course(tree[k], classroom_dir, api, root, args.progression_mode,
                                program_id, order_of.get(k))
        rep["key"] = k
        reports.append(rep)

    # aggregate table
    print(f"\n{'=' * 96}\n{'[DRY-RUN] ' if args.dry_run else ''}BATCH REPORT")
    print(f"{'key':9} {'course':32} {'sec':>4}{'les':>5}{'loom':>5}{'yt':>4}{'oth':>4}{'none':>5}{'imgC':>5}{'imgU':>5}{'warn':>5}{'err':>4}")
    tot = {k: 0 for k in ("sections", "lessons", "loom", "youtube", "other_vid", "no_vid", "img_cdn", "img_unmapped")}
    n_warn = n_err = 0
    for r in reports:
        print(f"{r['key']:9} {r['course'][:32]:32} {r['sections']:>4}{r['lessons']:>5}{r['loom']:>5}"
              f"{r['youtube']:>4}{r['other_vid']:>4}{r['no_vid']:>5}{r['img_cdn']:>5}{r['img_unmapped']:>5}"
              f"{len(r['warnings']):>5}{len(r['errors']):>4}")
        for kk in tot:
            tot[kk] += r[kk]
        n_warn += len(r["warnings"])
        n_err += len(r["errors"])
    print(f"{'TOTAL':9} {len(reports):>36} courses {tot['sections']:>4}{tot['lessons']:>5}"
          f"{tot['loom']:>5}{tot['youtube']:>4}{tot['other_vid']:>4}{tot['no_vid']:>5}"
          f"{tot['img_cdn']:>5}{tot['img_unmapped']:>5}{n_warn:>5}{n_err:>4}")

    if n_err:
        print(f"\n{n_err} error(s) across the batch — see per-course lines above.")
    return 1 if n_err else 0


if __name__ == "__main__":
    raise SystemExit(main())
