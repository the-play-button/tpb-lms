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

# D. Enrollment CRUD (was enroll/abandon/complete on courses).
check("POST', path: '/api/enrollments'" in idx, "POST /api/enrollments (createEnrollment) missing")
check("PATCH', path: '/api/enrollments/:courseId'" in idx, "PATCH /api/enrollments/:courseId (updateEnrollment) missing")
check("GET', path: '/api/enrollments/:courseId'" in idx, "GET /api/enrollments/:courseId missing")
for stale in ["/courses/:courseId/enroll", "/courses/:courseId/abandon", "/courses/:courseId/complete", "/courses/:courseId/enrollment"]:
    check(stale not in idx, f"stale enrollment route {stale} still present")
for stale in ["enrollInCourse", "abandonCourse", "completeCourse"]:
    check(stale not in idx, f"stale handler {stale} still referenced")

# E. Events bulk-create (single endpoint accepts single or array), no /batch.
check("createEvents" in idx and "/api/events/batch" not in idx, "events not unified into createEvents / batch route still present")
check("Array.isArray(body?.events)" in read(LMS / "backend/handlers/events.js"), "createEvents must accept single-or-array")

# F. Quiz → quiz-submissions.
check("/api/quiz-submissions" in idx and "createQuizSubmission" in idx, "quiz not migrated to /api/quiz-submissions")
check("'/api/quiz'" not in idx, "old /api/quiz route still present")

# G. Translations: /review + /batch collapsed into /api/translations.
check("GET', path: '/api/translations'" in idx and "PUT', path: '/api/translations'" in idx, "translations not collapsed to /api/translations")
check("/api/translations/review" not in idx and "/api/translations/batch" not in idx, "old translations sub-routes still present")

# H. Glossary bulk-create (POST accepts single or {terms:[]}), no /import.
check("/api/glossary/:locale/import" not in idx, "old glossary /import route still present")
check("Array.isArray(body?.terms)" in read(LMS / "backend/handlers/glossary/createGlossaryTerm.js"), "createGlossaryTerm must accept single-or-array")

# I. Filtered-read dispatchers (cloud/pitch, connections/default) via query param.
check("cloudContentDispatch" in idx and "/api/content/cloud/pitch" not in idx, "cloud pitch not dispatched via ?usage")
check("connectionsDispatch" in idx and "/api/connections/default" not in idx, "connections default not dispatched via ?default")

# J. Signals reset → DELETE (frontend consumers updated).
fe_nav = read(LMS / "frontend-on-cf-worker/app/course/navigation.js")
check("apiDelete(`/signals/${currentCourse}`)" in fe_nav, "frontend navigation still POSTs /signals/.../reset")
fe_ov = read(LMS / "frontend-on-cf-worker/app/course/overview.js")
check("apiPost('/enrollments'" in fe_ov and "apiPatch(`/enrollments/" in fe_ov, "frontend overview not migrated to enrollments CRUD")
fe_quiz = read(LMS / "frontend-on-cf-worker/app/quiz/handler.js")
check("/quiz-submissions" in fe_quiz, "frontend quiz not migrated to /quiz-submissions")

# K. Nested-sections sidebar renders the nodes[] tree.
sidebar = read(LMS / "frontend-on-cf-worker/app/ui/stepsSidebar.js")
check("renderNodesTree" in sidebar and "course.nodes" in sidebar, "sidebar does not render the nodes[] tree")

if FAILS:
    print("PLAN 01 ASSERTIONS FAILED:")
    for f in FAILS:
        print(f"  - {f}")
    sys.exit(1)
print("PLAN 01 assertions (delivered scope): all pass")
