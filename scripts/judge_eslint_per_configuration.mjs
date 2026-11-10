#!/usr/bin/env node
// judge_eslint_per_configuration.mjs [--write-baseline]
// Every tracked folder that carries an eslint configuration is judged by that configuration, against its own committed
// count in `.eslint-last-status.json` ({ "<folder>": <errors> }, '.' for the root; a folder without a count is judged at 0).
// Why: a flat configuration applies only to the eslint run started in its folder. The CI linted the root alone, so 15
// frontends of 24 were never judged, and one could not even start (tpb-devops plan 07.1.2.1.1.1, 2026-11-08).
// Each file is judged once, by its nearest configuration: a configured folder is ignored by its parent's run.
// The same code measures the committed counts (`--write-baseline`) and judges them in CI: no second reading of eslint.
// Report: $RUNNER_TEMP/eslint-per-configuration.json, one row per folder.
//
// A file's result is kept under a key that covers everything a typed rule reads (tpb-entropy plan 06.8.1.1.1.1.1): the
// file, its import closure by TypeScript's own resolution (cycles collapsed), and one key for the folder (its eslint
// configuration, lockfiles, package.json and tsconfig files up to the repository root, its global declarations, the eslint
// and node versions). eslint's own --cache keys a file on its content alone, and a type changed in an imported file would
// leave a stale verdict. Only the files whose key is missing are linted. The results live in $TPB_ESLINT_CACHE_DIRECTORY
// (the runner's, beside the entropy check cache), one file per configured folder, reduced to the keys of the run; without
// the variable every file is linted. Proved equal to a plain `eslint .` file by file, before and after a type change, on
// tpb-crm's frontend (1 170 errors, 18.6 s warm against 741 s cold, 2026-11-10).
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, posix, relative, resolve } from 'node:path';

const BASELINE = '.eslint-last-status.json';
// Copies kept as evidence or builds inside plans are not application code (tpb-fleet's _build qualifications, tpb-plans'
// .originals, 2026-11-08): never judged, never counted.
const IGNORED = /(^|\/)(node_modules|plans|_build|_evidence|\.originals)\//;
const CONFIGURATION = /(^|\/)eslint\.config\.(js|mjs|cjs|ts|mts|cts)$/;
// What a folder's verdict depends on beyond its files' closures, read in the folder and each parent up to the root.
const FOLDER_INPUTS = ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts', 'eslint.config.mts',
  'eslint.config.cts', 'pnpm-lock.yaml', 'package-lock.json', 'bun.lock', 'package.json', 'tsconfig.json'];
// eslint.lintFiles takes the missing files in batches: one call for thousands of files held every result at once.
const LINT_BATCH = 400;

const temporary = process.env.RUNNER_TEMP;
if (!temporary) throw new Error('RUNNER_TEMP is not set: the runner sets it, a measurement passes its own folder');
const writeBaseline = process.argv.includes('--write-baseline');
const cacheDirectory = process.env.TPB_ESLINT_CACHE_DIRECTORY ? resolve(process.env.TPB_ESLINT_CACHE_DIRECTORY) : null;

const listed = spawnSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
if (listed.status !== 0) throw new Error(`git ls-files failed: ${listed.stderr}`);
// Every tracked file: what `eslint .` started in a folder can judge (its configuration decides what it ignores). The
// copies under plans/ and _build/ only never carry a judged configuration.
const everyTracked = listed.stdout.split('\0').filter(Boolean);
const tracked = everyTracked.filter((path) => !IGNORED.test(path));
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
/** @param {...string} parts */
const sha = (...parts) => {
  const hash = createHash('sha256');
  for (const part of parts) hash.update(part);
  return hash.digest('hex');
};

// Everything read from disk arrives `unknown` and is shaped by a guard: shipped in every repository's scripts/, this file is
// linted there by typed rules (wge-tpb-bridge, 23 no-unsafe-* on JSON.parse's `any`, 2026-11-08).
/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/** @typedef {{ severity: number, line: number, column: number, text: string, rule: string }} Message */
/** @typedef {{ errorCount: number, messages: Message[] }} Verdict */
/** @typedef {{ filePath: string, errorCount: number, messages: Message[] }} Result */

/** @param {unknown} value @returns {Message} */
const toMessage = (value) => {
  const message = isRecord(value) ? value : {};
  return {
    severity: typeof message.severity === 'number' ? message.severity : 0,
    line: typeof message.line === 'number' ? message.line : 0,
    column: typeof message.column === 'number' ? message.column : 0,
    text: typeof message.message === 'string' ? message.message : typeof message.text === 'string' ? message.text : '',
    rule: typeof message.ruleId === 'string' ? message.ruleId : typeof message.rule === 'string' ? message.rule : '',
  };
};
/** @param {unknown} value @returns {Verdict | null} */
const toVerdict = (value) => {
  if (!isRecord(value) || typeof value.errorCount !== 'number' || !Array.isArray(value.messages)) return null;
  return { errorCount: value.errorCount, messages: /** @type {unknown[]} */ (value.messages).map(toMessage) };
};

// The kept results of one configured folder: { key: verdict }. An unreadable file is said aloud and judged cold.
/** @param {string | null} path @returns {Map<string, Verdict>} */
const readCache = (path) => {
  /** @type {Map<string, Verdict>} */
  const kept = new Map();
  if (path === null || !existsSync(path)) return kept;
  let parsed;
  try {
    parsed = /** @type {unknown} */ (JSON.parse(readFileSync(path, 'utf8')));
  } catch (error) {
    console.log(`eslint cache: ${path} unreadable, every file is linted (${String(error)})`);
    return kept;
  }
  if (!isRecord(parsed)) return kept;
  for (const [key, value] of Object.entries(parsed)) {
    const verdict = toVerdict(value);
    if (verdict !== null) kept.set(key, verdict);
  }
  return kept;
};
/** @param {string | null} path @param {Map<string, Verdict>} kept */
const writeCache = (path, kept) => {
  if (path === null) return;
  mkdirSync(dirname(path), { recursive: true });
  // Written beside, then renamed: a job stopped mid-write leaves the previous base, never half a file.
  writeFileSync(`${path}.partial`, JSON.stringify(Object.fromEntries(kept)));
  renameSync(`${path}.partial`, path);
};

/**
 * Each file's key: the folder's key, the file, and the fingerprint of its import closure (Tarjan's strongly connected
 * components in reverse topological order, so every closure costs linear time). Without TypeScript or a tsconfig, no typed
 * rule can read another file: the key is the folder's and the file's alone.
 * @param {string} folder absolute
 * @param {string} top absolute repository root
 * @param {string[]} judged absolute files eslint judges
 * @param {NodeJS.Require} requireHere
 * @returns {(file: string) => string}
 */
const closureKeys = (folder, top, judged, requireHere) => {
  /** @type {any} */
  let ts = null;
  try {
    ts = requireHere('typescript');
  } catch {
    ts = null;
  }
  const configPath = ts === null ? undefined : /** @type {string | undefined} */ (ts.findConfigFile(folder, ts.sys.fileExists, 'tsconfig.json'));
  const parsed = ts === null || configPath === undefined ? undefined
    : ts.getParsedCommandLineOfConfigFile(configPath, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined });
  /** @type {string[]} */
  const programFiles = parsed === undefined ? [] : /** @type {string[]} */ (parsed.fileNames).filter((file) => !file.includes('/node_modules/'));

  /** @type {string[]} */
  const folderInputs = [];
  for (let where = folder; ; where = dirname(where)) {
    for (const name of FOLDER_INPUTS) {
      const path = join(where, name);
      if (existsSync(path)) folderInputs.push(`${relative(top, path)}\0${readFileSync(path, 'utf8')}`);
    }
    if (where === top || where === dirname(where)) break;
  }
  for (const file of programFiles.filter((path) => path.endsWith('.d.ts')).sort()) {
    folderInputs.push(`${relative(top, file)}\0${readFileSync(file, 'utf8')}`);
  }
  const eslintManifest = /** @type {unknown} */ (JSON.parse(readFileSync(requireHere.resolve('eslint/package.json'), 'utf8')));
  const eslintVersion = isRecord(eslintManifest) && typeof eslintManifest.version === 'string' ? eslintManifest.version : '';
  const folderKey = sha(...folderInputs, `eslint ${eslintVersion}`, `node ${process.version}`, ts === null ? 'no typescript' : `typescript ${String(ts.version)}`);

  /** @type {Map<string, string>} */
  const contentHash = new Map();
  /** @param {string} file */
  const hashOf = (file) => {
    let hash = contentHash.get(file);
    if (hash === undefined) {
      hash = existsSync(file) ? sha(readFileSync(file, 'utf8')) : 'absent';
      contentHash.set(file, hash);
    }
    return hash;
  };
  if (parsed === undefined) return (file) => sha(folderKey, relative(top, file), hashOf(file));

  /** @type {Map<string, string[]>} */
  const edges = new Map();
  const resolution = ts.createModuleResolutionCache(folder, (/** @type {string} */ name) => name, parsed.options);
  for (const file of new Set([...programFiles, ...judged])) {
    const text = readFileSync(file, 'utf8');
    contentHash.set(file, sha(text));
    /** @type {Set<string>} */
    const targets = new Set();
    for (const imported of /** @type {{ fileName: string }[]} */ (ts.preProcessFile(text, true, true).importedFiles)) {
      const found = ts.resolveModuleName(imported.fileName, file, parsed.options, ts.sys, resolution).resolvedModule;
      if (found && !found.isExternalLibraryImport && !String(found.resolvedFileName).includes('/node_modules/')
        && found.resolvedFileName !== file) targets.add(String(found.resolvedFileName));
    }
    edges.set(file, [...targets]);
  }
  let next = 0;
  /** @type {Map<string, number>} */ const order = new Map();
  /** @type {Map<string, number>} */ const low = new Map();
  /** @type {Set<string>} */ const onStack = new Set();
  /** @type {string[]} */ const stack = [];
  /** @type {Map<string, number>} */ const componentOf = new Map();
  /** @type {string[][]} */ const components = [];
  for (const root of edges.keys()) {
    if (order.has(root)) continue;
    /** @type {[string, number][]} */
    const work = [[root, 0]];
    while (work.length) {
      const frame = work[work.length - 1];
      const [node, at] = frame;
      if (at === 0) { order.set(node, next); low.set(node, next); next += 1; stack.push(node); onStack.add(node); }
      const child = (edges.get(node) ?? [])[at];
      if (child !== undefined) {
        frame[1] += 1;
        if (!edges.has(child)) continue;
        if (!order.has(child)) work.push([child, 0]);
        else if (onStack.has(child)) low.set(node, Math.min(low.get(node) ?? 0, order.get(child) ?? 0));
        continue;
      }
      work.pop();
      const parent = work[work.length - 1];
      if (parent !== undefined) low.set(parent[0], Math.min(low.get(parent[0]) ?? 0, low.get(node) ?? 0));
      if (low.get(node) === order.get(node)) {
        /** @type {string[]} */
        const members = [];
        for (let member = stack.pop(); member !== undefined; member = stack.pop()) {
          onStack.delete(member);
          members.push(member);
          componentOf.set(member, components.length);
          if (member === node) break;
        }
        components.push(members.sort());
      }
    }
  }
  /** @type {string[]} */
  const closure = [];
  components.forEach((members, id) => {
    const hash = createHash('sha256');
    /** @type {Set<string>} */
    const outside = new Set();
    for (const member of members) {
      hash.update(relative(top, member)).update(hashOf(member));
      for (const target of edges.get(member) ?? []) {
        const other = componentOf.get(target);
        if (other === undefined) outside.add(`${relative(top, target)}\0${hashOf(target)}`);
        else if (other !== id) outside.add(closure[other] ?? '');
      }
    }
    for (const part of [...outside].sort()) hash.update(part);
    closure[id] = hash.digest('hex');
  });
  return (file) => sha(folderKey, relative(top, file), closure[componentOf.get(file) ?? -1] ?? hashOf(file));
};

/** @typedef {{ folder: string, state: string, exit?: number | null, detail?: string, errors?: number, files?: number, served?: number, results?: Result[] }} Row */

/**
 * One configured folder, judged as `eslint .` started in it would judge, its nested configured folders ignored, through
 * the eslint installed nearest to it.
 * @param {string} folder repository-relative
 * @param {string[]} nested folder-relative configured folders inside it
 * @returns {Promise<Row>}
 */
const judgeFolder = async (folder, nested) => {
  const absolute = resolve(folder);
  const top = resolve('.');
  const requireHere = createRequire(join(absolute, 'package.json'));
  /** @type {any} */
  let eslintModule;
  try {
    eslintModule = requireHere('eslint');
  } catch (error) {
    return { folder, state: 'eslint is not installed', exit: null, detail: `eslint does not resolve from ${folder}: ${String(error)}` };
  }
  try {
    const eslint = new eslintModule.ESLint({ cwd: absolute, cache: false, ignorePatterns: nested.map((relativePath) => `${relativePath}/**`) });
    /** @type {string[]} */
    const judged = [];
    for (const path of everyTracked) {
      if (folder !== '.' && !path.startsWith(`${folder}/`)) continue;
      const file = resolve(path);
      if (!existsSync(file) || await eslint.isPathIgnored(file)) continue;
      if ((await eslint.calculateConfigForFile(file)) === undefined) continue;
      judged.push(file);
    }
    if (!judged.length) return { folder, state: 'eslint judged no file', exit: 0 };
    const keyOf = closureKeys(absolute, top, judged, requireHere);
    const cachePath = cacheDirectory === null ? null : join(cacheDirectory, `${folder.replaceAll('/', '__')}.json`);
    const cache = readCache(cachePath);
    /** @type {Map<string, Verdict>} */
    const kept = new Map();
    /** @type {Result[]} */
    const results = [];
    /** @type {string[]} */
    const missing = [];
    for (const file of judged) {
      const key = keyOf(file);
      const verdict = cache.get(key);
      if (verdict === undefined) {
        missing.push(file);
        continue;
      }
      kept.set(key, verdict);
      results.push({ filePath: file, ...verdict });
    }
    for (let start = 0; start < missing.length; start += LINT_BATCH) {
      for (const linted of /** @type {unknown[]} */ (await eslint.lintFiles(missing.slice(start, start + LINT_BATCH)))) {
        if (!isRecord(linted) || typeof linted.filePath !== 'string' || typeof linted.errorCount !== 'number'
          || !Array.isArray(linted.messages)) throw new Error(`${folder}: eslint returned a result that is not one`);
        const verdict = { errorCount: linted.errorCount, messages: /** @type {unknown[]} */ (linted.messages).map(toMessage) };
        kept.set(keyOf(linted.filePath), verdict);
        results.push({ filePath: linted.filePath, ...verdict });
      }
    }
    writeCache(cachePath, kept);
    // eslint answered for no file: no verdict, never a green one (as the run in service).
    if (!results.length) return { folder, state: 'eslint judged no file', exit: 0 };
    return { folder, state: 'measured', errors: results.reduce((sum, result) => sum + result.errorCount, 0),
      files: results.length, served: judged.length - missing.length, results };
  } catch (error) {
    // A configuration that does not load, a parser that throws: no verdict, never a green one.
    return { folder, state: 'eslint did not complete', exit: null, detail: String(error instanceof Error ? error.stack ?? error.message : error).slice(0, 1500) };
  }
};

/** @type {Row[]} */
const rows = [];
for (const folder of folders) {
  rows.push(await judgeFolder(folder, folders.filter((other) => inside(other, folder)).map((other) => posix.relative(folder, other))));
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
  console.log(`eslint: ${row.folder} ${String(errors)} errors, ${String(row.files)} files (${String(row.served)} from the cache), baseline ${String(allowed)}`);
  if (errors <= allowed) continue;
  regressed = true;
  // Every error of a folder above its count, not the first forty : the new ones sit anywhere in the list, and a capped
  // list hid the four a dependency bump added to tpb-crm's 1 246 (tpb-devops plan 07.1.2.1.2.2, run 454).
  for (const result of row.results ?? []) {
    for (const message of result.messages) {
      if (message.severity === 2) {
        console.log(`${result.filePath}:${String(message.line)}:${String(message.column)} ${message.text} ${message.rule}`);
      }
    }
  }
}
// The exit code, not process.exit(): exiting drops what stdout still holds for a slow reader (tpb-crm's runner log stopped
// near the 4 260th of 4 293 errors, tpb-devops plan 07.1.2.1.2.2, run 460).
process.exitCode = failed.length || unknown.length || regressed ? 1 : 0;
