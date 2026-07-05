#!/usr/bin/env python3
"""import_masterclass.py — push the TPB Sales Masterclass 3.0 into tpb-lms, 100% via the API.

Program → Courses → Sections → Lessons. Each lesson's `contentMd` = its REAL content file
(my authored framing OR the full source lesson: Nick Saraev's 7 parts, the old masterclass
skill files) — NOT a summary. Idempotent (deterministic ids). Reuses the Skool-importer auth.

Usage: python import_masterclass.py [--dry-run]
Auth: app_lms PAT (vault tpb/apps/lms/bastion_token).
"""
from __future__ import annotations

import argparse
import re
import sys
import time
from pathlib import Path

import httpx
from tpb_sdk.bastion import BastionClient

LMS = "https://lms-api.matthieu-marielouise.workers.dev"
VAULT_PAT_PATH = "tpb/apps/lms/bastion_token"

WS = Path("/Users/wiestitie/labos/the-play-button-business")
CONTENT = WS / "Apps/the-play-button/tpb-lms/plans/2026-07-05_tpb-sales-masterclass-3.0-fresh/_content"
MC = WS / "Brain/the-play-button/pb05-lead-sales-training-program/inputs/TPB Notion/TPB Sales On-Boarding/Master class"
NS = WS / "Brain/the-play-button/pb15-customer-marketing-playbook/inputs/sme-sources/nick-saraev/cold-outbound-course"

PROGRAM = ("prog_mc_sales_academy", "TPB Sales Academy")

# course_id, name, [ (section_id, section_name, [ (lesson_id, lesson_name, src_path) ]) ]
COURSES = [
    ("course_mc_1", "1 — Vision & Context", [
        ("sec_mc_1_1", "Vision & Contexte", [
            ("les_mc_1_1_1", "Ouverture — vision & offres", CONTENT / "00-opening.md"),
            ("les_mc_1_1_2", "Vision BOSS · 4 GTM paths · 1 offre / 5 produits · ICP", CONTENT / "pillar-1-vision-and-context.md"),
        ]),
    ]),
    ("course_mc_2", "2 — Outbound Mastery", [
        ("sec_mc_2_1", "Outbound Mastery (Nick Saraev)", [
            ("les_mc_2_1_0", "Intro TPB — comment on lit ce cours", CONTENT / "pillar-2-outbound-mastery.md"),
            ("les_mc_2_1_1", "Part 1 — Psychology of Trust", NS / "01-psychology-of-trust.md"),
            ("les_mc_2_1_2", "Part 2 — Components & Copywriting Framework", NS / "02-components-and-copywriting-framework.md"),
            ("les_mc_2_1_3", "Part 3 — Identity, Offers & Examples", NS / "03-identity-offers-examples.md"),
            ("les_mc_2_1_4", "Part 4 — Offer Formula Deep Dive", NS / "04-offer-formula-deep-dive.md"),
            ("les_mc_2_1_5", "Part 5 — Offers + Live Email Roasting", NS / "05-offers-and-email-roasting.md"),
            ("les_mc_2_1_6", "Part 6 — Platforms, Subject Lines, Follow-ups", NS / "06-platforms-subjects-followups-iteration.md"),
            ("les_mc_2_1_7", "Part 7 — AI in Copywriting & Gray Hat", NS / "07-ai-copywriting-and-gray-hat.md"),
        ]),
    ]),
    ("course_mc_3", "3 — Sales Conversation", [
        ("sec_mc_3_1", "Sales Conversation", [
            ("les_mc_3_1_0", "Overview — le craft de la conversation", CONTENT / "pillar-2-sales-conversation.md"),
            ("les_mc_3_1_1", "C.L.O.S.E.R", MC / "3.1 Sales methodo - C.L.O.S.E.R.md"),
            ("les_mc_3_1_2", "Discovery playbook", MC / "3.3 Discovery playbook.md"),
            ("les_mc_3_1_3", "Objection handling", MC / "3.5 Objection handling.md"),
            ("les_mc_3_1_4", "Closing techniques", MC / "3.6 Closing techniques.md"),
            ("les_mc_3_1_5", "Demo playbook", MC / "3.4 Demo Playbook.md"),
        ]),
    ]),
    ("course_mc_4", "4 — The Offer", [
        ("sec_mc_4_1", "L'offre (la seule)", [
            ("les_mc_4_1_1", "L'offre — outcome, ICP, discovery, objections, pricing, closing", CONTENT / "pillar-3-the-offer.md"),
        ]),
    ]),
    ("course_mc_5", "5 — Practice & Reinforcement", [
        ("sec_mc_5_1", "Pratique & renforcement", [
            ("les_mc_5_1_1", "Roleplay · shadowing · KPIs · coaching · scorecard", CONTENT / "pillar-practice.md"),
        ]),
    ]),
]

_FRONTMATTER = re.compile(r"^---\n.*?\n---\n", re.S)


def load_md(p: Path) -> str:
    txt = p.read_text(encoding="utf-8", errors="replace")
    return _FRONTMATTER.sub("", txt).lstrip("\n")  # strip YAML frontmatter if present


class LmsApi:
    def __init__(self, dry_run: bool, sleep_ms: int = 80) -> None:
        self.dry_run = dry_run
        self.sleep_s = sleep_ms / 1000.0
        bc = BastionClient.from_devcontainer()
        pat = bc.get_secret(VAULT_PAT_PATH)
        if not pat:
            print(f"FATAL: no PAT at {VAULT_PAT_PATH}", file=sys.stderr)
            sys.exit(2)
        self.h = {**dict(bc.headers), "Authorization": f"Bearer {pat}", "Content-Type": "application/json"}
        self.cl = httpx.Client(timeout=40, headers=self.h)
        self.errors: list[str] = []

    def _req(self, method: str, url: str, body: dict) -> httpx.Response | None:
        transient, rate = 2, 12
        while True:
            try:
                r = self.cl.request(method, url, json=body)
            except (httpx.TimeoutException, httpx.TransportError) as e:
                if transient <= 0:
                    print(f"    ! {method} {url} transport: {e}"); return None
                transient -= 1; time.sleep(0.5); continue
            if r.status_code == 429 and rate > 0:
                time.sleep(min(max(int(r.headers.get("Retry-After") or "5"), 1), 60) + 1); rate -= 1; continue
            if r.status_code >= 500 and transient > 0:
                transient -= 1; time.sleep(0.5); continue
            return r

    def upsert(self, coll: str, body: dict) -> None:
        if self.dry_run:
            print(f"    [dry] {coll[:-1]} {body.get('name','')[:48]!r} ({body['id']})"); return
        r = self._req("POST", f"{LMS}/api/{coll}", body)
        if r is None or r.status_code not in (200, 201):
            m = f"POST {coll} {body['id']} -> {getattr(r,'status_code','ERR')} {getattr(r,'text','')[:140]}"
            self.errors.append(m); print(f"    ! {m}"); return
        patch = {k: v for k, v in body.items() if k not in ("id", "courseId", "nodeKind", "parentClassId")}
        p = self._req("PATCH", f"{LMS}/api/{coll}/{body['id']}", patch)
        if p is None or p.status_code != 200:
            m = f"PATCH {coll} {body['id']} -> {getattr(p,'status_code','ERR')} {getattr(p,'text','')[:140]}"
            self.errors.append(m); print(f"    ! {m}")
        if self.sleep_s:
            time.sleep(self.sleep_s)

    def program(self, pid: str, name: str) -> None:
        if self.dry_run:
            print(f"[dry] program {name!r} ({pid})"); return
        r = self._req("POST", f"{LMS}/api/programs", {"id": pid, "name": name, "mediaJson": []})
        ok = r is not None and r.status_code in (200, 201)
        print(f"{'OK' if ok else '!'} program {name!r} ({pid})"
              + ("" if ok else f" -> {getattr(r,'status_code','ERR')} {getattr(r,'text','')[:120]}"))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    api = LmsApi(args.dry_run)

    pid, pname = PROGRAM
    api.program(pid, pname)
    n_les = 0
    for ci, (cid, cname, sections) in enumerate(COURSES):
        api.upsert("courses", {"id": cid, "name": cname, "description": "", "progressionMode": "free",
                               "programId": pid, "sysOrderIndex": ci + 1, "mediaJson": []})
        print(f"  Course {cname!r}")
        for si, (sid, sname, lessons) in enumerate(sections):
            api.upsert("classes", {"id": sid, "courseId": cid, "nodeKind": "SECTION",
                                   "name": sname, "sysOrderIndex": si + 1})
            for li, (lid, lname, src) in enumerate(lessons):
                if not src.is_file():
                    api.errors.append(f"MISSING src {src}"); print(f"    ! MISSING {src}"); continue
                api.upsert("classes", {"id": lid, "courseId": cid, "parentClassId": sid, "nodeKind": "LESSON",
                                       "name": lname, "sysOrderIndex": li + 1, "stepType": "CONTENT",
                                       "contentMd": load_md(src), "mediaJson": []})
                n_les += 1
    print(f"\n{'[dry-run] ' if args.dry_run else ''}Program {pname}: {len(COURSES)} courses · {n_les} lessons · errors {len(api.errors)}")
    for e in api.errors:
        print("  ERR", e)
    return 1 if api.errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
