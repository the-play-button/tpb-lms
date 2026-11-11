"""Read explicit deployment facts from a committed Wrangler multi-environment source.

This does not normalize Wrangler inheritance or perform network operations.
Wrangler retains ownership of deployment semantics. Pipeline metadata must come
from one explicit selected environment, with no fallback to another target.
"""
from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path
from urllib.parse import urlsplit
from uuid import UUID

TARGETS = ("dev", "staging", "production")


class UnnamedWranglerEnvironments(ValueError):
    """A committed wrangler.toml that declares no [env.*]: it names no target, so it cannot deploy one. Never skipped:
    tpb-messaging's dev config was such a file under backend/email-gateway/, and the generator left its dev without a
    deploy for weeks (tpb-devops sub-55 plan 11.2.1, 2026-11-07)."""
_SAFE_NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]*")


def _name(value: object, label: str) -> str:
    if not isinstance(value, str) or not _SAFE_NAME.fullmatch(value):
        raise ValueError(f"selected Worker target has an invalid {label}")
    return value


def read_worker_target(config_path: Path, target: str) -> dict:
    """Return public pipeline facts from exactly one explicit target; never merge environments."""
    if target not in TARGETS:
        raise ValueError("unknown deployment target")
    try:
        import tomllib
    except ModuleNotFoundError:
        raise ValueError("Python 3.11 or newer is required to read a committed multi-environment source") from None
    config = tomllib.loads(config_path.read_text(encoding="utf-8"))
    environments = config.get("env")
    if not isinstance(environments, dict) or not environments:
        raise UnnamedWranglerEnvironments("committed source must declare named Wrangler environments")
    selected = config if target == "dev" else environments.get(target)
    if not isinstance(selected, dict):
        raise ValueError(f"committed source has no explicit {target} environment")
    worker_name = _name(selected.get("name"), "Worker name")
    databases = selected.get("d1_databases")
    if not isinstance(databases, list) or len(databases) != 1 or not isinstance(databases[0], dict):
        raise ValueError("selected Worker target must explicitly declare exactly one D1 database")
    database = databases[0]
    database_name = _name(database.get("database_name"), "D1 database name")
    _name(database.get("binding"), "D1 binding")
    database_id = database.get("database_id")
    try:
        if not isinstance(database_id, str) or str(UUID(database_id)) != database_id:
            raise ValueError
    except (ValueError, AttributeError):
        raise ValueError("selected Worker target has an invalid D1 database id") from None
    variables = selected.get("vars")
    if not isinstance(variables, dict) or variables.get("ENVIRONMENT") != target:
        raise ValueError("selected Worker ENVIRONMENT must equal the deployment target")
    bastion_url = variables.get("BASTION_URL")
    if not isinstance(bastion_url, str) or any(character.isspace() for character in bastion_url):
        raise ValueError("selected Worker target requires an explicit HTTPS BASTION_URL")
    parsed = urlsplit(bastion_url)
    parsed.port  # Validate a supplied port before any network-capable pipeline step.
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username is not None
            or parsed.password is not None or parsed.query or parsed.fragment):
        raise ValueError("selected Worker target requires an explicit HTTPS BASTION_URL")
    triggers = selected.get("triggers")
    if not isinstance(triggers, dict) or not isinstance(triggers.get("crons"), list):
        raise ValueError("selected Worker target must explicitly declare triggers.crons")
    if not all(isinstance(expression, str) for expression in triggers["crons"]):
        raise ValueError("selected Worker cron expressions must be strings")
    return {
        "worker_name": worker_name,
        "database_name": database_name,
        "database_id": database_id,
        "bastion_url": bastion_url,
        "cron_expressions": triggers["crons"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True, type=Path, help="Path to the committed Worker configuration")
    parser.add_argument("--target", required=True, choices=TARGETS, help="Environment whose explicit Worker settings must be selected")
    parser.add_argument("--field", choices=("bastion-url", "database-id", "database-name", "worker-name"), help="Emit one selected public value instead of the whole target")
    parser.add_argument("--require-credentials", action="store_true", help="Require explicit Cloudflare account and token before any operation")
    args = parser.parse_args()
    if args.require_credentials:
        if not re.fullmatch(r"[0-9a-f]{32}", os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")):
            raise ValueError("an explicit Cloudflare account id is required before any Cloudflare operation")
        if not os.environ.get("CLOUDFLARE_API_TOKEN", "").strip():
            raise ValueError("a Cloudflare API token is required before any Cloudflare operation")
    selected = read_worker_target(args.config, args.target)
    print(selected[args.field.replace("-", "_")] if args.field else json.dumps(selected, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
