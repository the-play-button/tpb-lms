#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# CANONICAL FLEET DEPLOY (§ BIG BANG — UN SEUL chemin, vendoré byte-identique par app).
#
# SSOT : tpb-devops-cd/scripts/deploy.sh  →  vendoré dans chaque <app>/scripts/deploy.sh
# (jumeau de materialize_public_env.py). Gate `vendored_deploy_matches_ssot` (P0, no ACK)
# verrouille chaque copie byte-identique. Pour changer le deploy fleet : éditer CE SSOT,
# `python3 revendor_deploy.py`, rebuild tpb-entropy. UN point d'édition → zéro drift.
#
# Généralise le seed tpb-ticketing (target explicite, materialize template, gate coherence,
# migrate, deploy) + presence-detection (chaque app skippe proprement ce qui ne s'applique pas)
# + PROVENANCE-STAMP `--var COMMIT_SHA` (axe 51 : bundle==source vérifiable) + pre-deploy hook.
#
# Usage: bash scripts/deploy.sh dev
#   staging/production = release-train UNIQUEMENT (§ CI/CD 3-ENV) → bloqués ici.
#   Target EXPLICITE obligatoire — jamais de dev silencieux (§ ALWAYS FAIL HARD, § IDP COHERENCE :
#   un deploy.sh hardcodé-dev = foot-gun dev/prod).
# ─────────────────────────────────────────────────────────────────────────────

if [[ $# -lt 1 || ! "${1:-}" =~ ^(dev|staging|production)$ ]]; then
  echo "usage: bash scripts/deploy.sh {dev|staging|production}" >&2
  exit 2
fi
TARGET="$1"

# § CI/CD 3-ENV — staging/production via release-train uniquement (jamais deploy direct).
if [[ "$TARGET" != "dev" ]]; then
  echo "✗ deploy.sh ${TARGET} direct INTERDIT (§ CI/CD 3-ENV). staging: git push origin main:staging → deploy-staging.yml ; production: release-train." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$APP_DIR"
APP="$(basename "$APP_DIR")"
echo "=== ${APP} deploy — TARGET=${TARGET} (canonical) ==="

# ── Résolution du wrangler config (racine ou backend/ subdir) ─────────────────
if [[ -f "wrangler-${TARGET}.toml" ]]; then
  WF="wrangler-${TARGET}.toml"
elif [[ -f "backend/wrangler-${TARGET}.toml" ]]; then
  WF="backend/wrangler-${TARGET}.toml"
else
  echo "✗ ni wrangler-${TARGET}.toml ni backend/wrangler-${TARGET}.toml (materialize d'abord ?)" >&2
  WF=""   # peut être matérialisé ci-dessous à partir du template
fi

# ── Presence-detection (chaque app ne fait QUE ce qui s'applique) ─────────────
has_script() { python3 -c "import json,sys; sys.exit(0 if '$1' in (json.load(open('package.json')).get('scripts') or {}) else 1)" 2>/dev/null; }
HAS_MANIFEST=0; [[ -f "env/${TARGET}.public.json" ]] && HAS_MANIFEST=1
HAS_MATERIALIZE=0; [[ -f "scripts/materialize_public_env.py" && "$HAS_MANIFEST" == "1" ]] && HAS_MATERIALIZE=1
# Le script `build:frontend` EST le signal canonique UNIQUE (§ BIG BANG : un seul chemin, zéro devinette). Une app
# qui build un frontend au deploy DOIT avoir ce script ; une app backend-only (ex. receiving : frontend/ présent mais
# jamais buildé au deploy) ne l'a pas → on SKIP (pas de fallback `cd frontend && build` = 2ᵉ chemin qui devine, interdit).
HAS_FRONTEND=0; has_script "build:frontend" && HAS_FRONTEND=1
HAS_COHERENCE=0; [[ -f "scripts/verify_build_env_coherence.py" && "$HAS_MANIFEST" == "1" ]] && HAS_COHERENCE=1
MIG_DIR=""; for d in "db/migrations" "backend/db/migrations"; do [[ -d "$d" ]] && MIG_DIR="$d"; done

STEP=0; n() { STEP=$((STEP+1)); echo "[$STEP] $1"; }

# ── Pre-deploy hook app-spécifique (slider pitches, showcase next, …) — no-op si absent ──
if [[ -f "scripts/pre-deploy.sh" ]]; then
  n "pre-deploy hook (app-specific)…"; bash scripts/pre-deploy.sh "${TARGET}"
fi

# ── 1. contracts (si l'app a un package de contrats) ──────────────────────────
if has_script "contracts:build"; then n "contracts:build…"; pnpm run contracts:build; fi

# ── 2. typecheck (toujours) ───────────────────────────────────────────────────
n "typecheck…"; pnpm run typecheck

# ── 3. materialize public-env → wrangler-<target>.toml (+ frontend/.env) ──────
if [[ "$HAS_MATERIALIZE" == "1" ]]; then
  n "materialize ${TARGET} (wrangler config + public-env)…"
  python3 scripts/materialize_public_env.py --app-dir . "${TARGET}"
  # (re-résout WF si le template vient de le produire)
  [[ -z "$WF" && -f "wrangler-${TARGET}.toml" ]] && WF="wrangler-${TARGET}.toml"
  [[ -z "$WF" && -f "backend/wrangler-${TARGET}.toml" ]] && WF="backend/wrangler-${TARGET}.toml"
fi
[[ -n "$WF" ]] || { echo "✗ wrangler config introuvable après materialize" >&2; exit 1; }

# ── 4. frontend build ─────────────────────────────────────────────────────────
if [[ "$HAS_FRONTEND" == "1" ]]; then
  n "build frontend (build:frontend)…"; pnpm run build:frontend
fi

# ── 5. build-env coherence gate (§ IDP COHERENCE, bundle du bon env) ──────────
if [[ "$HAS_COHERENCE" == "1" ]]; then
  n "verify build-env coherence (${TARGET})…"; python3 scripts/verify_build_env_coherence.py "${TARGET}" --app-dir .
fi

# ── 6. D1 migrations + parité déployée (si l'app a des migrations) ────────────
# Détection d1 : dir hardcodé (db/migrations | backend/db/migrations) OU `migrations_dir` déclaré dans le WF toml
# (gère les configs nested, ex. ticketing backend/wrangler-dev.toml → migrations_dir="ticketing-gateway/db/migrations").
# wrangler résout le chemin réel depuis le toml ; cette détection ne décide QUE si on applique les migrations.
HAS_D1="$MIG_DIR"
[[ -z "$HAS_D1" && -n "$WF" ]] && grep -qE '^[[:space:]]*migrations_dir[[:space:]]*=' "$WF" 2>/dev/null && HAS_D1="toml"
if [[ -n "$HAS_D1" ]]; then
  # D1_NAME depuis le manifest (backend.D1_NAME) si présent, sinon depuis le wrangler toml
  D1_NAME=""
  if [[ "$HAS_MANIFEST" == "1" ]]; then
    D1_NAME="$(python3 -c "import json;print((json.load(open('env/${TARGET}.public.json')).get('backend') or {}).get('D1_NAME',''))" 2>/dev/null || true)"
  fi
  if [[ -z "$D1_NAME" ]]; then
    D1_NAME="$(python3 -c "import re;print((re.search(r'database_name\s*=\s*\"([^\"]+)\"', open('$WF').read()) or [None,''])[1])" 2>/dev/null || true)"
  fi
  if [[ -n "$D1_NAME" ]]; then
    n "D1 migrations apply ${D1_NAME}…"; pnpm exec wrangler d1 migrations apply "$D1_NAME" --remote -c "$WF"
    n "D1 deployed-parity assert (${TARGET})…"
    PYTHONPATH="${TPB_SDK_PYTHONPATH:-../tpb-sdk/python/src}" python3 -m tpb_sdk.d1_parity assert-deployed --wrangler "$WF" --target "${TARGET}"
  fi
fi

# ── 7. DEPLOY + PROVENANCE-STAMP (axe 51 : bundle==source vérifiable) ─────────
COMMIT_SHA="$(git rev-parse HEAD 2>/dev/null || echo nogit)"
n "deploy Worker (-c ${WF}) + provenance COMMIT_SHA=${COMMIT_SHA:0:12}…"
pnpm exec wrangler deploy -c "$WF" --var "COMMIT_SHA:${COMMIT_SHA}"

# ── 8. POST-DEPLOY EDGE-FRESHNESS GUARD (§ nivelé vers le haut — la rigueur du MEILLEUR CITOYEN lrm, pour TOUS) ──
# Vérifie que l'edge sert le bundle FRAÎCHEMENT buildé (tpb-build-id local == edge), re-deploy si stale (Cause C,
# § _bugs 2026-07-28 silent asset-skip), fail-loud. Présence-détecté : SKIP propre si pas de frontend Next avec
# marqueur tpb-build-id (backend-only, ou Next-sans-marqueur en attente du preset SDK universel Phase 2).
if [[ -f "scripts/verify_deploy_freshness.py" ]]; then
  n "post-deploy edge-freshness guard (${TARGET})…"
  python3 scripts/verify_deploy_freshness.py "${TARGET}" --wrangler "$WF" --app-dir .
fi

echo "=== Deploy complete (${APP} ${TARGET}) ==="
