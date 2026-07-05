#!/usr/bin/env python3
"""sweep_videos.py — check every course video is publicly embeddable (oEmbed).

Read-only. Walks every `videoLink` in `course_trees.json` and probes its provider oEmbed
endpoint (Loom / YouTube). A 200 means the embed we ship in tpb-lms will play for anyone;
a non-200 flags a private/removed video that would fall back to a plain link. Writes a
machine report to `<out>/video-sweep.json` + prints a summary.

Usage:
  python3 sweep_videos.py --data-root "<…/Nick Saraev - Maker School>" --out <dir> [--sleep-ms 80]
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import httpx

from import_course import classify_video

LOOM_OEMBED = "https://www.loom.com/v1/oembed"
YT_OEMBED = "https://www.youtube.com/oembed"


def collect_videos(tree: dict) -> list[dict]:
    vids = []
    for ckey, course in tree.items():
        for s in course.get("children", []):
            if s.get("type") != "set":
                continue
            for m in s.get("children", []):
                if m.get("type") == "module" and m.get("videoLink"):
                    vids.append({"course": course["title"], "course_key": ckey,
                                 "lesson": m["title"], "url": m["videoLink"],
                                 "kind": classify_video(m["videoLink"])})
    return vids


def probe(cl: httpx.Client, v: dict) -> int | None:
    """Return the oEmbed HTTP status (200 = public/embeddable). None on transport failure."""
    if v["kind"] == "loom":
        params = {"url": v["url"]}
        endpoint = LOOM_OEMBED
    elif v["kind"] == "youtube":
        params = {"url": v["url"], "format": "json"}
        endpoint = YT_OEMBED
    else:
        return None
    for attempt in range(3):
        try:
            r = cl.get(endpoint, params=params, timeout=15, follow_redirects=True)
            return r.status_code
        except (httpx.TimeoutException, httpx.TransportError):
            if attempt == 2:
                return None
            time.sleep(0.5 * (attempt + 1))
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-root", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--sleep-ms", type=int, default=80)
    args = ap.parse_args()

    root = Path(args.data_root)
    tree = json.loads((root / "_raw" / "course_trees.json").read_text())
    vids = collect_videos(tree)
    print(f"probing {len(vids)} videos "
          f"({sum(1 for v in vids if v['kind'] == 'loom')} loom / "
          f"{sum(1 for v in vids if v['kind'] == 'youtube')} youtube)…")

    results = []
    counts = {"loom_public": 0, "loom_private": [], "yt_public": 0, "yt_unavailable": [], "probe_error": []}
    for i, v in enumerate(vids):
        status = probe(httpx.Client(), v)
        results.append({**v, "status": status})
        ok = status == 200
        if v["kind"] == "loom":
            if ok:
                counts["loom_public"] += 1
            elif status is None:
                counts["probe_error"].append(v["url"])
            else:
                counts["loom_private"].append({"lesson": v["lesson"], "url": v["url"], "status": status})
        elif v["kind"] == "youtube":
            if ok:
                counts["yt_public"] += 1
            elif status is None:
                counts["probe_error"].append(v["url"])
            else:
                counts["yt_unavailable"].append({"lesson": v["lesson"], "url": v["url"], "status": status})
        if (i + 1) % 50 == 0:
            print(f"  …{i + 1}/{len(vids)}")
        if args.sleep_ms:
            time.sleep(args.sleep_ms / 1000.0)

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "video-sweep.json").write_text(json.dumps(
        {"total": len(vids), "counts_summary": {
            "loom_public": counts["loom_public"], "loom_private": len(counts["loom_private"]),
            "yt_public": counts["yt_public"], "yt_unavailable": len(counts["yt_unavailable"]),
            "probe_error": len(counts["probe_error"])},
         "loom_private": counts["loom_private"], "yt_unavailable": counts["yt_unavailable"],
         "probe_error": counts["probe_error"], "results": results}, indent=2))

    print(f"\n{'=' * 60}\nVIDEO SWEEP")
    print(f"  loom     : {counts['loom_public']} public / {len(counts['loom_private'])} private")
    print(f"  youtube  : {counts['yt_public']} public / {len(counts['yt_unavailable'])} unavailable")
    print(f"  probe err: {len(counts['probe_error'])}")
    for p in counts["loom_private"][:20]:
        print(f"    LOOM PRIVATE [{p['status']}] {p['lesson'][:40]} — {p['url']}")
    for p in counts["yt_unavailable"][:20]:
        print(f"    YT UNAVAIL  [{p['status']}] {p['lesson'][:40]} — {p['url']}")
    print(f"  report → {out_dir / 'video-sweep.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
