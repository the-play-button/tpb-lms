#!/usr/bin/env bash
# check_shutdown_window.sh — Exit 0 si on est DANS la fenêtre de maintenance
# (= deploy prod autorisé). Exit 1 si hors fenêtre (= deploy prod bloqué).
#
# Configuration via env vars (Forgejo Actions repository variables) :
#   SHUTDOWN_WINDOW_DAY_OF_WEEK  : 1-7 (1=Mon, 7=Sun, ISO 8601). Default 7 (Sun).
#   SHUTDOWN_WINDOW_UTC_START    : HH (0-23). Default 07.
#   SHUTDOWN_WINDOW_UTC_END      : HH (0-23). Default 09.
#
# Override : commit message containing `--hotfix : <reason>` bypass this check
# entirely (cf. deploy-prod.yml).
#
# Exit codes :
#   0  inside window — deploy allowed
#   1  outside window — deploy blocked
#   2  bad config (invalid day/hour)

set -uo pipefail

DAY_OF_WEEK="${SHUTDOWN_WINDOW_DAY_OF_WEEK:-7}"
UTC_START="${SHUTDOWN_WINDOW_UTC_START:-07}"
UTC_END="${SHUTDOWN_WINDOW_UTC_END:-09}"

# Validation
if ! [[ "$DAY_OF_WEEK" =~ ^[1-7]$ ]]; then
  echo "ERROR: SHUTDOWN_WINDOW_DAY_OF_WEEK='$DAY_OF_WEEK' invalid (expected 1-7)" >&2
  exit 2
fi
if ! [[ "$UTC_START" =~ ^[0-2]?[0-9]$ ]] || [[ "$UTC_START" -gt 23 ]]; then
  echo "ERROR: SHUTDOWN_WINDOW_UTC_START='$UTC_START' invalid (expected 0-23)" >&2
  exit 2
fi
if ! [[ "$UTC_END" =~ ^[0-2]?[0-9]$ ]] || [[ "$UTC_END" -gt 23 ]]; then
  echo "ERROR: SHUTDOWN_WINDOW_UTC_END='$UTC_END' invalid (expected 0-23)" >&2
  exit 2
fi
if [[ "$UTC_START" -ge "$UTC_END" ]]; then
  echo "ERROR: SHUTDOWN_WINDOW_UTC_START ($UTC_START) >= UTC_END ($UTC_END)" >&2
  exit 2
fi

CURRENT_DOW=$(date -u +%u)   # 1-7 ISO 8601
CURRENT_HOUR=$(date -u +%H)
CURRENT_HOUR_NUM=$(printf '%d' "$((10#$CURRENT_HOUR))")
START_NUM=$(printf '%d' "$((10#$UTC_START))")
END_NUM=$(printf '%d' "$((10#$UTC_END))")

echo "[shutdown_window] now: DoW=$CURRENT_DOW hour=$CURRENT_HOUR UTC"
echo "[shutdown_window] window: DoW=$DAY_OF_WEEK hours=$UTC_START-$UTC_END UTC"

if [[ "$CURRENT_DOW" != "$DAY_OF_WEEK" ]]; then
  echo ""
  echo "✗ Outside shutdown window — current day-of-week is $CURRENT_DOW, window is on day $DAY_OF_WEEK"
  echo "  Next eligible deploy : day $DAY_OF_WEEK between $UTC_START:00 and $UTC_END:00 UTC"
  echo "  Override : add '--hotfix : <reason>' to the commit message bearing the go-live tag"
  exit 1
fi

if [[ "$CURRENT_HOUR_NUM" -lt "$START_NUM" || "$CURRENT_HOUR_NUM" -ge "$END_NUM" ]]; then
  echo ""
  echo "✗ Inside shutdown day ($CURRENT_DOW) but outside hour window ($CURRENT_HOUR_NUM vs $START_NUM-$END_NUM)"
  echo "  Override : add '--hotfix : <reason>' to the commit message bearing the go-live tag"
  exit 1
fi

echo "✓ Inside shutdown window — deploy allowed"
exit 0
