#!/usr/bin/env python3
"""Phase 1 capture for skool.com/maker-zero — cookie-based (browser_cookie3, Profile 7).
Fetches classroom tree + every course's lesson bodies via the Next.js _next/data endpoints,
using the live Chrome session cookies (read-only). Writes JSON to _raw/. No tpb_evaluate.
"""
import json
import re
import sys
import time
import urllib.parse
from pathlib import Path

import browser_cookie3  # type: ignore
import requests

BUILD_ID = "1786656095479"
SLUG = "maker-zero"
ROOT = Path(__file__).resolve().parent
RAW = ROOT / "_raw"
RAW.mkdir(parents=True, exist_ok=True)
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140.0 Safari/537.36")


def load_cookies():
    cf = Path.home() / "Library/Application Support/Google/Chrome" / "Profile 7" / "Cookies"
    if not cf.exists():
        sys.exit(f"cookie store not found: {cf}")
    return browser_cookie3.chrome(domain_name="skool.com", cookie_file=str(cf))


def base(bid):
    return f"https://www.skool.com/_next/data/{bid}/{SLUG}"


def get(sess, url, **kw):
    return sess.get(url, headers={"User-Agent": UA, "Accept": "application/json",
                                  "x-nextjs-data": "1"}, timeout=45, **kw)


def main():
    sess = requests.Session()
    sess.cookies = load_cookies()
    bid = BUILD_ID

    # classroom tree
    r = get(sess, f"{base(bid)}/classroom.json?group={SLUG}")
    if r.status_code != 200 or len(r.text) < 2000:
        sys.exit(f"classroom.json failed: {r.status_code} len={len(r.text)} head={r.text[:200]}")
    tree = r.json()
    (RAW / "classroom.json").write_text(json.dumps(tree, ensure_ascii=False, indent=2))
    courses = tree.get("pageProps", {}).get("allCourses", [])
    print(f"classroom tree OK: {len(courses)} courses, {len(r.text)} bytes")

    trees, lessons = {}, {}
    for c in courses:
        cslug = c.get("name")
        title = (c.get("metadata") or {}).get("title") or cslug
        # step A: no md -> __N_REDIRECT in BODY carries defaultMd (skill line 91)
        rA = get(sess, f"{base(bid)}/classroom/{cslug}.json?group={SLUG}&id={cslug}",
                 allow_redirects=False)
        default_md = None
        # header redirect (rare)
        loc = rA.headers.get("x-nextjs-redirect") or rA.headers.get("Location") or ""
        m = re.search(r"[?&]md=([0-9a-f]+)", loc)
        if m:
            default_md = m.group(1)
        if not default_md and rA.status_code == 200:
            try:
                jA = rA.json()
                red = (jA.get("pageProps") or {}).get("__N_REDIRECT") or jA.get("__N_REDIRECT") or ""
                m2 = re.search(r"[?&]md=([0-9a-f]+)", red)
                if m2:
                    default_md = m2.group(1)
                elif len(rA.text) > 2000:
                    trees[cslug] = jA  # full inline tree
            except Exception:
                pass
        # step B: fetch with md
        body = None
        if default_md:
            rB = get(sess, f"{base(bid)}/classroom/{cslug}.json?md={default_md}&group={SLUG}&id={cslug}")
            if rB.status_code == 200 and len(rB.text) > 500:
                body = rB.json()
        elif cslug in trees:
            body = trees[cslug]
        if body is not None:
            lessons[cslug] = body
            print(f"  ✓ {title[:38]:38} ({cslug}) md={default_md or 'inline'} {len(json.dumps(body))}B")
        else:
            print(f"  ✗ {title[:38]:38} ({cslug}) A={rA.status_code} md={default_md} — no body")
        time.sleep(1.2)  # polite pacing

    (RAW / "skool_course_trees.json").write_text(json.dumps(trees, ensure_ascii=False, indent=2))
    (RAW / "lessons.json").write_text(json.dumps(lessons, ensure_ascii=False, indent=2))
    print(f"\nWROTE _raw/: classroom.json, skool_course_trees.json ({len(trees)}), lessons.json ({len(lessons)})")


if __name__ == "__main__":
    main()
