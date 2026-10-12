#!/usr/bin/env python3
"""CANONICAL post-deploy edge-freshness guard (§ BIG BANG — nivelé vers le haut, vendoré byte-identique par app).

SSOT : tpb-devops-cd/scripts/verify_deploy_freshness.py → vendoré dans chaque <app>/scripts/verify_deploy_freshness.py
(jumeau de deploy.sh + materialize_public_env.py). Gate `vendored_deploy_matches_ssot` verrouille chaque copie.

Généralise le `deploy_and_verify_freshness.py` de tpb-lrm (le MEILLEUR CITOYEN, § JAMAIS DOWNGRADER : on ÉLÈVE
toute la flotte à sa rigueur, on ne la strip pas) en une garde canonique PARAMÉTRÉE, appelée par deploy.sh step 8.

Background (§ _bugs 2026-07-28 Cause C) : `wrangler deploy` peut répondre SUCCESS en SKIPPANT silencieusement le
re-upload des assets statiques → l'edge sert le bundle du deploy PRÉCÉDENT → l'utilisateur voit un bundle STALE
malgré un deploy "vert". Cette garde ferme la classe déterministement :
  1. lit le `tpb-build-id` baké dans le LOCAL `frontend/out/<route>/index.html` (le bundle qu'on vient de builder),
  2. fetch l'HTML DÉPLOYÉ depuis l'edge (CF Access SA) + lit son `tpb-build-id`,
  3. si différent → l'edge est stale → purge le cache asset-manifest wrangler + re-deploy (provenance COMMIT_SHA),
  4. fail-loud (exit 1) si toujours stale après retries (jamais un deploy vert qui n'a rien shippé).

PRÉSENCE-DÉTECTÉ (un seul chemin, zéro dual-path §BIG BANG) : si l'app ne sert pas de frontend Next avec le
marqueur `tpb-build-id` (local HTML absent OU pas de meta build-id), la garde SKIP proprement (log) — le deploy du
step 7 reste live. Phase 2 (preset SDK next-config → marqueur universel sur les 24 apps Next) rendra la garde
active fleet-wide. http.client (PAS urllib) préserve la casse des headers → CF Access accepte `CF-Access-Client-Id`.

Usage (appelé par deploy.sh step 8) :
  python3 scripts/verify_deploy_freshness.py <target> --wrangler <WF> --app-dir .
"""
from __future__ import annotations

import argparse
import http.client
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

_BUILD_ID_RE = re.compile(r'<meta\b[^>]*\bname=["\']tpb-build-id["\'][^>]*\bcontent=["\']([^"\']*)["\']', re.I)
_BUILD_ID_RE2 = re.compile(r'<meta\b[^>]*\bcontent=["\']([^"\']*)["\'][^>]*\bname=["\']tpb-build-id["\']', re.I)
_DEV_HOST_SUFFIX = ".matthieu-marielouise.workers.dev"
MAX_RETRIES = 2


def _extract_build_id(html: str) -> str | None:
    m = _BUILD_ID_RE.search(html) or _BUILD_ID_RE2.search(html)
    return m.group(1) if m else None


def _worker_name(wf: Path) -> str | None:
    m = re.search(r'(?m)^\s*name\s*=\s*"([^"]+)"', wf.read_text(encoding="utf-8", errors="replace"))
    return m.group(1) if m else None


def _verify_route(app_dir: Path, target: str) -> str:
    # Config DEPLOY isolée (PAS le public-env manifest, dont le schema est additionalProperties:false et dont
    # `backend` = wrangler [vars] allowlist). Un `scripts/deploy-verify.json` {"verify_route": "/lrm/engage/"}
    # app-spécifique (défaut "/" = index racine). Seules les apps à basePath non-racine en ont besoin.
    cfg = app_dir / "scripts" / "deploy-verify.json"
    if cfg.is_file():
        try:
            route = (json.loads(cfg.read_text()) or {}).get("verify_route", "")
            if route:
                return route if route.startswith("/") else f"/{route}"
        except Exception:
            pass
    return "/"


def _local_html(app_dir: Path, route: str) -> Path:
    # Next classique → frontend/out ; root-next (next à la racine, ex. showcase) → out/. On rend le PREMIER
    # existant ; défaut frontend/out pour le message "absent → SKIP".
    rel = route.strip("/")
    for out in (app_dir / "frontend" / "out", app_dir / "out"):
        cand = (out / rel / "index.html") if rel else (out / "index.html")
        if cand.is_file():
            return cand
    out = app_dir / "frontend" / "out"
    return (out / rel / "index.html") if rel else (out / "index.html")


def _edge_build_id(host: str, route: str) -> tuple[str | None, int]:
    import os
    cid, csecret = os.environ.get("BASTION_CLIENT_ID"), os.environ.get("BASTION_CLIENT_SECRET")
    if not cid or not csecret:
        sys.exit("[deploy-verify] FATAL: BASTION_CLIENT_ID/SECRET (CF Access SA) missing — source .devcontainer/.env")
    conn = http.client.HTTPSConnection(host, timeout=30)
    try:
        conn.request("GET", f"{route}?_deployverify={int(time.time())}",
                     headers={"CF-Access-Client-Id": cid, "CF-Access-Client-Secret": csecret, "Cache-Control": "no-store"})
        resp = conn.getresponse()
        body = resp.read().decode("utf-8", errors="replace")
        return (_extract_build_id(body) if resp.status == 200 else None), resp.status
    finally:
        conn.close()


def _deploy(wf: str) -> None:
    sha = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip() or "nogit"
    subprocess.run(["pnpm", "exec", "wrangler", "deploy", "-c", wf, "--var", f"COMMIT_SHA:{sha}"], check=True)


def _clear_wrangler_cache(app_dir: Path) -> None:
    for c in (app_dir / ".wrangler" / "state", app_dir / ".wrangler" / "deploy",
              app_dir / "node_modules" / ".cache" / "wrangler"):
        if c.exists():
            shutil.rmtree(c, ignore_errors=True)
            print(f"[deploy-verify] cleared wrangler cache {c}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("target", choices=["dev", "staging", "production"])
    ap.add_argument("--wrangler", required=True)
    ap.add_argument("--app-dir", default=".")
    args = ap.parse_args()
    app_dir = Path(args.app_dir).resolve()
    wf = Path(args.wrangler)
    wf_abs = wf if wf.is_absolute() else (app_dir / wf)

    route = _verify_route(app_dir, args.target)
    local_html = _local_html(app_dir, route)
    if not local_html.is_file():
        print(f"[deploy-verify] no local frontend HTML at {local_html} — freshness verify N/A (backend-only or no Next out). SKIP.")
        return 0
    local = _extract_build_id(local_html.read_text(encoding="utf-8", errors="replace"))
    if not local:
        print(f"[deploy-verify] no tpb-build-id meta in {local_html} — app's next.config doesn't bake the marker yet "
              f"(Phase 2 : preset SDK universel). Freshness verify SKIP (deploy stays live).")
        return 0

    name = _worker_name(wf_abs)
    if not name:
        print(f"[deploy-verify] could not resolve worker name from {wf_abs} — freshness verify SKIP.")
        return 0
    host = f"{name}{_DEV_HOST_SUFFIX}"  # dev edge host (staging/prod bloqués par deploy.sh)
    print(f"[deploy-verify] local build-id={local} host={host} route={route}")

    for attempt in range(MAX_RETRIES + 1):
        time.sleep(3)
        edge, status = _edge_build_id(host, route)
        print(f"[deploy-verify] attempt {attempt}: edge build-id={edge} (HTTP {status})")
        if edge == local:
            print("[deploy-verify] ✅ edge serves the freshly-built bundle — deploy genuinely live.")
            return 0
        if attempt < MAX_RETRIES:
            print(f"[deploy-verify] ⚠ edge STALE (edge={edge} ≠ local={local}) — likely silent asset-skip (Cause C). Re-deploying.")
            _clear_wrangler_cache(app_dir)
            _deploy(args.wrangler)
    print(f"[deploy-verify] ❌ FATAL: after {MAX_RETRIES} retries edge still serves {edge} ≠ built {local} (Cause C). "
          "Assets NOT re-uploaded — deploy shipped nothing new.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
