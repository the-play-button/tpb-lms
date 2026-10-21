#!/usr/bin/env python3
"""Materialize public per-env config for a TPB app from its tracked manifest.

SSOT generator for the public-env convention (initiative
`plans/2026-07-15_public-env-config-canon-and-lock/`). Reads the tracked
`<app>/env/<target>.public.json` manifest and materializes the two artefacts
that Next.js and wrangler expect:

  1. `<app>/frontend/.env.production` (gitignored)  — one line per `public.*`
     key + the public header-comment. `next build` runs in NODE_ENV=production
     and reads `.env.production` regardless of target ; its VALUES come from
     `env/<target>.public.json`.
  2. `<app>/wrangler-<target>.toml` (gitignored)    — `<app>/wrangler.template.toml`
     with `{{KEY}}` placeholders substituted from `backend.*`.

**Replaces** two predecessor scripts, unifying their two sources into one tracked
manifest :
  - `frontend/scripts/inject_build_env_from_vault.py` (read the vault)
  - `.forgejo/workflows/_substitute_wrangler.py` (read the CI env)

Doctrine (CLAUDE.md § PUBLIC-ENV + § ALWAYS FAIL HARD) :
  - HERMETIC : stdlib-only, zero network, zero vault/bastion read.
  - FAIL-HARD : missing manifest / missing key / unsubstituted placeholder /
    whitelist violation → non-zero exit, no partial write.
  - DETERMINISTIC : same manifest → same output bytes.
  - ZERO FALLBACK : never read `.env.local`, ambient env, or a hardcoded default.

Usage
-----

    materialize_public_env.py <target> [--app-dir .] [--check]

    <target> ∈ {dev, staging, production}
    --app-dir : app root (contains env/, frontend/, wrangler.template.toml). Default '.'.
    --check   : validate only (manifest present + schema + placeholders resolvable),
                write nothing. Exit 0/1. Used pre-deploy.

Mapping worker → target (naming convention) :
    tpb-{app}            → dev
    tpb-{app}-staging    → staging
    tpb-{app}-production → production
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
from pathlib import Path

VALID_TARGETS = ("dev", "staging", "production")

# Whitelist SSOT for the public-env convention (RUNTIME authority). This tuple
# is the source; reference/public-var-whitelist.md is its human-readable
# projection, reviewed against this list in the same PR (stdlib-only vendored
# script — the doc can't be imported, so these literals are authoritative).
# entropy-mirror-state-marker-ok: this tuple is the SSOT (runtime authority); the markdown ref is a downstream human projection reviewed against it per-PR — runtime never reads the markdown, so there is no reverse-drift to invalidate.
PUBLIC_KEY_PREFIXES = (
    "NEXT_PUBLIC_",
    "REACT_APP_",
    "VITE_",
    "NUXT_PUBLIC_",
    "PUBLIC_",
)
BACKEND_KEY_ALLOWLIST = frozenset(
    {
        "IDP_ENDPOINT",
        "IDP_ISSUER",
        "IDP_URL",
        "ACCESS_TEAM_DOMAIN",
        "WORKER_NAME",
        "D1_NAME",
        "D1_ID",
        # Multi-D1 apps (e.g. tpb-crm: separate materialized-view + operational
        # D1 per Régime Separate-D1, database_conventions.md AP8). All public
        # infra identifiers (D1 name/uuid), never secrets.
        "D1_MV_NAME",
        "D1_MV_ID",
        "D1_OPERATIONAL_NAME",
        "D1_OPERATIONAL_ID",
        "R2_BUCKET",
        "PAM_JTI_KV_ID",
        "TPB_GOVERNANCE_KV_ID",
        "CF_ACCOUNT_ID",
        "ZONE_NAME",
        "ENVIRONMENT",
        "ENV",
        "database_name",
        # Public write-only ingest key (Sentry-DSN model, e.g. tpb-telemetry CLIENT_INGEST_KEY) — baked in the
        # desktop client manifest, confers no read/authz power. EXPLICIT allowlist (not a regex) because it ends
        # in _KEY (a secret suffix the nomenclature regex rejects by design) — only this documented public DSN key
        # is excepted; every other *_KEY stays rejected → vault.
        "CLIENT_INGEST_KEY",
    }
)
# Whitelist by nomenclature — KNOWN public wrangler [vars] categories. A secret
# (*_SECRET/_TOKEN/_KEY/_PASSWORD/_CREDENTIAL) matches NONE → rejected. Covers
# composite BFF composer URLs + route patterns + CF Access client id, and the R2
# S3-over-endpoint non-secret config (account id, bucket names, per-env binding flag)
# — R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY do NOT match (they are secrets → vault).
# _CONNECTION_ID (a bastion core_connection id, e.g. conn_googledrive_…) and _DRIVE_ID
# (a Google Drive folder id) are public IDENTIFIERS (like a D1 id) — the secret behind
# the connection lives in the vault, never here. Neither matches the secret suffixes.
# _ENABLED / _DISABLED = boolean FEATURE FLAGS / kill-switches (public Worker [vars], e.g.
# CRM_LIVE_DELIVERY_ENABLED) — a boolean toggle is never a secret (no secret ends in _ENABLED;
# the secret suffixes _SECRET/_TOKEN/_KEY/_PASSWORD/_CREDENTIAL are disjoint). Additive-safe.
# _PROVIDER_ID / _ACCOUNT_ID / _ZONE_ID / _SCOPE_ALIAS / _TUNNEL_DOMAIN / _NAME_PREFIX / _KEY_PREFIX =
# public INFRA IDENTIFIERS (e.g. tpb-genai-agents remote-control config: CF provider id, account/zone id,
# account-scope alias, tunnel domain, owned-resource name/key naming-prefix). All world-readable like a D1 id —
# a naming PREFIX string (`tpb-remote-control-`) is not a key; the secret suffixes _SECRET/_TOKEN/_KEY/_PASSWORD/
# _CREDENTIAL are disjoint (_KEY_PREFIX ends in _PREFIX, not _KEY). Additive-safe → kills the bespoke
# genai-agents wrangler generator (second path, § BIG BANG) by letting it use the canonical materialize.
# _INSTANCE_ID / _HOSTNAME / _KV_ID = public INFRA IDENTIFIERS (e.g. tpb-telemetry: Grafana stack instance id,
# ORIGIN_HOSTNAME dispatcher target, KV namespace uuid). All world-readable like a D1 id; none is a secret
# suffix. Additive-safe → lets tpb-telemetry drop its bespoke config for the canonical materialize.
_PUBLIC_CATEGORY_KEY = re.compile(
    r"^[A-Z0-9_]+_(URL|CLIENT_ID|ROUTE_PATTERN|CONNECTION_ID|DRIVE_ID|ENABLED|DISABLED"
    r"|PROVIDER_ID|ACCOUNT_ID|ZONE_ID|SCOPE_ALIAS|TUNNEL_DOMAIN|NAME_PREFIX|KEY_PREFIX"
    r"|INSTANCE_ID|HOSTNAME|KV_ID)$|^ROUTE_PATTERN(_[A-Z0-9_]+)?$"
    r"|^R2_(ACCOUNT_ID|BINDING|BUCKET(_[A-Z0-9_]+)?)$"
    # Any additional D1 of a multi-database Worker (tpb-calendar: D1_ADMIN_*) — a database name/uuid is a public
    # identifier like D1_NAME/D1_ID, never a secret.
    r"|^D1_[A-Z0-9]+(_[A-Z0-9]+)*_(NAME|ID)$"
)


def _backend_key_allowed(key: str) -> bool:
    return key in BACKEND_KEY_ALLOWLIST or bool(_PUBLIC_CATEGORY_KEY.match(key))

PUBLIC_HEADER = (
    "# ⚠️ PUBLIC — NO SECRETS. Every value here is world-readable (inlined into the browser\n"
    "# bundle / Worker [vars]). Secrets live ONLY in tpb-bastion (vault), never here. Every KEY\n"
    "# below MUST match the public whitelist (NEXT_PUBLIC_/REACT_APP_/VITE_ prefix, or an\n"
    "# allowlisted wrangler [vars] name). Need a secret? → tpb-bastion. Doctrine: CLAUDE.md § PUBLIC-ENV.\n"
    "# AUTO-GENERATED by scripts/materialize_public_env.py — DO NOT EDIT. Source: env/<target>.public.json.\n"
)

# `{{KEY}}` = required (fail-loud if absent from the manifest backend block).
# `{{KEY?}}` = optional (substituted to "" when absent — for per-env-optional vars
# such as a gateway's sibling-BC URLs that only exist in dev). The trailing `?` is
# captured as group(2).
_PLACEHOLDER_RE = re.compile(r"\{\{([A-Za-z0-9_]+)(\?)?\}\}")

# Per-env conditional blocks in wrangler.template.toml. A block is emitted ONLY when the
# manifest `backend.<KEY>` is truthy for the target env — lets an env-specific resource binding
# (e.g. an R2 [[r2_buckets]] block) appear on staging/production but be OMITTED on dev, without
# a separate template per env (§ NO CLOUDFLARE RESOURCE BINDING migration for template-based apps).
# The markers are TOML COMMENTS (`#{{IF ...}}` / `#{{ENDIF}}`) so the template stays valid TOML.
# v1: no nesting (fail-hard). Processed BEFORE placeholder substitution.
_IF_RE = re.compile(r"^#\{\{IF ([A-Za-z0-9_]+)\}\}$")
_ENDIF_RE = re.compile(r"^#\{\{ENDIF\}\}$")


def _truthy(value: object) -> bool:
    """Manifest values are strings; treat empty/false/0/no/off (any case) as falsy."""
    return str(value).strip().lower() not in ("", "false", "0", "no", "off")


class MaterializeError(RuntimeError):
    """Fail-hard error with a human-actionable message."""


def _apply_conditional_blocks(template_text: str, backend: dict, template_path: Path) -> str:
    """Strip `#{{IF KEY}}` / `#{{ENDIF}}` markers, keeping the enclosed lines only when
    `backend.KEY` is truthy. Fail-hard on unclosed / stray / nested markers."""
    out: "list[str]" = []
    if_stack: "list[str]" = []
    exclude = False
    for raw in template_text.splitlines(keepends=True):
        stripped = raw.strip()
        m_if = _IF_RE.match(stripped)
        if m_if:
            if if_stack:
                raise MaterializeError(f"{template_path}: nested #{{{{IF}}}} not supported (v1)")
            key = m_if.group(1)
            if_stack.append(key)
            exclude = not _truthy(backend.get(key, ""))
            continue
        if _ENDIF_RE.match(stripped):
            if not if_stack:
                raise MaterializeError(f"{template_path}: #{{{{ENDIF}}}} without matching #{{{{IF}}}}")
            if_stack.pop()
            exclude = False
            continue
        if exclude:
            continue
        out.append(raw)
    if if_stack:
        raise MaterializeError(f"{template_path}: unclosed #{{{{IF {if_stack[-1]}}}}}")
    return "".join(out)


def _fail(msg: str, code: int = 2) -> "None":
    print(f"ERROR: {msg}", file=sys.stderr)
    raise SystemExit(code)


def _env_local_public_overrides(frontend_dir: Path, public: dict, target: str) -> "list[str]":
    """Keys in `frontend/.env.local` OR `frontend/.env.<target>.local` that would
    leak DEV values into a staging/prod browser bundle.

    Next.js AND Vite env precedence: `.env.<mode>.local` > `.env.local` > `.env.<mode>`.
    So during a staging/production build the DEV values in EITHER `.env.local` OR
    `.env.<target>.local` silently win over the just-materialized `.env.<target>`.
    `.env.<target>.local` is the worst: HIGHEST precedence, gitignored (invisible in
    review) — the earlier guard checked only `.env.local` and missed it (BUG-18).

    TWO leak classes — both flagged :
      (a) a key that OVERRIDES a materialized public var (present in the manifest
          `public` block) → the manifest value is replaced by the dev value
          (§ IDP COHERENCE outage : dev IdP endpoint + client_id + bastion URL —
          BUG-18: this broke the Guyard prod login).
      (b) ANY client-bundle-prefixed key (`PUBLIC_KEY_PREFIXES`: NEXT_PUBLIC_* /
          VITE_* / REACT_APP_* / NUXT_PUBLIC_* / PUBLIC_*), EVEN IF NOT in the
          manifest → Next/Vite inline it into the browser bundle anyway, so a
          dev-only opt-in (e.g. a `NEXT_PUBLIC_*` pointing at a localhost bridge)
          ships to prod → the deployed hub hits the LOCAL bridge (Chrome Local
          Network Access prompt + wrong architecture).

    CI is safe (both files gitignored, absent on runners) — this only bites LOCAL
    prod builds (rare manual op). Returns the flagged keys (sorted) so the caller
    can fail loud.
    """
    public_keys = set(public.keys())
    flagged: "set[str]" = set()
    for env_file in (frontend_dir / ".env.local", frontend_dir / f".env.{target}.local"):
        if not env_file.is_file():
            continue
        try:
            for raw in env_file.read_text(encoding="utf-8").splitlines():
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key = line.split("=", 1)[0].strip()
                if key in public_keys or key.startswith(PUBLIC_KEY_PREFIXES):
                    flagged.add(key)
        except OSError:
            continue
    return sorted(flagged)


def _load_manifest(app_dir: Path, target: str) -> dict:
    manifest_path = app_dir / "env" / f"{target}.public.json"
    if not manifest_path.exists():
        _fail(
            f"manifest not found: {manifest_path}\n"
            f"  Every app must track env/{{dev,staging,production}}.public.json "
            f"(doctrine CLAUDE.md § PUBLIC-ENV).",
            code=2,
        )
    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:  # pragma: no cover - defensive
        _fail(f"manifest {manifest_path} is not valid JSON: {exc}", code=2)
    _validate_manifest(data, target, manifest_path)
    return data


def _validate_manifest(data: dict, target: str, manifest_path: Path) -> None:
    if not isinstance(data, dict):
        _fail(f"{manifest_path}: top-level must be a JSON object.")
    env = data.get("env")
    if env != target:
        _fail(
            f"{manifest_path}: field 'env' is {env!r} but file target is {target!r}. "
            f"They MUST match.",
        )
    if "public" not in data:
        _fail(f"{manifest_path}: required field 'public' is missing.")
    public = data.get("public") or {}
    backend = data.get("backend") or {}
    if not isinstance(public, dict) or not isinstance(backend, dict):
        _fail(f"{manifest_path}: 'public' and 'backend' must be objects.")

    # Whitelist enforcement (mirrors C6 — fail at generation too, defence-in-depth).
    for key in public:
        if not any(key.startswith(p) for p in PUBLIC_KEY_PREFIXES):
            _fail(
                f"{manifest_path}: public key {key!r} has no public framework prefix "
                f"({', '.join(PUBLIC_KEY_PREFIXES)}). Secret suspect → tpb-bastion.",
            )
    for key in backend:
        if not _backend_key_allowed(key):
            _fail(
                f"{manifest_path}: backend key {key!r} is not in the wrangler [vars] "
                f"allowlist. Secret suspect → tpb-bastion. "
                f"(Allowlist: {sorted(BACKEND_KEY_ALLOWLIST)})",
            )
    for key, value in {**public, **backend}.items():
        if not isinstance(value, str):
            _fail(f"{manifest_path}: value for {key!r} must be a string.")


def _render_frontend_env(public: dict) -> str:
    body = "\n".join(f"{name}={value}" for name, value in public.items())
    return PUBLIC_HEADER + "\n" + body + ("\n" if body else "")


def _atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(content)
        os.replace(tmp, path)
    except Exception:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def _substitute_wrangler(template_text: str, backend: dict, template_path: Path) -> str:
    # Per-env conditional blocks first (emit/omit whole binding blocks per manifest), then
    # substitute the {{KEY}} placeholders in the surviving lines.
    template_text = _apply_conditional_blocks(template_text, backend, template_path)

    def _sub(match: "re.Match[str]") -> str:
        key = match.group(1)
        optional = match.group(2) == "?"
        if key in backend:
            return str(backend[key])
        # Optional placeholder absent → substitute "" (var effectively unset; a
        # `[vars] X = ""` reads as falsy in the Worker, e.g. `if (env.X)` skips).
        if optional:
            return ""
        # Required + unknown: leave unchanged; the remaining-placeholder check below
        # (comments stripped) fails loud only on genuinely-uncovered placeholders in
        # non-comment lines. Comment placeholders are tolerated.
        return match.group(0)

    substituted = _PLACEHOLDER_RE.sub(_sub, template_text)
    # Fail-loud on any remaining REQUIRED placeholder (strip TOML comment lines
    # first). Optional `{{KEY?}}` always substitutes above, so any leftover is a
    # required one; findall returns (key, opt) tuples — filter to opt != "?".
    non_comment = "\n".join(
        line for line in substituted.splitlines() if not line.lstrip().startswith("#")
    )
    remaining = [key for key, opt in _PLACEHOLDER_RE.findall(non_comment) if opt != "?"]
    if remaining:
        raise MaterializeError(
            f"{template_path}: unsubstituted placeholders remain: {sorted(set(remaining))}"
        )
    return substituted


def _ensure_environment_var(wrangler_text: str, env_name: str) -> str:
    """Auto-inject `ENVIRONMENT = "<env>"` into the wrangler [vars] block if absent.

    The env-name is the ONE per-env signal the SDK anon telemetry reporter needs
    (`resolveTelemetryConfig(env.ENVIRONMENT)` → the SSOT URL+key matrix), so no
    app hardcodes TELEMETRY_URL/key per-manifest (§ CONSUME JAMAIS DUPLIQUER +
    DOCTRINE anon-telemetry-is-ssot). Derived from the manifest `env` field →
    zero per-app template edit. Idempotent : skips if a template already declares
    `ENVIRONMENT = ` (e.g. via a {{ENVIRONMENT}} placeholder)."""
    # Already present (own line, not a comment) → leave as-is.
    for line in wrangler_text.splitlines():
        stripped = line.strip()
        if stripped.startswith("ENVIRONMENT") and "=" in stripped and not stripped.startswith("#"):
            return wrangler_text
    inject = f'ENVIRONMENT = "{env_name}"'
    lines = wrangler_text.splitlines()
    for i, line in enumerate(lines):
        if line.strip() == "[vars]":
            lines.insert(i + 1, inject)
            return "\n".join(lines) + ("\n" if wrangler_text.endswith("\n") else "")
    # No [vars] section → append one.
    tail = "" if wrangler_text.endswith("\n") else "\n"
    return wrangler_text + f"{tail}\n[vars]\n{inject}\n"


def _ensure_workers_dev_false(wrangler_text: str, target: str) -> str:
    """Force top-level `workers_dev = false` on staging/production so the Worker is
    reachable ONLY by its custom domain (`<x>.theplaybutton.ai`, staging
    `<x>.staging.theplaybutton.ai`), NEVER by the raw account subdomain
    `<worker>.<account>.workers.dev`.

    This is the fleet-wide, at-source kill of the recurring ugly-prod-URL fléau
    (§ no_workers_dev_prod_url): the ugly URL keeps coming back because agents DERIVE
    it from `WORKER_NAME` + the account subdomain and it RESOLVES 200 (a confirmable
    artefact). Cutting `workers.dev` on staging/prod makes the derived URL 404 → the
    wrong answer becomes FALSE. One injection point → every app inherits, zero per-app
    template edit (mirror of `_ensure_environment_var`).

    DEV keeps its `*.theplaybutton.dev` subdomain (Matthieu's + the
    agents' working env — sacred, § feedback_dev_workers_sacred) → skip target 'dev'.
    Idempotent: no-op if the template already declares `workers_dev`. Injected as a
    ROOT-table key (right after `name = `) so it never binds to a `[table]` below."""
    if target not in ("staging", "production"):
        return wrangler_text
    for line in wrangler_text.splitlines():
        stripped = line.strip()
        if stripped.startswith("workers_dev") and "=" in stripped and not stripped.startswith("#"):
            return wrangler_text
    inject = "workers_dev = false"
    lines = wrangler_text.splitlines()
    for i, line in enumerate(lines):
        if line.strip().startswith("name ") or line.strip().startswith("name="):
            lines.insert(i + 1, inject)
            return "\n".join(lines) + ("\n" if wrangler_text.endswith("\n") else "")
    # No `name =` line (unexpected) → prepend at the very top (still a root-table key).
    return inject + "\n" + wrangler_text


def _ensure_workers_dev_true(wrangler_text: str, target: str) -> str:
    """Force top-level `workers_dev = true` on DEV so the Worker's `*.theplaybutton.dev` subdomain
    is SERVED (Matthieu's + the agents' working env — sacred, § feedback_dev_workers_sacred).

    SYMÉTRIQUE de `_ensure_workers_dev_false` — et le CHAÎNON MANQUANT (incident 2026-10-07, Alex) : le commit
    `32bf3fc` a supprimé les wrangler.toml concrets qui portaient `workers_dev = true` au profit du template partagé
    (qui ne le porte pas). Le materializer SKIPPAIT dev (le laissait non-déclaré) au lieu de l'INJECTER → au prochain
    `wrangler deploy` dev, le subdomain se COUPE → la connexion §4g dev pointe vers du 404 → ensureBankAccounting 500
    (bank-tx storage) ; tpb-martech/tpb-repository re-cassent. Le fix durable = injecter `workers_dev = true` DEV-ONLY
    en source (via ce materializer per-env), PAS un ajout global (staging/prod gardent `false` via la fonction sœur).

    Idempotent : no-op si le template déclare déjà `workers_dev`. Injecté comme clé ROOT (après `name = `)."""
    if target != "dev":
        return wrangler_text
    for line in wrangler_text.splitlines():
        stripped = line.strip()
        if stripped.startswith("workers_dev") and "=" in stripped and not stripped.startswith("#"):
            return wrangler_text
    inject = "workers_dev = true"
    lines = wrangler_text.splitlines()
    for i, line in enumerate(lines):
        if line.strip().startswith("name ") or line.strip().startswith("name="):
            lines.insert(i + 1, inject)
            return "\n".join(lines) + ("\n" if wrangler_text.endswith("\n") else "")
    return inject + "\n" + wrangler_text


def materialize(
    app_dir: Path,
    target: str,
    *,
    check_only: bool,
    frontend_only: bool = False,
    frontend_dir_name: str = "frontend",
    local_dev: bool = False,
) -> int:
    data = _load_manifest(app_dir, target)
    public = dict(data.get("public") or {})
    backend = data.get("backend") or {}
    # Inject the env-name signal (SDK-owned telemetry SSOT resolution) from the
    # manifest `env` field — frontend gets NEXT_PUBLIC_ENV, backend gets ENVIRONMENT
    # (below, post-substitution). Only if the app didn't set it explicitly.
    public.setdefault("NEXT_PUBLIC_ENV", target)

    # Where the Next/Vite build reads `.env.production`. Default `frontend/` (the
    # standard `<app>/frontend/` layout) ; `.` for a ROOT-level Next app whose
    # next.config + src/ live at the app root (a vitrine Worker serving its own
    # static export). `app_dir / "."` resolves to `app_dir` (idempotent).
    frontend_dir = app_dir / frontend_dir_name

    # Hermetic-build guard (§ PUBLIC-ENV — local prod-build .env.local pollution).
    # For a non-dev target, a `frontend/.env.local` OR `frontend/.env.<target>.local`
    # that (a) overrides any public var OR (b) declares ANY client-bundle-prefixed var
    # (NEXT_PUBLIC_*/VITE_*/REACT_APP_*/NUXT_PUBLIC_*/PUBLIC_*, even if not in the
    # manifest) would bake DEV values (dev IdP endpoint + client_id, or a localhost
    # bridge URL) into the staging/prod bundle — Next/Vite load `.env.<target>.local`
    # AND `.env.local` ABOVE `.env.<target>` and inline every prefixed var. The
    # mode-scoped `.env.<target>.local` has the HIGHEST precedence and is gitignored
    # (invisible in review) — that was BUG-18's silent hole. Fail loud so the operator
    # moves them aside before the build. No-op in CI (absent).
    # The guard gates on the FEED KIND, not the target (restored 2026-10-21 — e3d2bd62, lost when 3eddcb84 reset
    # this file to a reference that predated it): the `dev` target is ALSO deployed (the web dev-hub), so a dev
    # build that bakes a localhost URL ships a hub that calls the LOCAL bridge. Only a local `next dev` /
    # `wrangler dev` feed opts out with `--local-dev`, where localhost is correct.
    if not local_dev and frontend_dir.is_dir():
        _overrides = _env_local_public_overrides(frontend_dir, public, target)
        if _overrides:
            _fail(
                f"A local env override (.env.local or .env.{target}.local) in "
                f"{frontend_dir} would BAKE INTO the {target!r} build via vars "
                f"{_overrides} (they override a public manifest var OR carry a "
                f"client-bundle prefix). Next/Vite load .env.local AND "
                f".env.{target}.local ABOVE .env.{target} and inline every "
                f"NEXT_PUBLIC_*/VITE_*/REACT_APP_*/NUXT_PUBLIC_*/PUBLIC_* var, so "
                f"their DEV values ship to {target} (§ IDP COHERENCE outage — BUG-18: "
                f"this broke the Guyard prod login — + the deployed hub hitting the "
                f"LOCAL bridge). Move them aside before building: "
                f"`mv {frontend_dir}/.env*.local /tmp/` (restore after). If this feeds a "
                f"LOCAL dev server (localhost is correct), pass `--local-dev`. "
                f"Doctrine: CLAUDE.md § PUBLIC-ENV."
            )

    # Template location : app root (BI-style, root-relative paths) OR backend/
    # (composite BFF layout, backend-relative paths). The output wrangler-<target>.toml
    # is written next to its template so relative paths keep resolving.
    template_path = None
    candidates = [app_dir / "wrangler.template.toml", app_dir / "backend" / "wrangler.template.toml"]
    # Gateway layout (e.g. tpb-ticketing/backend/ticketing-gateway/): the wrangler
    # template lives one level under backend/. Append any such templates as fallbacks
    # (sorted → deterministic; a gateway app has exactly one). Agnostic — no app name
    # hardcoded; only apps with this structure use the 3rd path.
    candidates += sorted((app_dir / "backend").glob("*/wrangler.template.toml"))
    for cand in candidates:
        if cand.exists():
            template_path = cand
            break

    # --- frontend output ---
    if frontend_dir.is_dir():
        env_content = _render_frontend_env(public)
        if not check_only:
            _atomic_write(frontend_dir / ".env.production", env_content)
            print(
                f"[materialize] wrote {len(public)} public vars → "
                f"{(frontend_dir / '.env.production')}"
            )

    # --- backend/wrangler output ---
    # `--frontend-only` skips wrangler generation. Legit for apps whose DEV worker
    # is a separate concrete wrangler.toml (workers.dev, no custom routes) while the
    # template is staging/prod-only (custom routes/zone) — a placeholder template
    # cannot conditionally omit the [[routes]] block for dev. Doctrine § PUBLIC-ENV.
    if frontend_only:
        if check_only:
            print(f"[materialize] --check (frontend-only) OK for target {target!r} in {app_dir}")
        return 0

    if template_path is not None:
        template_text = template_path.read_text(encoding="utf-8")
        try:
            substituted = _substitute_wrangler(template_text, backend, template_path)
        except MaterializeError as exc:
            _fail(str(exc))
        # Auto-inject the ENVIRONMENT env-name signal (SDK telemetry SSOT resolution).
        substituted = _ensure_environment_var(substituted, target)
        # Force workers_dev=false on staging/prod → reachable only via custom domain,
        # never the ugly `*.<account>.workers.dev` (§ no_workers_dev_prod_url). Dev keeps it.
        substituted = _ensure_workers_dev_false(substituted, target)
        substituted = _ensure_workers_dev_true(substituted, target)   # dev-only (symétrique) — subdomain dev sacré (§ 32bf3fc fix 2026-10-07)
        if not check_only:
            out_path = template_path.parent / f"wrangler-{target}.toml"
            out_path.write_text(substituted, encoding="utf-8")
            print(f"[materialize] wrote {out_path}")

    if check_only:
        print(f"[materialize] --check OK for target {target!r} in {app_dir}")
    return 0


def main(argv: "list[str] | None" = None) -> int:
    parser = argparse.ArgumentParser(
        description="Materialize public per-env config from a tracked manifest."
    )
    parser.add_argument("target", choices=VALID_TARGETS)
    parser.add_argument(
        "--app-dir",
        default=".",
        help="Path to the app root containing env/<target>.public.json (default: cwd).",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Validate only (manifest + schema + placeholders); write nothing.",
    )
    parser.add_argument(
        "--frontend-only",
        action="store_true",
        help="Only write frontend/.env.production; skip wrangler generation (dev "
        "worker is a separate concrete wrangler.toml).",
    )
    parser.add_argument(
        "--frontend-dir",
        default="frontend",
        help="Subdir (relative to --app-dir) where the Next/Vite build reads "
        ".env.production. Default 'frontend'. Use '.' for a ROOT-level Next app "
        "(next.config + src/ at the app root, no frontend/ subdir — e.g. a vitrine "
        "Worker that serves its own static export).",
    )
    parser.add_argument(
        "--local-dev",
        action="store_true",
        help="This materialize feeds a LOCAL dev server (`next dev` / `wrangler dev`), not a deploy build, so a "
        "frontend/.env.local with localhost overrides is correct — skip the hermetic `.env.local` guard. NEVER pass "
        "it from a prebuild/deploy hook (§ PUBLIC-ENV, § ALWAYS FAIL HARD).",
    )
    args = parser.parse_args(argv)
    app_dir = Path(args.app_dir).resolve()
    return materialize(
        app_dir,
        args.target,
        check_only=args.check,
        frontend_only=args.frontend_only,
        frontend_dir_name=args.frontend_dir,
        local_dev=args.local_dev,
    )


if __name__ == "__main__":
    raise SystemExit(main())
