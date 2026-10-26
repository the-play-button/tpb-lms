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
  2. fetch l'HTML DÉPLOYÉ depuis l'edge (hôte = `PUBLIC_URL` du manifeste de la cible, dev, staging ou production ;
     SA CF Access de l'environnement, sinon du vault) + lit son `tpb-build-id`,
  3. si différent → l'edge est stale → purge le cache asset-manifest wrangler + re-deploy (provenance COMMIT_SHA),
  4. fail-loud (exit 1) si toujours stale après retries (jamais un deploy vert qui n'a rien shippé).
  5. un edge que la garde ne peut pas LIRE (login CF Access, erreur, page sans marqueur) est dit INVÉRIFIABLE,
     fail-loud SANS re-deploy : re-déployer un edge illisible ne prouve rien et masque la cause (sub-31 plan 12.1,
     2026-10-26 : la racine de bi.theplaybutton.ai renvoie le login CF Access au SA partagé → deux re-deploys à vide).

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
from urllib.parse import urlsplit

_BUILD_ID_RE = re.compile(r'<meta\b[^>]*\bname=["\']tpb-build-id["\'][^>]*\bcontent=["\']([^"\']*)["\']', re.I)
_BUILD_ID_RE2 = re.compile(r'<meta\b[^>]*\bcontent=["\']([^"\']*)["\'][^>]*\bname=["\']tpb-build-id["\']', re.I)
MAX_RETRIES = 2
# The shared CF Access SA (§ CF ACCESS = UN SEUL CHEMIN SDK) ; the dev vault holds it, readable from the workstation.
_SA_VAULT_PATHS = ("tpb/infra/cf_access_sa_client_id", "tpb/infra/cf_access_sa_client_secret")
# A bare Python client is challenged by the CF bot filter (1010) : read the edge as a browser would.
_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"


def _extract_build_id(html: str) -> str | None:
    m = _BUILD_ID_RE.search(html) or _BUILD_ID_RE2.search(html)
    return m.group(1) if m else None


def _public_host(app_dir: Path, target: str) -> str | None:
    """Hôte servi = `PUBLIC_URL` du manifeste `env/<target>.public.json` (SSOT § PUBLIC-ENV). L'ancien calcul
    `<WORKER_NAME>.theplaybutton.dev` visait un hôte qui n'existe pas quand le domaine diffère du nom du Worker
    (ex. tpb-enrichment → enrichment.theplaybutton.dev)."""
    manifest = app_dir / "env" / f"{target}.public.json"
    if not manifest.is_file():
        return None
    data = json.loads(manifest.read_text(encoding="utf-8"))
    url = (data.get("backend") or {}).get("PUBLIC_URL") or (data.get("public") or {}).get("PUBLIC_URL")
    if not url:
        return None
    return urlsplit(url).hostname


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


def _vault_cf_access_sa(app_dir: Path) -> tuple[str, str] | None:
    """The shared SA from the vault, through tpb_sdk when it is reachable (`TPB_SDK_PYTHONPATH`, else the sibling
    `../tpb-sdk/python/src`) ; None when it is not (the edge is then read without it)."""
    import os
    for cand in (os.environ.get("TPB_SDK_PYTHONPATH"), str(app_dir.parent / "tpb-sdk" / "python" / "src")):
        if cand and (Path(cand) / "tpb_sdk").is_dir() and cand not in sys.path:
            sys.path.insert(0, cand)
    try:
        from tpb_sdk.crm.dev_bastion import dev_bastion  # the dev vault, TPB_TARGET stripped
    except ImportError:
        print("[deploy-verify] ⚠ tpb_sdk not importable — no CF Access SA from the vault.", file=sys.stderr)
        return None
    try:
        bastion = dev_bastion()
        cid, csecret = (bastion.get_secret(path) for path in _SA_VAULT_PATHS)
    except Exception as exc:  # noqa: BLE001 — logged, the edge read below decides the verdict
        print(f"[deploy-verify] ⚠ CF Access SA not readable from the vault ({type(exc).__name__}: {exc}).", file=sys.stderr)
        return None
    return (cid, csecret) if cid and csecret else None


def _cf_access_sa(app_dir: Path) -> tuple[str, str] | None:
    import os
    cid, csecret = os.environ.get("BASTION_CLIENT_ID"), os.environ.get("BASTION_CLIENT_SECRET")
    return (cid, csecret) if cid and csecret else _vault_cf_access_sa(app_dir)


def _read_edge(host: str, route: str, sa: tuple[str, str] | None) -> tuple[str | None, str]:
    """`(build id, "")` when the edge served the page with its marker ; `(None, why)` when the guard cannot read it."""
    headers = {"Cache-Control": "no-store", "User-Agent": _UA}
    if sa:
        headers.update({"CF-Access-Client-Id": sa[0], "CF-Access-Client-Secret": sa[1]})
    conn = http.client.HTTPSConnection(host, timeout=30)
    try:
        conn.request("GET", f"{route}?_deployverify={int(time.time())}", headers=headers)
        resp = conn.getresponse()
        body = resp.read().decode("utf-8", errors="replace")
        if resp.status == 200:
            build_id = _extract_build_id(body)
            return (build_id, "") if build_id else (None, "HTTP 200 without a tpb-build-id marker (a login or error page?)")
        location = resp.getheader("Location") or ""
        if "cloudflareaccess.com" in location:
            who = "the shared SA is not admitted by this app's CF Access policy" if sa else "no CF Access SA available"
            return None, f"HTTP {resp.status} to the CF Access login ({who}) : {location.split('?')[0]}"
        return None, f"HTTP {resp.status}"
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
    ap.add_argument("--wrangler", required=True, help="Path to the env's wrangler-<target>.toml (relative to --app-dir or absolute).")
    ap.add_argument("--app-dir", default=".", help="App repo root (default: current dir).")
    args = ap.parse_args()
    app_dir = Path(args.app_dir).resolve()

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

    host = _public_host(app_dir, args.target)
    if not host:
        print(f"[deploy-verify] ❌ no PUBLIC_URL in env/{args.target}.public.json — cannot know which host serves this "
              f"deploy. Add backend.PUBLIC_URL to the manifest.", file=sys.stderr)
        return 1
    print(f"[deploy-verify] local build-id={local} host={host} route={route}")
    sa = _cf_access_sa(app_dir)

    edge: str | None = None
    for attempt in range(MAX_RETRIES + 1):
        time.sleep(3)
        edge, why = _read_edge(host, route, sa)
        if edge is None:
            if attempt < MAX_RETRIES:
                print(f"[deploy-verify] attempt {attempt}: edge unreadable ({why}) — reading again.")
                continue
            print(f"[deploy-verify] ❌ edge UNVERIFIABLE at https://{host}{route} : {why}. The deploy ran, its freshness "
                  "is not proven ; not re-deploying (an unreadable edge is not a stale one).", file=sys.stderr)
            return 1
        print(f"[deploy-verify] attempt {attempt}: edge build-id={edge}")
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
