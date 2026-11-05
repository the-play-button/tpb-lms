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

`--target <env>` est obligatoire : ce qu'un déploiement lit dépend de son env (un chemin déclaré
`vault-production-only` n'est requis qu'en production). Il lance aussi `materialize_public_env.py --check`
(manifest présent + schéma + placeholders wrangler résolubles) AVANT le vault check.

Usage :
  python3 pre_deploy_secrets_check.py \
    --app-path Apps/the-play-button/tpb-dialer \
    --target staging \
    --bastion-url $BASTION_URL_STAGING \
    --bastion-token $BASTION_TOKEN_STAGING

Exit codes :
  0  tous les secrets requis pour la cible présents + manifest cohérent
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

# What the deployed Worker reads from the vault. A path is found on any `<receiver>.getSecret(…)` or
# `createLazyVaultSecret(…)` call (`createOptionalLazyVaultSecret` = optional, not required). Its argument is a
# string literal, a template literal without interpolation, or a `const NAME = 'tpb/…'` of the app (the file's own
# constant first). Two cases are not a reference (2026-10-28, six apps could not deploy because of them) :
# - a FORWARDING helper : the argument is a `string` parameter of the enclosing function (the real path is read where
#   the helper is called) ;
# - a data-driven path DECLARED on the call line or the line above :
#   `// vault-dynamic-path: <prefix> — <reason>` (one secret per portal, subscription…). It is listed, not checked.
# A resolved path whose absence the code handles itself (a provider credential used only by one connection type, a
# config table without which a job is a no-op) is DECLARED optional on the call line or the line above :
#   `// vault-optional: <reason>`. It is checked and its absence printed, but it does not block the deploy.
# A resolved path read only by code that runs in production (a production-only cron holding a credential that acts on
# the whole Cloudflare account) is DECLARED on the call line or the line above :
#   `// vault-production-only: <reason>`. Required for `production`, listed and not required for dev and staging.
# Anything else stays a hard error : an unresolved reference is never silently ignored.
# A secret read in ANOTHER organisation's vault (`createLazyVaultSecret(path, { organizationId: X })`, X a literal or an
# app constant `const X = 'org_…'`) is checked in that organisation (`TPB_BASTION_ACTIVE_ORG_ID`, the CLI's --org) :
# 2026-11-01, the WGE bridge reads its HubSpot token in the WGE org vault and every gate judged it unreadable.
SECRET_CALL_PATTERN = re.compile(r"(?:\.getSecret|\bcreateLazyVaultSecret)\s*\(\s*([^,)]+)(?:,\s*\{([^}]*)\})?")
ORGANIZATION_OPTION = re.compile(r"\borganizationId\s*:\s*([^,}\s]+)")
ORGANIZATION_CONSTANT = re.compile(r"\bconst\s+(\w+)\s*=\s*[\"'`](org_[^\"'`$]+)[\"'`]")
STRING_LITERAL = re.compile(r"^(?:\"([^\"]+)\"|'([^']+)'|`([^`$]+)`)$")
VAULT_CONSTANT = re.compile(r"\bconst\s+(\w+)\s*=\s*[\"'`](tpb/[^\"'`$]+)[\"'`]")
DYNAMIC_DECLARATION = re.compile(r"vault-dynamic-path:\s*(\S+)\s*(?:—|-)\s*(.+)")
OPTIONAL_DECLARATION = re.compile(r"vault-optional:\s*(\S.+)")
PRODUCTION_ONLY_DECLARATION = re.compile(r"vault-production-only:\s*(\S.+)")
TARGETS = ("dev", "staging", "production")
IDENTIFIER = re.compile(r"^[A-Za-z_$][\w$]*$")

# The Worker source only — it never runs a .py (Python admin scripts are not deployed code).
SCAN_EXTENSIONS = {".ts", ".js", ".mjs", ".cjs", ".tsx", ".jsx"}

# Skip dirs (build artifacts, vendored) and tests (their paths are fixtures, not runtime reads)
SKIP_DIRS = {"node_modules", "dist", "build", ".wrangler", ".next", "__pycache__", ".git", "plans", "__tests__", "__mocks__"}
SKIP_SUFFIXES = (".test.ts", ".test.tsx", ".test.js", ".spec.ts", ".spec.tsx", ".spec.js")


def _strip_comments(text: str) -> str:
    """Blank `//` and `/* */` comments outside string and template literals, keeping every newline."""
    out: list[str] = []
    i, quote = 0, ""
    while i < len(text):
        ch = text[i]
        if quote:
            out.append(ch)
            if ch == "\\" and i + 1 < len(text):
                out.append(text[i + 1]); i += 2; continue
            if ch == quote:
                quote = ""
            i += 1
        elif ch in "'\"`":
            quote = ch; out.append(ch); i += 1
        elif text.startswith("//", i):
            j = text.find("\n", i)
            j = len(text) if j == -1 else j
            out.append(" " * (j - i)); i = j
        elif text.startswith("/*", i):
            j = text.find("*/", i + 2)
            j = len(text) if j == -1 else j + 2
            out.append("".join(c if c == "\n" else " " for c in text[i:j])); i = j
        else:
            out.append(ch); i += 1
    return "".join(out)


def _is_forwarded_parameter(code: str, position: int, name: str) -> bool:
    """True when `name` is a `string` parameter of a function declared in the 8 lines above the call."""
    window = "\n".join(code[:position].split("\n")[-8:])
    n = re.escape(name)
    return re.search(rf"\b{n}\s*\??\s*:\s*string\b|(?:\basync\s+|[(,]\s*){n}\s*\)?\s*=>", window) is not None


def _source_files(app_path: Path) -> list[Path]:
    files = []
    for f in app_path.rglob("*"):
        if not f.is_file() or f.resolve() == Path(__file__).resolve() or f.suffix not in SCAN_EXTENSIONS:
            continue
        if any(skip in f.parts for skip in SKIP_DIRS) or f.name.endswith(SKIP_SUFFIXES):
            continue
        relative_dirs = f.relative_to(app_path).parts[:-1]
        if any(part == "out" or part.startswith("dist") or part == ".open-next" for part in relative_dirs):
            continue  # generated bundles (Next export, Vite dist) carry minified SDK code, not app references
        if relative_dirs[:1] == ("scripts",):
            continue  # <app>/scripts/ holds operator scripts run by hand, never part of the Worker bundle
        files.append(f)
    return files


def scan_secret_refs(
    app_path: Path, target: str,
) -> tuple[set[str], list[tuple[str, str, str]], list[tuple[str, str, str]], list[tuple[str, str, str]], dict[str, str]]:
    """Return, for one deploy `target`, (required vault paths, declared dynamic references as (file, prefix, reason),
    declared optional paths as (file, path, reason), declared production-only paths as (file, path, reason), the
    organisation each cross-organisation path is read in). A production-only path is required for `production` only.
    Raises on the unresolved."""
    if target not in TARGETS:
        raise ValueError(f"target must be one of {TARGETS}, not {target!r}")
    sources: dict[Path, str] = {}
    app_constants: dict[str, set[str]] = {}
    organization_constants: dict[str, set[str]] = {}
    organizations: dict[str, str] = {}
    for f in _source_files(app_path):
        try:
            text = f.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        sources[f] = text
        for name, value in VAULT_CONSTANT.findall(_strip_comments(text)):
            app_constants.setdefault(name, set()).add(value)
        for name, value in ORGANIZATION_CONSTANT.findall(_strip_comments(text)):
            organization_constants.setdefault(name, set()).add(value)
    refs: set[str] = set()
    dynamic: list[tuple[str, str, str]] = []
    optional: list[tuple[str, str, str]] = []
    production_only: list[tuple[str, str, str]] = []
    for f, text in sources.items():
        code = _strip_comments(text)
        local = dict(VAULT_CONSTANT.findall(code))
        raw_lines = text.split("\n")
        for match in SECRET_CALL_PATTERN.finditer(code):
            argument = match.group(1).strip()
            line = code[: match.start()].count("\n")
            near = [raw_lines[n] for n in (line, line - 1) if n >= 0]
            path = None
            literal = STRING_LITERAL.fullmatch(argument)
            if literal:
                path = next(g for g in literal.groups() if g)
            elif IDENTIFIER.fullmatch(argument):
                if argument in local:
                    path = local[argument]
                elif len(app_constants.get(argument, ())) == 1:
                    path = next(iter(app_constants[argument]))
                elif _is_forwarded_parameter(code, match.start(), argument):
                    continue
            if path is not None:
                option = ORGANIZATION_OPTION.search(match.group(2) or "")
                if option:
                    organization = option.group(1).strip("'\"`")
                    if not organization.startswith("org_"):
                        candidates = organization_constants.get(option.group(1), set())
                        if len(candidates) != 1:
                            raise RuntimeError(f"Unresolved organizationId {option.group(1)} in {f.relative_to(app_path)}:{line + 1} "
                                               "— use a literal or one app constant `const NAME = 'org_…'`")
                        organization = next(iter(candidates))
                    organizations[path] = organization
                why = next((m for m in map(OPTIONAL_DECLARATION.search, near) if m), None)
                only = next((m for m in map(PRODUCTION_ONLY_DECLARATION.search, near) if m), None)
                if why:
                    optional.append((str(f.relative_to(app_path)), path, why.group(1).strip()))
                elif only:
                    production_only.append((str(f.relative_to(app_path)), path, only.group(1).strip()))
                    if target == "production":
                        refs.add(path)
                else:
                    refs.add(path)
                continue
            declared = next((m for m in map(DYNAMIC_DECLARATION.search, near) if m), None)
            if declared:
                dynamic.append((str(f.relative_to(app_path)), declared.group(1), declared.group(2).strip())); continue
            raise RuntimeError(f"Unresolved vault reference in {f.relative_to(app_path)}:{line + 1} — use a literal path or "
                               "an app constant, or declare a data-driven path with `// vault-dynamic-path: <prefix> — <reason>`")
    return refs, dynamic, optional, production_only, organizations


def find_secret_refs(app_path: Path, target: str) -> set[str]:
    """The vault paths a deploy of app_path to `target` requires."""
    return scan_secret_refs(app_path, target)[0]


def find_secret_organizations(app_path: Path, target: str) -> dict[str, str]:
    """The organisation each cross-organisation vault path of app_path is read in (absent = the identity's own)."""
    return scan_secret_refs(app_path, target)[4]


def check_vault_has(bastion_url: str, bastion_token: str, path: str,
                    target: str | None = None, organization_id: str | None = None) -> bool:
    """Check readability through CLI → Python → TypeScript, in `organization_id`'s vault when given ; never return a
    secret."""
    env = {**os.environ, "BASTION_URL": bastion_url, "BASTION_TOKEN": bastion_token}
    if target is not None:
        env["TPB_TARGET"] = target
    if organization_id is not None:
        env["TPB_BASTION_ACTIVE_ORG_ID"] = organization_id
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


def worker_name(config_path: Path, target: str) -> str:
    """The name this deploy gives its Worker : the target's block when the toml has one, else the toml's own."""
    import tomllib
    config = tomllib.loads(config_path.read_text(encoding="utf-8"))
    selected = config.get("env", {}).get(target, config) if target != "dev" else config
    name = selected.get("name") or config.get("name")
    if not isinstance(name, str) or not name:
        raise RuntimeError(f"{config_path} names no Worker for {target}")
    return name


def registered_workers(registry_text: str) -> set[str]:
    return set(re.findall(r"^- name: ([A-Za-z0-9_-]+)\s*$", registry_text, re.MULTILINE))


def check_worker_registered(config_path: Path, registry_path: Path, target: str) -> int:
    """The kill switch stops every 5 minutes a Worker its registry does not name : four did go down that way, deployed green
    (2026-11-01). Refused here, before `wrangler deploy`, with the command that declares it. A registry that cannot be read refuses."""
    name = worker_name(config_path, target)
    workers = registered_workers(registry_path.read_text(encoding="utf-8"))
    if not workers:
        print(f"ERROR: {registry_path} names no Worker : refusing rather than deploying unchecked.", file=sys.stderr)
        return 2
    if name in workers:
        print(f"  ✓ Worker {name} is in the kill switch's registry")
        return 0
    print(f"ERROR: Worker {name} is not in the kill switch's registry, which would stop it within 5 minutes. Declare it, then redeploy :\n"
          f"  tpb cf-kill-switch registry create {name} --owner <email> --envs {target}\n"
          f"  tpb cf-kill-switch registry update --target production", file=sys.stderr)
    return 1


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
        choices=TARGETS,
        required=True,
        help="Env of the deploy: what it reads depends on it (vault-production-only), and "
        "materialize_public_env.py --check <target> runs first (manifest coherence gate).",
    )
    parser.add_argument(
        "--skip-vault-check",
        action="store_true",
        help="Print refs without querying bastion (debug mode)",
    )
    parser.add_argument("--worker-config", type=Path, help="The deploy's wrangler file : its Worker must be in --worker-registry.")
    parser.add_argument("--worker-registry", type=Path, help="tpb-devops's cf_workers_registry.yaml, fetched by the deploy job.")
    args = parser.parse_args()
    if args.worker_config or args.worker_registry:
        if not (args.worker_config and args.worker_registry):
            print("ERROR: --worker-config and --worker-registry go together", file=sys.stderr)
            return 2
        try:
            rc = check_worker_registered(args.worker_config, args.worker_registry, args.target)
        except (OSError, ValueError, RuntimeError) as error:
            print(f"ERROR: cannot judge the Worker's registration : {type(error).__name__}: {error}", file=sys.stderr)
            return 2
        if rc != 0:
            return rc
    if not args.bastion_url:
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
    rc = _materialize_check(args.app_path, args.target)
    if rc != 0:
        print(
            f"FAIL : manifest coherence check failed for target "
            f"{args.target!r} (materialize_public_env --check exit {rc}).",
            file=sys.stderr,
        )
        return 1

    try:
        refs, dynamic, optional, production_only, organizations = scan_secret_refs(args.app_path, args.target)
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    if args.target != "production":
        for file, path, reason in production_only:
            if path not in refs:  # required elsewhere in the app wins
                print(f"  ⊘ {path} (prod seulement : {reason}) — {file}")
    for file, prefix, reason in dynamic:
        print(f"  ~ {prefix}* (dynamique : {reason}) — {file}")
    optional = [o for o in optional if o[1] not in refs]  # required elsewhere in the app wins
    for file, path, reason in optional:
        print(f"  ? {path} (optionnel : {reason}) — {file}")
    if optional and args.bastion_token and not args.skip_vault_check:
        for _, path, reason in optional:
            try:
                ready = check_vault_has(args.bastion_url, args.bastion_token, path, args.target, organizations.get(path))
            except RuntimeError as e:
                print(f"ERROR: {e}", file=sys.stderr)
                return 2
            print(f"  {'✓' if ready else '⚠'} {path}" + ("" if ready else f" — absent, déployé quand même ({reason})"))
    if not refs:
        print(f"[pre_deploy_secrets_check] No `bastion.getSecret(...)` references found in {args.app_path}")
        return 0

    if not args.bastion_token:
        print("ERROR: BASTION_TOKEN is required.", file=sys.stderr)
        return 2

    print(f"[pre_deploy_secrets_check] {len(refs)} secret refs detected :")
    for ref in sorted(refs):
        print(f"  - {ref}")

    if args.skip_vault_check:
        return 0

    print(f"[pre_deploy_secrets_check] checking vault at {args.bastion_url} ...")
    missing: list[str] = []
    for ref in sorted(refs):
        try:
            if check_vault_has(args.bastion_url, args.bastion_token, ref, args.target, organizations.get(ref)):
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
