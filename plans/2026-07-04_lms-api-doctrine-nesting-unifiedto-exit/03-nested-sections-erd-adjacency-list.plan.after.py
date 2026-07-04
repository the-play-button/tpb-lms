#!/usr/bin/env python3
"""Executable assertions for Plan 03 — nested sections (adjacency-list on lms_class).

Run from anywhere; paths are resolved relative to the tpb-lms repo root.
Exits 0 if all assertions hold, 1 otherwise.
"""
from __future__ import annotations

import pathlib
import sys

LMS = pathlib.Path(__file__).resolve().parents[2]  # .../tpb-lms
FAILS: list[str] = []


def check(cond: bool, msg: str) -> None:
    """Record a failure message when the assertion condition is false."""
    if not cond:
        FAILS.append(msg)


def read(p: pathlib.Path) -> str:
    """Return the file text, or an empty string when the file does not exist."""
    return p.read_text(encoding="utf-8") if p.exists() else ""


# 1. Migration 006 exists + declares the 2 columns + index.
mig = read(LMS / "db/migrations/006_nested_sections.sql")
check("ADD COLUMN parent_class_id" in mig, "006 migration missing parent_class_id column")
check("ADD COLUMN node_kind" in mig, "006 migration missing node_kind column")
check("idx_lms_class_parent" in mig, "006 migration missing idx_lms_class_parent index")

# 2. schema.sql documents the tree (comment) + tpb_section soft-label removed as active.
schema = read(LMS / "db/schema.sql")
check("parent_class_id" in schema and "node_kind" in schema,
      "schema.sql lms_class comment must document parent_class_id + node_kind")
check("adjacency-list" in schema.lower(), "schema.sql should mention the adjacency-list pattern")
# tpb_section must no longer be advertised as the section mechanism (only referenced as removed).
check("Optional section grouping" not in schema,
      "schema.sql still advertises tpb_section soft-label as the grouping mechanism")

# 3. Backfill script exists + idempotent-by-construction (INSERT OR IGNORE, json_remove).
backfill = read(LMS / "db/migrations/006_backfill_sections.mjs")
check(bool(backfill), "006_backfill_sections.mjs missing")
check("INSERT OR IGNORE INTO lms_class" in backfill, "backfill must use INSERT OR IGNORE (idempotent)")
check("json_remove" in backfill and "tpb_section" in backfill,
      "backfill must strip tpb_section via json_remove")

# 4. getCourse returns a nested nodes[] tree + flat classes.
svc = read(LMS / "backend/services/courses/CoursesService.js")
check("buildAdjacency" in svc, "CoursesService missing buildAdjacency (tree builder)")
check("flattenLessonsDFS" in svc, "CoursesService missing flattenLessonsDFS (DFS leaf order)")
check("buildDisplayTree" in svc, "CoursesService missing buildDisplayTree")
check("nodes," in svc or "nodes:" in svc, "getCourse body must expose the nodes[] tree")
check("parent_class_id" in svc and "node_kind" in svc,
      "queryCourseClasses must select parent_class_id + node_kind")
# dead code removed
check("const processClasses" not in svc, "dead processClasses() must be removed")

# 5. ERD doc updated.
erd = read(LMS / "schema.erd.md")
check("parent_class_id" in erd, "schema.erd.md lms_class must show parent_class_id")
check("lms_class ||--o| lms_class" in erd, "schema.erd.md must show the lms_class self-parent relation")

if FAILS:
    print("PLAN 03 ASSERTIONS FAILED:")
    for f in FAILS:
        print(f"  - {f}")
    sys.exit(1)
print("PLAN 03 assertions: all pass")
