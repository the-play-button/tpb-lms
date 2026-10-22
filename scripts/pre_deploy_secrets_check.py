#!/usr/bin/env python3
"""pre_deploy_secrets_check.py — Vérifie que tous les secrets que l'app va
fetcher au runtime depuis le bastion vault existent réellement dans le vault
de l'env cible AVANT de déployer.

Fail-hard si manquant — bloque le deploy (= moins de 500 silencieux en prod).

Ce script vérifie UNIQUEMENT les VRAIS secrets (référencés via
`bastion.getSecret(...)` au runtime). La config PUBLIQUE par-env (IDP, BASTION_URL,
D1 IDs…) ne passe plus par ici : elle vit dans le manifest tracké
`env/<target>.public.json` + est vérifiée par les checks tpb-entropy C1/C2/C6 au
commit. Doctrine 2026-07-15 § PUBLIC-ENV.

Gate coherence optionnel : `--target <env>` lance `materialize_public_env.py --check`
(manifest présent + schéma + placeholders wrangler résolubles) AVANT le vault check.
Remplace l'ancienne lecture vault `build_env` par une validation locale hermétique.

Usage :
  python3 pre_deploy_secrets_check.py \
    --app-path Apps/the-play-button/tpb-dialer \
    --target staging \
    --bastion-url $BASTION_URL_STAGING \
    --bastion-token $BASTION_TOKEN_STAGING

Exit codes :
  0  tous les secrets référencés présents + manifest cohérent (si --target)
  1  un ou plusieurs secrets manquants / manifest incohérent — détail en stderr
  2  bad args / bastion unreachable
"""

from __future__ import annotations

import argparse
import os
import subprocess
import json
import re
import sys
from pathlib import Path

# Literal paths and file-local string constants cover direct and lazy SDK calls.
SECRET_CALL_PATTERN = re.compile(
    r"(?:bastion(?:Client)?\.getSecret|createLazyVaultSecret)\s*\(\s*([^,)]+)"
)
STRING_LITERAL = re.compile(r"^[\"']([^\"']+)[\"']$")
LOCAL_CONSTANT = re.compile(r"\bconst\s+(\w+)\s*=\s*[\"']([^\"']+)[\"']")

# Files types worth scanning
SCAN_EXTENSIONS = {".ts", ".js", ".mjs", ".cjs", ".tsx", ".jsx", ".py"}

# Skip dirs (build artifacts, vendored)
SKIP_DIRS = {"node_modules", "dist", "build", ".wrangler", ".next", "__pycache__", ".git"}


def find_secret_refs(app_path: Path) -> set[str]:
    """Walk app_path, return set of unique secret paths referenced in source."""
    refs: set[str] = set()
    for f in app_path.rglob("*"):
        if not f.is_file() or f.resolve() == Path(__file__).resolve():
            continue
        if f.suffix not in SCAN_EXTENSIONS:
            continue
        if any(skip in f.parts for skip in SKIP_DIRS):
            continue
        try:
            content = f.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        constants = dict(LOCAL_CONSTANT.findall(content))
        for match in SECRET_CALL_PATTERN.finditer(content):
            argument = match.group(1).strip()
            literal = STRING_LITERAL.fullmatch(argument)
            path = literal.group(1) if literal else constants.get(argument)
            if path is None:
                raise RuntimeError(f"Unresolved vault reference in {f.relative_to(app_path)}")
            refs.add(path)
    return refs


def check_vault_has(bastion_url: str, bastion_token: str, path: str,
                    target: str | None = None) -> bool:
    """Check readability through CLI → Python → TypeScript; never return a secret."""
    env = {**os.environ, "BASTION_URL": bastion_url, "BASTION_TOKEN": bastion_token}
    if target is not None:
        env["TPB_TARGET"] = target
    try:
        result = subprocess.run(
            ["tpb", "bastion", "check-secret", "--path", path],
            env=env, capture_output=True, text=True, timeout=90, check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        raise RuntimeError("SECRET_READINESS_CLI_FAILED") from None
    try:
        payload = json.loads(result.stdout)
    except (ValueError, TypeError):
        raise RuntimeError("SECRET_READINESS_INVALID_RESPONSE") from None
    if (not isinstance(payload, dict) or payload.get("ok") is not True
            or type(payload.get("ready")) is not bool
            or result.returncode != (0 if payload["ready"] else 1)):
        raise RuntimeError(f"SECRET_READINESS_FAILED ({_cli_verdict(payload, result.returncode)})")
    return payload["ready"]


_ENUM_CODE = re.compile(r"^[A-Z][A-Z_]{0,63}$")


def _cli_verdict(payload: object, returncode: int) -> str:
    """Why the CLI answer could not be judged: its exit code, ENUMERATED error code and integer HTTP status only.
    A free-text field is never echoed (it could carry a secret) — it shows as `?`; an absent field as `-`."""
    fields = payload if isinstance(payload, dict) else {}
    error, status = fields.get("error"), fields.get("status")
    shown_error = "-" if error is None else error if isinstance(error, str) and _ENUM_CODE.match(error) else "?"
    shown_status = "-" if status is None else str(status) if type(status) is int else "?"
    return f"cli exit={returncode} error={shown_error} status={shown_status}"


def _materialize_check(app_path: Path, target: str) -> int:
    """Run materialize_public_env.py --check for the target. Returns its exit code.

    The generator lives next to this script (tpb-devops-cd/scripts/), vendored
    per-app. Invoked via subprocess so a fail-hard SystemExit stays isolated.
    """
    import subprocess

    generator = Path(__file__).resolve().parent / "materialize_public_env.py"
    if not generator.exists():
        print(
            f"ERROR: materialize_public_env.py not found at {generator}",
            file=sys.stderr,
        )
        return 2
    result = subprocess.run(
        [sys.executable, str(generator), target, "--app-dir", str(app_path), "--check"],
        capture_output=False,
    )
    return result.returncode


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--app-path", required=True, type=Path,
                        help="Path to the consumer app directory whose secrets are being checked.")
    parser.add_argument("--bastion-url", required=False, default=None,
                        help="Bastion base URL. If omitted, derived from --target via the app's "
                        "env/<target>.public.json backend.BASTION_URL (§ PUBLIC-ENV SSOT, shipped in "
                        "every repo — no Forgejo BASTION_URL_* secret, no unvendored helper).")
    parser.add_argument("--bastion-token", default=os.environ.get("BASTION_TOKEN"),
                        help="Bearer PAT used to probe the bastion vault for the required secret paths.")
    parser.add_argument(
        "--target",
        choices=("dev", "staging", "production"),
        default=None,
        help="If set, run materialize_public_env.py --check <target> first "
        "(manifest coherence gate).",
    )
    parser.add_argument(
        "--skip-vault-check",
        action="store_true",
        help="Print refs without querying bastion (debug mode)",
    )
    args = parser.parse_args()
    if not args.bastion_token:
        print("ERROR: BASTION_TOKEN is required.", file=sys.stderr)
        return 2
    if not args.bastion_url:
        if not args.target:
            print("ERROR: provide --bastion-url OR --target (to derive it).", file=sys.stderr)
            return 2
        manifest = args.app_path / "env" / f"{args.target}.public.json"
        try:
            args.bastion_url = str(json.loads(manifest.read_text())["backend"]["BASTION_URL"]).rstrip("/")
        except (OSError, ValueError, KeyError, TypeError) as error:
            print(f"ERROR: cannot derive the bastion URL from {manifest} (backend.BASTION_URL): "
                  f"{type(error).__name__}: {error}", file=sys.stderr)
            return 2

    if not args.app_path.is_dir():
        print(f"ERROR: app path is not a directory: {args.app_path}", file=sys.stderr)
        return 2

    # Coherence gate — validate the tracked manifest + wrangler placeholders
    # hermetically before any deploy work. Replaces the old vault build_env read.
    if args.target is not None:
        rc = _materialize_check(args.app_path, args.target)
        if rc != 0:
            print(
                f"FAIL : manifest coherence check failed for target "
                f"{args.target!r} (materialize_public_env --check exit {rc}).",
                file=sys.stderr,
            )
            return 1

    try:
        refs = find_secret_refs(args.app_path)
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    if not refs:
        print(f"[pre_deploy_secrets_check] No `bastion.getSecret(...)` references found in {args.app_path}")
        return 0

    print(f"[pre_deploy_secrets_check] {len(refs)} secret refs detected :")
    for ref in sorted(refs):
        print(f"  - {ref}")

    if args.skip_vault_check:
        return 0

    print(f"[pre_deploy_secrets_check] checking vault at {args.bastion_url} ...")
    missing: list[str] = []
    for ref in sorted(refs):
        try:
            if check_vault_has(args.bastion_url, args.bastion_token, ref, args.target):
                print(f"  ✓ {ref}")
            else:
                print(f"  ✗ {ref} — NOT READY (no readable nonempty value)")
                missing.append(ref)
        except RuntimeError as e:
            print(f"ERROR: {e}", file=sys.stderr)
            return 2

    if missing:
        print("", file=sys.stderr)
        print(f"FAIL : {len(missing)} secrets not ready in target env vault :", file=sys.stderr)
        for ref in missing:
            print(f"  {ref}", file=sys.stderr)
        print("", file=sys.stderr)
        print(
            "Action : qualify access and provision the required secrets in the target env bastion vault "
            "before re-attempting deploy. Use the bastion API POST /vault/secrets or "
            "the appropriate skill (security/bastion/manage-connections).",
            file=sys.stderr,
        )
        return 1

    print(f"[pre_deploy_secrets_check] OK — all {len(refs)} secrets present in vault")
    return 0


if __name__ == "__main__":
    sys.exit(main())
