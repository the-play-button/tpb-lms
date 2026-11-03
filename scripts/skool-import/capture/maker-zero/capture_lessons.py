#!/usr/bin/env python3
"""Phase 1 step 1.5 — walk each course tree, fetch every leaf module (md=leafId),
extract per-lesson bodies, and write _raw/course_trees.json + _raw/lessons.json in the
exact shape skool-scraping build-md expects. Reuses the per-course md=defaultMd captures
already in _raw/lessons.json (they carry pageProps.course = the tree)."""
import json
import time
from pathlib import Path

import browser_cookie3  # type: ignore
import requests

BUILD_ID = "1786656095479"
SLUG = "maker-zero"
ROOT = Path(__file__).resolve().parent
RAW = ROOT / "_raw"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140.0 Safari/537.36")


def load_cookies():
    cf = Path.home() / "Library/Application Support/Google/Chrome" / "Profile 7" / "Cookies"
    return browser_cookie3.chrome(domain_name="skool.com", cookie_file=str(cf))


def get(sess, url):
    return sess.get(url, headers={"User-Agent": UA, "Accept": "application/json",
                                  "x-nextjs-data": "1"}, timeout=45)


def leaves(node, acc):
    c = node.get("course") or {}
    if c.get("unitType") == "module":
        acc.append(c["id"])
    for ch in node.get("children") or []:
        leaves(ch, acc)


def find_by_id(node, cid):
    if (node.get("course") or {}).get("id") == cid:
        return node
    for ch in node.get("children") or []:
        f = find_by_id(ch, cid)
        if f:
            return f
    return None


def main():
    sess = requests.Session()
    sess.cookies = load_cookies()
    per_course = json.loads((RAW / "lessons.json").read_text())  # {cslug: pageProps-json}

    course_trees, all_lessons = {}, []
    for cslug, pj in per_course.items():
        tree = (pj.get("pageProps") or {}).get("course")
        if not tree:
            print(f"  ! {cslug}: no pageProps.course"); continue
        course_trees[cslug] = tree
        leaf_ids = []
        leaves(tree, leaf_ids)
        print(f"{cslug}: {len(leaf_ids)} leaf modules")
        for lid in leaf_ids:
            r = get(sess, f"https://www.skool.com/_next/data/{BUILD_ID}/{SLUG}/classroom/{cslug}.json?md={lid}&group={SLUG}&id={cslug}")
            if r.status_code != 200:
                print(f"    ✗ {lid} status {r.status_code}"); continue
            node = find_by_id((r.json().get("pageProps") or {}).get("course") or {}, lid)
            if not node:
                print(f"    ✗ {lid} not found in response"); continue
            c = node["course"]; m = c.get("metadata") or {}
            all_lessons.append({
                "id": c["id"], "courseSlug": cslug, "title": m.get("title"),
                "desc": m.get("desc"), "resources": m.get("resources"),
                "videoLink": m.get("videoLink"), "videoThumbnail": m.get("videoThumbnail"),
                "videoLenMs": m.get("videoLenMs"), "parentId": c.get("parentId"),
                "createdAt": c.get("createdAt"), "updatedAt": c.get("updatedAt"),
            })
            time.sleep(0.5)

    (RAW / "course_trees.json").write_text(json.dumps(course_trees, ensure_ascii=False, indent=2))
    (RAW / "lessons.json").write_text(json.dumps(all_lessons, ensure_ascii=False, indent=2))
    with_body = sum(1 for l in all_lessons if l.get("desc"))
    print(f"\nWROTE course_trees.json ({len(course_trees)}) + lessons.json ({len(all_lessons)} lessons, {with_body} with TipTap body)")


if __name__ == "__main__":
    main()
