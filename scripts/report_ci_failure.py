#!/usr/bin/env python3
"""Send the cause of a failed CI/deploy job to telemetry (the blessed path for errors).

Why (2026-10-28): Forgejo 10.0.3 does not serve job log text through its API and its web route needs an interactive
browser session (see fetch_forgejo_ci_log.py). Two production deploys of tpb-telemetry failed and their cause could
only be guessed. Every generated workflow step now starts with a `::tpb-step::<name>` marker and copies its output to
`$RUNNER_TEMP/tpb-ci-steps.log`, then writes `::tpb-step-ok::` as its last line. On failure, the job's last step runs
this script: it finds the step that failed (the last started step without its ok marker), keeps its last lines,
redacts secret values and sends one ERROR event to the public ingest sink (project `tpb-ci-client`).

Redaction: every value of the env variables named in `TPB_CI_REDACT_VARS` (comma-separated), then token patterns.
Exit code is always 0: the job already fails at its own step; a send failure is written to stderr.
Stdlib only — the runner checks out the app alone, this file is vendored byte-identical from tpb-devops.
"""
from __future__ import annotations

import argparse
import http.client
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

SINK_URL = "https://telemetry.theplaybutton.ai/api/telemetry/ingest/client-reports"
# Public write-only ingest key of the production telemetry (DSN model, tpb-telemetry/env/production.public.json).
INGEST_KEY = "tpbcogs-client-production-a64cb44518546d17f466eca6"
INSTALL_ID = "worker:tpb-ci"
STEP_MARKER = "::tpb-step::"
STEP_OK_MARKER = "::tpb-step-ok::"
MAX_LINES = 80
MAX_LINE_CHARS = 300
_PATTERNS = (
    re.compile(r"bastion_[A-Za-z0-9_-]{16,}"),
    re.compile(r"(?i)(bearer\s+)\S+"),
    re.compile(r"(?i)(token[=: ]\s*)\S{12,}"),
)


def failed_step(log_text: str) -> "tuple[str, bool, list[str]]":
    """(step name, failed inside that step?, its output lines). The last started step without its ok marker failed;
    when the last started step ended ok, the failure came from a later non-`run` step (an action)."""
    name, lines, ended_ok = "unknown (no step marker in the log)", [], False
    for line in log_text.splitlines():
        if line.startswith(STEP_MARKER):
            name, lines, ended_ok = line[len(STEP_MARKER):].strip() or "unnamed step", [], False
        elif line.startswith(STEP_OK_MARKER):
            ended_ok = True
        else:
            lines.append(line)
    return name, not ended_ok, lines


def redact(text: str, env: "dict[str, str]") -> str:
    names = [n.strip() for n in env.get("TPB_CI_REDACT_VARS", "").split(",") if n.strip()]
    for value in sorted({env.get(n, "") for n in names}, key=len, reverse=True):
        if len(value) >= 4:
            text = text.replace(value, "***")
    for pattern in _PATTERNS:
        text = pattern.sub(lambda m: (m.group(1) if m.groups() else "") + "***", text)
    return text


def build_report(args: argparse.Namespace, log_text: str, env: "dict[str, str]") -> dict:
    step, inside, lines = failed_step(log_text)
    kept = [redact(line[:MAX_LINE_CHARS], env) for line in lines[-MAX_LINES:]]
    where = step if inside else f"after {step} (a non-run step)"
    return {
        "ingest_key": INGEST_KEY,
        "install_id": INSTALL_ID,
        "environment_name": args.environment[:64],
        "app_version": args.ref[:64],
        "platform": "forgejo-actions",
        "events": [{
            "message": f"CI failure {args.repo} {args.workflow}: {where}",
            "level": "ERROR",
            "group_key": f"ci:{args.repo}:{args.workflow}:{step}"[:200],
            "tags": {"repo": args.repo, "workflow": args.workflow, "ref": args.ref, "run_number": args.run,
                     "step": step, "failed_inside_step": str(inside).lower()},
            "context": {"lines": kept},
        }],
    }


def send(report: dict, url: str = SINK_URL) -> int:
    parts = urlsplit(url)
    conn = http.client.HTTPSConnection(parts.netloc, timeout=15)
    try:
        conn.request("POST", parts.path, body=json.dumps(report), headers={
            "Content-Type": "application/json", "User-Agent": "tpb-ci-failure-reporter/1"})
        response = conn.getresponse()
        response.read()
        return response.status
    finally:
        conn.close()


def main(argv: "list[str] | None" = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--repo", required=True, help="owner/repo of the failed job")
    parser.add_argument("--workflow", required=True, help="workflow name")
    parser.add_argument("--ref", required=True, help="git ref of the run (tag or branch)")
    parser.add_argument("--run", required=True, help="run number")
    parser.add_argument("--environment", default="ci", help="dev / staging / production, or ci")
    parser.add_argument("--log", default=None, help="Default: $RUNNER_TEMP/tpb-ci-steps.log")
    args = parser.parse_args(argv)
    log = Path(args.log or Path(os.environ.get("RUNNER_TEMP") or "/tmp") / "tpb-ci-steps.log")
    log_text = log.read_text(encoding="utf-8", errors="replace") if log.is_file() else ""
    report = build_report(args, log_text, dict(os.environ))
    try:
        status = send(report)
    except OSError as exc:
        print(f"[report_ci_failure] send failed: {type(exc).__name__}", file=sys.stderr)
        return 0
    event = report["events"][0]
    print(f"[report_ci_failure] {event['message']} → telemetry HTTP {status}")
    if status >= 300:
        print(f"[report_ci_failure] the sink refused the report (HTTP {status})", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
