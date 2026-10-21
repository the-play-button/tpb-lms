#!/usr/bin/env python3
"""verify_build_env_coherence.py — SSOT deploy gate: the BUILT static-export bundle MUST carry the
TARGET env's public config and ZERO foreign-env value. FAIL HARD, on the ARTIFACT, before deploy.

WHY (incident 2026-08-26 — rmm.theplaybutton.ai auth outage, § IDP ↔ FRONTEND ↔ BACKEND COHERENCE):
  Every TPB Worker+frontend app is a Next.js/Vite **static export**; its public config (IdP endpoint,
  client_id, audience, API URLs) is **baked at BUILD time** from `frontend/.env.<mode>` (written by
  `materialize_public_env.py` for the target). Nothing verified the BUILT ARTIFACT — so a bundle baked
  with the wrong env's IdP shipped to prod (dev `auth.theplaybutton.dev`), breaking SSO for everyone.
  Vectors: deploy without rebuild, `.env.local` pollution, stale `.next` cache, manifest bug, manual
  urgent-deploy skipping a step. This gate closes ALL of them: it reads what SHOULD be baked (the
  target manifest), what the OTHER envs would bake, and asserts the build carries the target's values
  and none of the foreign ones.

WHAT (app-agnostic — the SAME gate for every repo; vendored per-app + byte-locked):
  - Reads `env/<target>.public.json` (+ every sibling `env/*.public.json`).
  - Auto-detects the build dir (frontend/out | frontend/dist | out | dist | build).
  - For each **env-DISCRIMINANT** public value (a load-bearing string that DIFFERS across envs — the
    IdP endpoint/client/audience, per-env API URLs, …): assert the target value is present in the
    build AND every foreign-env value for that key is ABSENT.

Usage:  verify_build_env_coherence.py <target> [--app-dir .] [--build-dir <path>]
Exit 0 = coherent · 1 = foreign-env leak OR target value missing · 2 = usage/setup error.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PUBLIC_PREFIXES = ("NEXT_PUBLIC_", "VITE_", "REACT_APP_", "NUXT_PUBLIC_", "PUBLIC_")
BUILD_DIR_CANDIDATES = ("frontend/out", "frontend/dist", "out", "dist", "build", "frontend/build")
SCAN_SUFFIXES = {".js", ".mjs", ".cjs", ".html", ".json", ".txt", ".css"}
MIN_DISCRIMINANT_LEN = 6  # skip booleans / short flags


def _fail(msg: str, code: int = 1) -> "None":
    print(f"\033[91m❌ build-env coherence FAIL: {msg}\033[0m", file=sys.stderr)
    sys.exit(code)


def _public_block(app_dir: Path, target: str) -> dict:
    p = app_dir / "env" / f"{target}.public.json"
    if not p.exists():
        _fail(f"no manifest {p}", 2)
    raw = json.loads(p.read_text(encoding="utf-8"))
    return raw.get("public", raw)


def _is_public_key(k: str) -> bool:
    return any(k.startswith(pfx) for pfx in PUBLIC_PREFIXES)


def _gateable(v: object) -> bool:
    """True only for values SPECIFIC enough to substring-match safely: a URL, a hostname, or a
    long opaque id. Plain-word env tokens ('dev'/'staging'/'production'), currencies ('EUR'),
    booleans, etc. are EXCLUDED — they appear as coincidental substrings in any JS bundle → FPs."""
    if not isinstance(v, str):
        return False
    s = v.strip()
    if s.lower() in ("true", "false", "null", "undefined"):
        return False
    if "://" in s:                                   # a URL
        return True
    if "." in s and len(s) >= MIN_DISCRIMINANT_LEN:  # a hostname (dotted, non-trivial)
        return True
    if len(s) >= 12 and " " not in s:                # a long opaque id (client_id, key)
        return True
    return False


def discriminants(app_dir: Path, target: str) -> dict[str, tuple[str, set[str]]]:
    """key -> (target_value, {foreign_values}) for every env-discriminant public value."""
    envs = [p.name[: -len(".public.json")] for p in (app_dir / "env").glob("*.public.json")]
    blocks = {e: _public_block(app_dir, e) for e in envs}
    tgt = blocks[target]
    out: dict[str, tuple[str, set[str]]] = {}
    for k, tv in tgt.items():
        if not _is_public_key(k) or not _gateable(tv):
            continue
        foreign = {
            blocks[e][k]
            for e in envs
            if e != target and k in blocks[e] and _gateable(blocks[e][k]) and blocks[e][k] != tv
        }
        if foreign:  # gateable value that differs across envs → discriminant, worth gating
            out[k] = (tv, foreign)
    return out


def resolve_build_dir(app_dir: Path, explicit: str | None) -> Path:
    if explicit:
        d = (app_dir / explicit) if not Path(explicit).is_absolute() else Path(explicit)
        if not d.is_dir():
            _fail(f"--build-dir {d} not a directory", 2)
        return d
    for cand in BUILD_DIR_CANDIDATES:
        d = app_dir / cand
        if d.is_dir() and any(d.rglob("*.js")):
            return d
    _fail(f"no build output found under {app_dir} (looked in {BUILD_DIR_CANDIDATES}) — did the frontend build run?", 2)


def scan(build_dir: Path, needles: set[str]) -> set[str]:
    """Which of `needles` appear anywhere under build_dir."""
    needles = {n for n in needles if n}
    found: set[str] = set()
    if not needles:
        return found
    for f in build_dir.rglob("*"):
        if not f.is_file() or f.suffix not in SCAN_SUFFIXES:
            continue
        try:
            txt = f.read_text(errors="ignore")
        except Exception:
            continue
        for n in list(needles - found):
            if n in txt:
                found.add(n)
        if found >= needles:
            break
    return found


def verify(app_dir: Path, target: str, build_dir: str | None = None) -> None:
    disc = discriminants(app_dir, target)
    if not disc:
        print(f"ℹ️  build-env coherence: no env-discriminant public values for {target} — nothing to gate.")
        return
    bdir = resolve_build_dir(app_dir, build_dir)
    want = {tv for tv, _ in disc.values()}
    forbidden: set[str] = set()
    for _tv, fs in disc.values():
        forbidden |= fs
    present_want = scan(bdir, want)
    present_bad = scan(bdir, forbidden)

    print(f"🔒 build-env coherence gate ({target}) — build={bdir.relative_to(app_dir)} "
          f"discriminants={len(disc)}")
    problems: list[str] = []
    not_inlined: list[str] = []
    for k, (tv, fs) in disc.items():
        tv_present = tv in present_want
        leaked = sorted(fv for fv in fs if fv in present_bad)
        # "in-play" = au moins UNE valeur (target OU foreign) de cette clé apparaît dans le build. Next/Vite
        # n'inline une NEXT_PUBLIC_/VITE_ que si elle est RÉFÉRENCÉE dans le code bundlé (app OU SDK). Une clé
        # déclarée au manifest mais jamais lue n'est inlinée pour AUCUN env → son absence n'est PAS un build
        # stale (§ fix-the-checker : ne pas exiger une var que le code n'utilise pas ; ex. ticketing = SSO
        # cookie-flow, ne lit pas NEXT_PUBLIC_IDP_* mais les déclare au manifest). La protection RÉELLE
        # (incident dev-IdP-en-prod) = une valeur FOREIGN présente → toujours flaggée ci-dessous.
        if not tv_present and not leaked:
            not_inlined.append(k)
            continue
        if leaked:
            problems.append(f"  • {k}: FOREIGN-ENV value(s) {leaked} present in a {target} build (conflation!)")
        if not tv_present:
            problems.append(f"  • {k}: TARGET value '{tv}' NOT in build but key IS in-play (stale/mismatched build)")
    if not_inlined:
        print(f"  ℹ️  {len(not_inlined)} discriminant(s) non-inlinés (non-référencés par le code/SDK bundlé) — "
              f"hors gate : {', '.join(sorted(not_inlined))}")
    if problems:
        _fail(f"{target} build carries the wrong env's public config:\n" + "\n".join(problems)
              + "\n  → do NOT deploy. Purge + rebuild (materialize <target> → build); check frontend/.env.local.")
    print(f"\033[92m✅ build-env coherence PASS — only {target} public config baked, zero foreign-env leak\033[0m")


def main() -> None:
    ap = argparse.ArgumentParser(description="SSOT deploy gate: built static-export bundle == target env only")
    ap.add_argument("target", help="dev | staging | production")
    ap.add_argument("--app-dir", default=".", help="app root (contains env/ + the built frontend). Default '.'")
    ap.add_argument("--build-dir", default=None, help="override the build output dir (auto-detected otherwise)")
    args = ap.parse_args()
    verify(Path(args.app_dir).resolve(), args.target, args.build_dir)


if __name__ == "__main__":
    main()
