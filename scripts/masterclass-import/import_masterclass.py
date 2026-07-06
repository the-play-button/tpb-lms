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

# Nick Saraev's cold-outbound course is ONE YouTube video (uSTGNHGFOAo). Each part is a
# timestamped segment — lessons embed the video at the part's start (transcript = notes
# below). yt(start_seconds) builds the segment url the youtube provider reads.
NICK_VIDEO = "https://www.youtube.com/watch?v=uSTGNHGFOAo"
def yt(start_sec: int) -> str:
    return f"{NICK_VIDEO}&start={start_sec}"

PROGRAM = ("prog_mc_sales_academy", "TPB Sales Academy")

# Course cover images (served by the lms-viewer worker /thumbnails/). Carried on the
# course mediaJson so re-imports PRESERVE the covers instead of wiping them.
VIEWER = "https://lms-viewer.matthieu-marielouise.workers.dev/thumbnails"
COURSE_COVERS = {
    "course_mc_1": "course-1-vision",
    "course_mc_2": "course-2-outbound",
    "course_mc_3": "course-3-sales-conversation",
    "course_mc_4": "course-4-the-offer",
    "course_mc_5": "course-5-practice",
}
def course_cover(cid: str, cname: str) -> list:
    slug = COURSE_COVERS.get(cid)
    return [{"url": f"{VIEWER}/{slug}.jpg", "type": "IMAGE", "name": f"{cname} cover"}] if slug else []

# course_id, name, [ (section_id, section_name, [ (lesson_id, lesson_name, src_path) ]) ]
COURSES = [
    ("course_mc_1", "1 — Vision & Context", [
        ("sec_mc_1_1", "Vision & Context", [
            ("les_mc_1_1_1", "The Vision: Why We Exist", CONTENT / "c1-1-the-vision.md"),
            ("les_mc_1_1_2", "How Companies Actually Go To Market", CONTENT / "c1-2-how-companies-go-to-market.md"),
            ("les_mc_1_1_3", "One Offer, Five Products", CONTENT / "c1-3-one-offer-five-products.md"),
        ]),
    ]),
    ("course_mc_2", "2 — Outbound Mastery", [
        ("sec_mc_2_1", "Outbound Mastery (Nick Saraev)", [
            ("les_mc_2_1_0", "How To Use This Course", CONTENT / "c2-0-how-to-use-this-course.md"),
            ("les_mc_2_1_1", "Part 1 — Psychology of Trust", NS / "01-psychology-of-trust.md", yt(0)),
            ("les_mc_2_1_2", "Part 2 — Components & Copywriting Framework", NS / "02-components-and-copywriting-framework.md", yt(1113)),
            ("les_mc_2_1_3", "Part 3 — Identity, Offers & Examples", NS / "03-identity-offers-examples.md", yt(2713)),
            ("les_mc_2_1_4", "Part 4 — Offer Formula Deep Dive", NS / "04-offer-formula-deep-dive.md", yt(3982)),
            ("les_mc_2_1_5", "Part 5 — Offers + Live Email Roasting", NS / "05-offers-and-email-roasting.md", yt(5387)),
            ("les_mc_2_1_6", "Part 6 — Platforms, Subject Lines, Follow-ups", NS / "06-platforms-subjects-followups-iteration.md", yt(10200)),
            ("les_mc_2_1_7", "Part 7 — AI in Copywriting & Gray Hat", NS / "07-ai-copywriting-and-gray-hat.md", yt(12900)),
        ]),
    ]),
    ("course_mc_3", "3 — Sales Conversation", [
        ("sec_mc_3_1", "Sales Conversation", [
            ("les_mc_3_1_0", "The Craft Of The Conversation", CONTENT / "c3-0-the-craft-of-the-conversation.md"),
            ("les_mc_3_1_1", "C.L.O.S.E.R", MC / "3.1 Sales methodo - C.L.O.S.E.R.md"),
            ("les_mc_3_1_2", "Discovery playbook", MC / "3.3 Discovery playbook.md"),
            ("les_mc_3_1_3", "Objection handling", MC / "3.5 Objection handling.md"),
            ("les_mc_3_1_4", "Closing techniques", MC / "3.6 Closing techniques.md"),
            ("les_mc_3_1_5", "Demo playbook", MC / "3.4 Demo Playbook.md"),
        ]),
    ]),
    ("course_mc_4", "4 — The Offer", [
        ("sec_mc_4_1", "The Offer", [
            ("les_mc_4_1_1", "What We Sell: The Brutal CRM Truth", CONTENT / "c4-1-what-we-sell.md"),
            ("les_mc_4_1_2", "Who We Sell To: ICP, Triggers, Buckets", CONTENT / "c4-2-who-we-sell-to.md"),
            ("les_mc_4_1_3", "The Value: Why It Pays For Itself", CONTENT / "c4-3-the-value.md"),
            ("les_mc_4_1_4", "Discovery For This Offer", CONTENT / "c4-4-discovery.md"),
            ("les_mc_4_1_5", "Objection Handling For This Offer", CONTENT / "c4-5-objections.md"),
            ("les_mc_4_1_6", "Pricing & Closing", CONTENT / "c4-6-pricing-and-closing.md"),
            ("les_mc_4_1_7", "After The Yes: Delivery and the Five Products", CONTENT / "c4-7-delivery-routing.md"),
        ]),
    ]),
    ("course_mc_5", "5 — Practice & Reinforcement", [
        ("sec_mc_5_1", "Practice & Reinforcement", [
            ("les_mc_5_1_1", "Roleplay Scenarios", CONTENT / "c5-1-roleplay-scenarios.md"),
            ("les_mc_5_1_2", "The Shadowing Protocol", CONTENT / "c5-2-shadowing.md"),
            ("les_mc_5_1_3", "Your KPIs & Scorecard", CONTENT / "c5-3-kpis-and-scorecard.md"),
            ("les_mc_5_1_4", "The Reinforcement Loop", CONTENT / "c5-4-reinforcement-loop.md"),
        ]),
    ]),
    # Onboarding & daily rhythm — written directly to the new rep (house voice, no citations).
    ("course_mc_6", "6 — Onboarding & Daily Rhythm", [
        ("sec_mc_6_1", "Your First Weeks", [
            ("les_mc_6_1_1", "Your First Two Weeks", CONTENT / "c6-1-your-first-two-weeks.md"),
            ("les_mc_6_1_2", "Your Daily Rhythm", CONTENT / "c6-2-your-daily-rhythm.md"),
            ("les_mc_6_1_3", "How You Train Every Day", CONTENT / "c6-3-how-you-train.md"),
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
                               "programId": pid, "sysOrderIndex": ci + 1, "mediaJson": course_cover(cid, cname)})
        print(f"  Course {cname!r}")
        for si, (sid, sname, lessons) in enumerate(sections):
            api.upsert("classes", {"id": sid, "courseId": cid, "nodeKind": "SECTION",
                                   "name": sname, "sysOrderIndex": si + 1})
            for li, lesson in enumerate(lessons):
                lid, lname, src = lesson[0], lesson[1], lesson[2]
                video_url = lesson[3] if len(lesson) > 3 else None
                if not src.is_file():
                    api.errors.append(f"MISSING src {src}"); print(f"    ! MISSING {src}"); continue
                # Video lesson → embed the clip (transcript becomes notes below it).
                media = [{"url": video_url, "type": "VIDEO", "name": lname}] if video_url else []
                step_type = "VIDEO" if video_url else "CONTENT"
                api.upsert("classes", {"id": lid, "courseId": cid, "parentClassId": sid, "nodeKind": "LESSON",
                                       "name": lname, "sysOrderIndex": li + 1, "stepType": step_type,
                                       "contentMd": load_md(src), "mediaJson": media})
                n_les += 1
    print(f"\n{'[dry-run] ' if args.dry_run else ''}Program {pname}: {len(COURSES)} courses · {n_les} lessons · errors {len(api.errors)}")
    for e in api.errors:
        print("  ERR", e)
    return 1 if api.errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
