#!/usr/bin/env python3
"""Executable assertions for Plan 04 — Unified.to semantic decouple + YouTube hosting."""
from __future__ import annotations

import pathlib
import re
import sys

LMS = pathlib.Path(__file__).resolve().parents[2]
FAILS: list[str] = []


def check(cond: bool, msg: str) -> None:
    """Record a failure message when the assertion condition is false.

    Args:
        cond: The assertion that must hold true.
        msg: The message recorded when ``cond`` is false.
    """
    if not cond:
        FAILS.append(msg)


def read(p: pathlib.Path) -> str:
    """Return the file text, or an empty string when the file is absent.

    Args:
        p: Path to the file to read.
    """
    return p.read_text(encoding="utf-8") if p.exists() else ""


# 1. Zero RUNTIME unified.to dependency (a live fetch/http to unified.to).
for f in LMS.rglob("backend/**/*.ts"):
    if "node_modules" in str(f):
        continue
    txt = read(f)
    check(not re.search(r"(fetch|https?://)[^\n]*unified", txt, re.IGNORECASE),
          f"runtime unified.to reference in {f.name}")
for f in LMS.rglob("backend/**/*.js"):
    if "node_modules" in str(f):
        continue
    txt = read(f)
    check(not re.search(r"(fetch|https?://)[^\n]*unified", txt, re.IGNORECASE),
          f"runtime unified.to reference in {f.name}")

# 2. Dependency-implying comments reworded (connection_id, storage types, migration).
mig = read(LMS / "db/migrations/005_byoc_cloud_content.sql")
check("Unified.to connection ID" not in mig, "005 still labels connection_id as 'Unified.to connection ID'")
check("tpb-storage" in mig, "005 must clarify native tpb-storage resolution")
conn = read(LMS / "backend/services/types/ConnectionInfo.ts")
check("Unified.to storage connection" not in conn, "ConnectionInfo still says 'Unified.to storage connection'")
sf = read(LMS / "backend/services/types/StorageFile.ts")
check("Unified.to storage file" not in sf, "StorageFile still says 'Unified.to storage file'")

# 3. schema.sql header clarifies reference-only (naming alignment KEPT, dependency removed).
schema = read(LMS / "db/schema.sql")
check("REFERENCE ONLY, no runtime dependency" in schema, "schema.sql header must clarify reference-only")

# 4. BYOC pattern preserved (lms_content_ref survives — only de-unified-to-ified).
check("CREATE TABLE IF NOT EXISTS lms_content_ref" in mig, "BYOC lms_content_ref must be preserved")

# 5. YouTube video-hosting capability locked by a test.
vh = read(LMS / "backend/services/courses/videoHosting.test.js")
check("youtube.com" in vh and "type).toBe('VIDEO')" in vh,
      "video hosting test must assert a YouTube VIDEO url passthrough")

if FAILS:
    print("PLAN 04 ASSERTIONS FAILED:")
    for f in FAILS:
        print(f"  - {f}")
    sys.exit(1)
print("PLAN 04 assertions: all pass")
