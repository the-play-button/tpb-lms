#!/usr/bin/env node
// judge_eslint_per_configuration.mjs [--write-baseline]
// Every tracked folder that carries an eslint configuration is judged by that configuration, against its own committed
// count in `.eslint-last-status.json` ({ "<folder>": <errors> }, '.' for the root; a folder without a count is judged at 0).
// Why: a flat configuration applies only to the eslint run started in its folder. The CI linted the root alone, so 15
// frontends of 24 were never judged, and one could not even start (tpb-devops plan 07.1.2.1.1.1, 2026-11-08).
// Each file is judged once, by its nearest configuration: a configured folder is ignored by its parent's run.
// The same code measures the committed counts (`--write-baseline`) and judges them in CI: no second reading of eslint.
// Report: $RUNNER_TEMP/eslint-per-configuration.json, one row per folder.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';

const BASELINE = '.eslint-last-status.json';
// Copies kept as evidence or builds inside plans are not application code (tpb-fleet's _build qualifications, tpb-plans'
// .originals, 2026-11-08): never judged, never counted.
const IGNORED = /(^|\/)(node_modules|plans|_build|_evidence|\.originals)\//;
const CONFIGURATION = /(^|\/)eslint\.config\.(js|mjs|cjs|ts|mts|cts)$/;

const temporary = process.env.RUNNER_TEMP;
if (!temporary) throw new Error('RUNNER_TEMP is not set: the runner sets it, a measurement passes its own folder');
const writeBaseline = process.argv.includes('--write-baseline');

const listed = spawnSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
if (listed.status !== 0) throw new Error(`git ls-files failed: ${listed.stderr}`);
const tracked = listed.stdout.split('\0').filter((path) => path && !IGNORED.test(path));
const folders = [...new Set(tracked.filter((path) => CONFIGURATION.test(path)).map((path) => posix.dirname(path)))].sort();
if (!folders.length) {
  console.log('no eslint configuration in this repository');
  process.exit(0);
}

// A package outside the root workspace has its own installation: without it, typed rules read its imports as `any`
// (tpb-genai-agents' contracts, 2026-11-05). Frozen: what is judged is what the lockfile pins. Resolved again, the open
// security overrides (`"brace-expansion@2": ">=2.0.2"`) gave minimatch 3 a brace-expansion of another major, and eslint
// could not start (tpb-scim and tpb-it-ops frontends, « expand is not a function », 2026-11-08).
// Each nested lockfile is installed by its own package manager (tpb-megarag's frontend is npm's, tpb-speech-intelligence's
// desktop bun's: its root configuration imports the desktop's, whose plugin only bun installs).
/** @type {Map<string, [string, ...string[]]>} */
const INSTALL = new Map([
  ['pnpm-lock.yaml', ['pnpm', 'install', '--frozen-lockfile', '--ignore-scripts']],
  ['package-lock.json', ['npm', 'ci', '--ignore-scripts']],
  ['bun.lock', ['bun', 'install', '--frozen-lockfile', '--ignore-scripts']],
]);
for (const lockfile of tracked) {
  const install = INSTALL.get(posix.basename(lockfile));
  if (posix.dirname(lockfile) === '.' || install === undefined) continue;
  const where = posix.dirname(lockfile);
  // A lockfile without its package.json installs nothing: said aloud, never installed (tpb-fleet tracks
  // bridge-daemons/baileys/package-lock.json alone, and npm ci stopped the judge, 2026-11-08).
  if (!tracked.includes(posix.join(where, 'package.json'))) {
    console.log(`install: ${where} skipped — ${posix.basename(lockfile)} without a package.json beside it`);
    continue;
  }
  const [command, ...arguments_] = install;
  console.log(`install: ${where} (${command})`);
  const installed = spawnSync(command, arguments_, { cwd: where, stdio: 'inherit' });
  if (installed.status !== 0) throw new Error(`${command} install failed in ${where} (exit ${String(installed.status)})`);
}

/** @param {string} child @param {string} parent */
const inside = (child, parent) => parent === '.' ? child !== '.' : child.startsWith(`${parent}/`);
// The eslint installed nearest to the folder, up to the root, run from the folder itself. `pnpm exec` moved to its package's
// directory, and a configured folder without a package.json of its own met no configuration there (tpb-repository/backend,
// « ESLint couldn't find an eslint.config », 2026-11-08). One path for a pnpm and an npm installation alike.
/** @param {string} folder @returns {string | null} */
const eslintBinary = (folder) => {
  for (let where = folder; ; where = posix.dirname(where)) {
    const binary = join(where, 'node_modules', '.bin', 'eslint');
    if (existsSync(binary)) return resolve(binary);
    if (where === '.') return null;
  }
};

// Everything read from disk arrives `unknown` and is shaped by a guard: shipped in every repository's scripts/, this file is
// linted there by typed rules (wge-tpb-bridge, 23 no-unsafe-* on JSON.parse's `any`, 2026-11-08).
/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/** @typedef {{ filePath: string, errorCount: number, messages: { severity: number, line: number, column: number, text: string, rule: string }[] }} Result */
/** @param {string} path @returns {Result[]} */
const readReport = (path) => {
  const parsed = /** @type {unknown} */ (JSON.parse(readFileSync(path, 'utf8')));
  if (!Array.isArray(parsed)) throw new Error(`${path} is not an eslint JSON report`);
  return /** @type {unknown[]} */ (parsed).map((result, index) => {
    if (!isRecord(result) || typeof result.filePath !== 'string' || typeof result.errorCount !== 'number'
      || !Array.isArray(result.messages)) throw new Error(`${path}: result ${String(index)} is not an eslint result`);
    const messages = /** @type {unknown[]} */ (result.messages).filter(isRecord).map((message) => ({
      severity: typeof message.severity === 'number' ? message.severity : 0,
      line: typeof message.line === 'number' ? message.line : 0,
      column: typeof message.column === 'number' ? message.column : 0,
      text: typeof message.message === 'string' ? message.message : '',
      rule: typeof message.ruleId === 'string' ? message.ruleId : '',
    }));
    return { filePath: result.filePath, errorCount: result.errorCount, messages };
  });
};

/** @typedef {{ folder: string, state: string, exit?: number | null, detail?: string, errors?: number, files?: number, results?: Result[] }} Row */
/** @type {Row[]} */
const rows = [];
for (const folder of folders) {
  const nested = folders.filter((other) => inside(other, folder)).map((other) => posix.relative(folder, other));
  const output = join(temporary, `eslint-${folder.replaceAll('/', '__')}.json`);
  const binary = eslintBinary(folder);
  if (binary === null) {
    rows.push({ folder, state: 'eslint is not installed', exit: null, detail: `no node_modules/.bin/eslint from ${folder} up to the root` });
    continue;
  }
  const run = spawnSync(binary, ['.', '--format', 'json', '--output-file', output,
    ...nested.flatMap((relative) => ['--ignore-pattern', `${relative}/**`])], { cwd: folder, encoding: 'utf8' });
  // 0 = clean, 1 = errors found; anything else, or no report, is no verdict, never a green one.
  if (run.status > 1 || run.status === null || !existsSync(output)) {
    rows.push({ folder, state: 'eslint did not complete', exit: run.status,
      detail: `${run.stdout}${run.stderr}`.trim().slice(0, 1500) });
    continue;
  }
  const results = readReport(output);
  if (!results.length) {
    rows.push({ folder, state: 'eslint judged no file', exit: run.status });
    continue;
  }
  rows.push({ folder, state: 'measured', errors: results.reduce((sum, result) => sum + result.errorCount, 0),
    files: results.length, results });
}
// The report keeps the counts, not every message.
writeFileSync(join(temporary, 'eslint-per-configuration.json'),
  `${JSON.stringify(rows.map((row) => ({ ...row, results: undefined })), null, 2)}\n`);

const failed = rows.filter((row) => row.state !== 'measured');
for (const row of failed) console.log(`eslint: ${row.folder} ${row.state} (exit ${String(row.exit)})\n${row.detail ?? ''}`);

if (writeBaseline) {
  if (failed.length) process.exit(2);
  const counts = Object.fromEntries(rows.map((row) => [row.folder, row.errors]));
  writeFileSync(BASELINE, `${JSON.stringify(counts, null, 2)}\n`);
  for (const row of rows) console.log(`baseline: ${row.folder} ${String(row.errors)} errors, ${String(row.files)} files`);
  process.exit(0);
}

const committed = existsSync(BASELINE) ? /** @type {unknown} */ (JSON.parse(readFileSync(BASELINE, 'utf8'))) : {};
if (!isRecord(committed)) throw new Error(`${BASELINE} is not a { "<folder>": <errors> } table`);
const baseline = new Map(Object.entries(committed));
// A count for a folder that carries no configuration judges nothing: the table is exact, or it is refused.
const unknown = [...baseline].filter(([folder, count]) => !folders.includes(folder) || !Number.isInteger(count));
for (const [folder, count] of unknown) console.log(`baseline: ${folder} = ${JSON.stringify(count)} names no configured folder, or is no count`);

let regressed = false;
for (const row of rows.filter((candidate) => candidate.state === 'measured')) {
  const count = baseline.get(row.folder);
  const allowed = typeof count === 'number' ? count : 0;
  const errors = row.errors ?? 0;
  console.log(`eslint: ${row.folder} ${String(errors)} errors, ${String(row.files)} files, baseline ${String(allowed)}`);
  if (errors <= allowed) continue;
  regressed = true;
  let shown = 0;
  for (const result of row.results ?? []) {
    for (const message of result.messages) {
      if (message.severity === 2 && shown++ < 40) {
        console.log(`${result.filePath}:${String(message.line)}:${String(message.column)} ${message.text} ${message.rule}`);
      }
    }
  }
}
process.exit(failed.length || unknown.length || regressed ? 1 : 0);
