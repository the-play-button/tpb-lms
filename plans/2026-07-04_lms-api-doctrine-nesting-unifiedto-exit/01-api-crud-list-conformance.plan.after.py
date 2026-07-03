#!/usr/bin/env python3
"""Executable assertions for Plan 01 — API CRUD/list conformance (delivered scope)."""
from __future__ import annotations

import pathlib
import sys

LMS = pathlib.Path(__file__).resolve().parents[2]
APP = LMS / "backend/lms/application"
FAILS: list[str] = []


def check(cond: bool, msg: str) -> None:
    if not cond:
        FAILS.append(msg)


def read(p: pathlib.Path) -> str:
    return p.read_text(encoding="utf-8") if p.exists() else ""


idx = read(LMS / "backend/index.js")

# A. Aliases deleted.
check("/api/soms" not in idx, "alias /api/soms still present")
check("/api/profile" not in idx, "alias /api/profile still present")

# C/E. sharing use-cases renamed to blessed CRUD prefixes (application/, entropy layer).
for d in ["createShare", "deleteShare", "listSharedByMe", "listSharedWithMe"]:
    check((APP / "sharing" / d).is_dir(), f"sharing/{d} dir missing")
for old in ["shareContent", "revokeShare"]:
    check(not (APP / "sharing" / old).exists(), f"old sharing/{old} dir still present")
check(not (APP / "sharing" / "sharedByMeController.ts").exists(), "flat sharedByMeController still present")
check(not (APP / "sharing" / "sharedWithMeController.ts").exists(), "flat sharedWithMeController still present")
for ctrl in ["createShareController", "deleteShareController", "listSharedByMeController", "listSharedWithMeController"]:
    check(ctrl in idx, f"index.js does not reference {ctrl}")

# B. Safe handler verb-renames (no logic change).
check("deleteAPIKeyHandler" in idx and "revokeAPIKeyHandler" not in idx, "revokeAPIKeyHandler not renamed to deleteAPIKeyHandler")
check("createGlossaryTerm" in idx, "addGlossaryTerm not renamed to createGlossaryTerm")
check("deleteCourseSignals" in idx and "resetCourseSignals" not in idx, "resetCourseSignals not renamed to deleteCourseSignals")
# signals reset is now a DELETE (state-transition -> delete).
check("DELETE', path: '/api/signals/:courseId'" in idx, "signals reset not migrated to DELETE /api/signals/:courseId")
check("/api/signals/:courseId/reset" not in idx, "old POST /api/signals/:courseId/reset still present")

# No dangling old identifiers in source.
for stale in ["shareContentController", "revokeShareController", "sharedByMeController", "sharedWithMeController"]:
    check(stale not in idx, f"stale identifier {stale} still in index.js")

if FAILS:
    print("PLAN 01 ASSERTIONS FAILED:")
    for f in FAILS:
        print(f"  - {f}")
    sys.exit(1)
print("PLAN 01 assertions (delivered scope): all pass")
