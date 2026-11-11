#!/usr/bin/env bash
# Install received client distributions, retain the canonical guard, and isolate this CI job's scanner runtime.
set -euo pipefail
test "$#" -eq 2 || { echo 'Expected exact SDK and CLI distribution pins' >&2; exit 2; }
for requirement in "$@"; do
  [[ "$requirement" =~ ^tpb-(sdk|cli)==[0-9]+\.[0-9]+\.[0-9]+$ ]] || exit 2
done
runtime="${RUNNER_TEMP:?}/tpb-canonical-deployment-${GITHUB_RUN_ID:?}-${GITHUB_RUN_ATTEMPT:-1}"
mkdir "$runtime"
printf 'TPB_CANONICAL_DEPLOYMENT_RUNTIME=%s\n' "$runtime" >> "${GITHUB_ENV:?}"
python3 -m venv "$runtime/python"
bash scripts/install_from_org_pypi.sh "$runtime/python/bin/python" "$@"
entropy="${GITHUB_WORKSPACE:?}/Apps/the-play-button/tpb-entropy"
"$runtime/python/bin/python" -m pip install --quiet "$entropy/python"
mkdir "$runtime/bin"
ln -s "${GITHUB_WORKSPACE:?}/Apps/the-play-button/tpb-agentic-framework/scripts/infrastructure/wrangler_guard.sh" "$runtime/bin/wrangler"
printf '%s\n%s\n' "$runtime/python/bin" "$runtime/bin" >> "${GITHUB_PATH:?}"
TPB_ENTROPY_RUNTIME_RESOURCES="$(node --experimental-strip-types --input-type=module - "$entropy" "$runtime/python/bin/tpb-entropy" <<'JS'
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const [source, executablePath] = process.argv.slice(2);
const { resolveEntropyRuntimeResources, describeEntropyRuntimeResources } = await import(
  pathToFileURL(resolve(source, 'backend/entry-ts/_runtimeResources.ts')).href);
const resources = resolveEntropyRuntimeResources({ environment: process.env, executablePath,
  sourceFallbackRoot: resolve(source, 'python') });
process.stdout.write(JSON.stringify(describeEntropyRuntimeResources(resources)));
JS
)"
printf 'TPB_ENTROPY_RUNTIME_RESOURCES=%s\n' "$TPB_ENTROPY_RUNTIME_RESOURCES" >> "$GITHUB_ENV"
for name in TPB_ENTROPY_NO_DAEMON TPB_ENTROPY_ENGINE_INTERNAL TPB_ENTROPY_NATIVE_ONLY TPB_ENTROPY_SINGLE_REPO_CI; do
  printf '%s=1\n' "$name" >> "$GITHUB_ENV"
done
