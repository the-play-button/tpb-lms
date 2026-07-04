#!/usr/bin/env python3
"""Executable assertions for Plan 02 — content-authoring CRUD API."""
from __future__ import annotations

import pathlib
import sys

LMS = pathlib.Path(__file__).resolve().parents[2]
APP = LMS / "backend/lms/application"
FAILS: list[str] = []

STEPS = [
    "ValidateInput", "HydrateContext", "ValidateContext", "CheckPolicies",
    "Execute", "Filter", "Track", "Handle", "Controller",
]
USECASES = {
    "courses/createCourse": "createCourse",
    "courses/updateCourse": "updateCourse",
    "courses/deleteCourse": "deleteCourse",
    "classes/createClass": "createClass",
    "classes/updateClass": "updateClass",
    "classes/deleteClass": "deleteClass",
}


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


# 1. Each use-case has its 9 step files + index barrel.
for rel, name in USECASES.items():
    d = APP / rel
    check((d / "index.ts").exists(), f"{rel}/index.ts missing")
    for step in STEPS:
        f = d / f"{name}{step}.ts"
        check(f.exists(), f"{rel}/{name}{step}.ts missing")

# 2. Repositories + context + shared helper exist.
# Domain ports (Plan 05) + their D1 implementations.
check((LMS / "backend/lms/domain/repositories/LmsCourseRepository.ts").exists(), "LmsCourseRepository port missing")
check((LMS / "backend/lms/domain/repositories/LmsClassRepository.ts").exists(), "LmsClassRepository port missing")
check((LMS / "backend/lms/infrastructure/repositories/LmsCourseDatabaseRepository.ts").exists(), "LmsCourseDatabaseRepository missing")
check((LMS / "backend/lms/infrastructure/repositories/LmsClassDatabaseRepository.ts").exists(), "LmsClassDatabaseRepository missing")
check((LMS / "backend/lms/types/AuthoringContext.ts").exists(), "AuthoringContext type missing")
check((LMS / "backend/handlers/authoringContext.ts").exists(), "createAuthoringContext bridge missing")
check((APP / "_shared/httpStatus.ts").exists(), "_shared/httpStatus.ts missing")

# 3. Routes wired in index.js.
idx = read(LMS / "backend/index.js")
for route in [
    "POST',   path: '/api/courses'",
    "PATCH',  path: '/api/courses/:courseId'",
    "DELETE', path: '/api/courses/:courseId'",
    "POST',   path: '/api/classes'",
    "PATCH',  path: '/api/classes/:classId'",
    "DELETE', path: '/api/classes/:classId'",
]:
    check(route in idx, f"route not wired in index.js: {route}")
check("registerRoutes(app, authoringRoutes" in idx, "authoringRoutes not registered")

# 4. createClass ValidateContext enforces the tree invariants.
vc = read(APP / "classes/createClass/createClassValidateContext.ts")
check("SECTION_CANNOT_HAVE_MEDIA" in vc, "createClass must reject SECTION with media")
check("PARENT_MUST_BE_SECTION" in vc, "createClass must reject non-SECTION parent")
check("PARENT_COURSE_MISMATCH" in vc, "createClass must reject cross-course parent")

# 5. updateClass ValidateContext enforces cycle detection.
uvc = read(APP / "classes/updateClass/updateClassValidateContext.ts")
check("CYCLE_DETECTED" in uvc, "updateClass must reject cycles")

# 6. CheckPolicies uses PBAC hasScope (not ReBAC checkAuthzDelegated).
for rel, name in USECASES.items():
    cp = read(APP / rel / f"{name}CheckPolicies.ts")
    check("hasScope" in cp, f"{rel} CheckPolicies must use hasScope (PBAC)")
    check("checkAuthzDelegated" not in cp, f"{rel} CheckPolicies must NOT use ReBAC checkAuthzDelegated")

# 7. deleteClass Execute cascades via subtree; deleteCourse cascades classes.
check("deleteSubtree" in read(APP / "classes/deleteClass/deleteClassExecute.ts"),
      "deleteClass must cascade via deleteSubtree")
check("deleteByCourse" in read(APP / "courses/deleteCourse/deleteCourseExecute.ts"),
      "deleteCourse must cascade classes via deleteByCourse")

if FAILS:
    print("PLAN 02 ASSERTIONS FAILED:")
    for f in FAILS:
        print(f"  - {f}")
    sys.exit(1)
print("PLAN 02 assertions: all pass")
