#!/usr/bin/env python3
"""Canonical post-deploy smoke for a TPB Worker — the ONE proof the CI, the master gate (axis 107) and a human run.

    python3 scripts/smoke_canonical.py <dev|staging|production> [--preflight]

Inputs come from the env manifest `env/<env>.public.json` (backend), never from CI-only variables, so every runner has
the same ones:
  - PUBLIC_URL      the Worker's canonical URL for that env (declared, not derived from a naming guess);
  - SMOKE_TPB_ARGS  an authenticated READ through tpb-cli (`tpb --format json <args>`), e.g. "crm list-companies
                    --limit 1" — the canonical client path, never a raw fetch.
An app that needs more than one read ships `scripts/smoke_app.sh <env>`; it replaces SMOKE_TPB_ARGS.
The exact argument `{PUBLIC_URL}` expands to the selected manifest URL, for clients with an explicit
endpoint assertion (for example `rmm list-agents --expected-api-url {PUBLIC_URL}`). Expansion happens
after argument parsing, without a shell. The BC client owns authentication, HTTP status and wire validation.
Identity: BASTION_TOKEN (the CI provides the env's; locally the devcontainer's). `--preflight` checks the inputs
only (no network) — run before any mutation. Health alone is never a proof: a Worker whose auth is dead answers
/health. The authenticated read is the reachability proof, including on Workers behind Cloudflare Access.
Prints one JSON line; exit 0 only on {"ok": true}. A successful command's output is never printed (it may carry customer data).
A failed command adds `failure_tail`, the end of what it said with secrets masked: its standard error, or its standard output when
that is empty, where tpb-cli writes a refusal. `SMOKE_AUTH_READ_FAILED` alone left tpb-crm's dev deploy red with no cause to read
(runs 378, 381 and 386, 2026-11-06).

Shipped byte-identical by tpb-devops/scripts/generate_workflows.py (deploy kit). Stdlib only.
"""
from __future__ import annotations

import json
import os
import re
import shlex
import subprocess
import sys
from collections.abc import Callable, Mapping
from pathlib import Path

_ENVS = ("dev", "staging", "production")
_SECRET_VARIABLE = re.compile(r"TOKEN|SECRET|PASSWORD|KEY", re.IGNORECASE)
_BASTION_TOKEN_SHAPE = re.compile(r"\bbastion_[A-Za-z0-9_-]+")
_FRAME_OR_PADDING = re.compile(r"[\s\u2500-\u257f]+")  # The CLI frames its traceback in boxes padded to the terminal's width.
_FAILURE_TAIL_CHARACTERS = 1500
_SHORTEST_MASKED_VALUE = 8  # Below that it is a setting (`SOME_KEY=1`), and masking it would blank out the message.


def _run_cli(args: list[str], env: Mapping[str, str]) -> tuple[int, str]:
    # A wide terminal keeps the CLI from folding a line, so a secret cannot escape the mask by being cut in two.
    done = subprocess.run(args, env={**env, "COLUMNS": "500"}, capture_output=True, text=True, timeout=120, check=False)
    return done.returncode, (done.stderr or done.stdout) if done.returncode else ""


def _masked_tail(said: str, environment: Mapping[str, str]) -> str:
    for name, value in environment.items():
        if len(value) >= _SHORTEST_MASKED_VALUE and _SECRET_VARIABLE.search(name):
            said = said.replace(value, "***")
    readable = _FRAME_OR_PADDING.sub(" ", _BASTION_TOKEN_SHAPE.sub("***", said))
    return readable.strip()[-_FAILURE_TAIL_CHARACTERS:]


def smoke(app_dir: Path, target: str, environment: Mapping[str, str], *,
          run_cli: Callable[[list[str], Mapping[str, str]], tuple[int, str]] = _run_cli,
          preflight: bool = False, public_url_field: str = 'PUBLIC_URL') -> dict:
    if target not in _ENVS:
        return {"ok": False, "code": "SMOKE_TARGET_INVALID"}
    manifest = app_dir / "env" / f"{target}.public.json"
    if not manifest.is_file():
        return {"ok": False, "code": "SMOKE_MANIFEST_MISSING"}
    backend = json.loads(manifest.read_text()).get("backend") or {}
    if not isinstance(public_url_field, str) or not public_url_field:
        return {"ok": False, "code": "SMOKE_PUBLIC_URL_FIELD_INVALID"}
    url = str(backend.get(public_url_field) or "").rstrip("/")
    if not url.startswith("https://"):
        return {"ok": False, "code": "SMOKE_PUBLIC_URL_MISSING"}
    app_recipe = app_dir / "scripts" / "smoke_app.sh"
    read_args = str(backend.get("SMOKE_TPB_ARGS") or "").strip()
    if not app_recipe.is_file() and not read_args:
        return {"ok": False, "code": "SMOKE_AUTH_READ_UNDECLARED"}
    if not str(environment.get("BASTION_TOKEN") or "").strip():
        return {"ok": False, "code": "SMOKE_AUTH_REQUIRED"}
    try:
        arguments = [url if argument == '{PUBLIC_URL}' else argument for argument in shlex.split(read_args)]
    except ValueError:
        return {"ok": False, "code": "SMOKE_AUTH_READ_INVALID"}
    if preflight:
        return {"ok": True, "scope": "inputs-only", "target": target}

    env = {**environment, "TPB_TARGET": target}
    try:
        if app_recipe.is_file():
            (rc, said), code = run_cli(["bash", str(app_recipe), target], env), "SMOKE_APP_RECIPE_FAILED"
        else:
            (rc, said), code = run_cli(["tpb", "--format", "json", *arguments], env), "SMOKE_AUTH_READ_FAILED"
    except (OSError, subprocess.TimeoutExpired):
        return {"ok": False, "code": "SMOKE_CLI_UNAVAILABLE_OR_TIMEOUT"}
    if rc != 0:
        return {"ok": False, "code": code, "failure_tail": _masked_tail(said, env)}
    return {"ok": True, "target": target}


def main(argv: list[str]) -> int:
    if not argv or argv[0] not in _ENVS:
        print(json.dumps({"ok": False, "code": "SMOKE_USAGE", "usage": "smoke_canonical.py <env> [--preflight]"}))
        return 2
    result = smoke(Path.cwd(), argv[0], os.environ, preflight="--preflight" in argv[1:])
    print(json.dumps(result))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
