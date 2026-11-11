/** Verify npm's actual tarball inventory against the package's declared public entrypoints. */
// Every input arrives `unknown` and is shaped by a guard: shipped in every repository's scripts/ by the deploy kit, this file
// is linted there by typed rules (tpb-devops plan 07.1.2.1.1.1, scripts/__tests__/test_deploy_kit_lints_clean.py).
import { readFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/** @param {unknown} target @param {string} rule @returns {string} */
function relativePackagePath(target, rule) {
  if (typeof target !== 'string' || !target || /[\\\x00-\x1f]/.test(target) || /^[A-Za-z]:/.test(target)) {
    throw new Error(`${rule}: expected a nonempty relative path`);
  }
  const path = target.startsWith('./') ? target.slice(2) : target;
  if (!path || path.startsWith('/') || path.split('/').includes('..')) throw new Error(`${rule}: ${target}`);
  return path;
}

/** @param {string} path @param {string} pattern */
function coversFile(path, pattern) {
  if (posix.matchesGlob(path, pattern)) return true;
  // npm includes a selected directory's descendants, including when a glob selects that directory.
  for (let directory = posix.dirname(path); directory !== '.'; directory = posix.dirname(directory)) {
    if (posix.matchesGlob(directory, pattern)) return true;
  }
  return pattern === '.';
}

/** @param {unknown} manifest @param {unknown} receipt */
export function verifyNpmPackageArtifact(manifest, receipt) {
  if (!Array.isArray(receipt) || receipt.length !== 1) throw new Error('NPM_ARTIFACT_INVALID_RECEIPT: expected one packed artifact');
  const packed = /** @type {unknown[]} */ (receipt)[0];
  if (!isRecord(packed)) throw new Error('NPM_ARTIFACT_INVALID_RECEIPT: expected one packed artifact');
  if (!isRecord(manifest)) throw new Error('NPM_ARTIFACT_INVALID_MANIFEST: expected an object');
  if (packed.name !== manifest.name || packed.version !== manifest.version) {
    throw new Error(`NPM_ARTIFACT_WRONG_IDENTITY: expected ${String(manifest.name)}@${String(manifest.version)}, received ${String(packed.name)}@${String(packed.version)}`);
  }
  const inventory = packed.files;
  if (!Array.isArray(inventory) || packed.entryCount !== inventory.length) {
    throw new Error('NPM_ARTIFACT_INVALID_INVENTORY: files and entryCount differ');
  }
  /** @type {Map<string, number>} */
  const files = new Map();
  for (const file of /** @type {unknown[]} */ (inventory)) {
    const path = relativePackagePath(isRecord(file) ? file.path : undefined, 'NPM_ARTIFACT_INVALID_INVENTORY');
    const size = isRecord(file) ? file.size : undefined;
    if (files.has(path) || typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0) {
      throw new Error('NPM_ARTIFACT_INVALID_INVENTORY: unsafe, repeated or invalid file');
    }
    files.set(path, size);
  }
  /** @type {Set<string>} */
  const required = new Set(['package.json']);
  /** @param {unknown} target */
  const add = (target) => {
    required.add(relativePackagePath(target, 'NPM_ARTIFACT_INVALID_ENTRYPOINT'));
  };
  for (const field of ['main', 'module', 'types', 'typings']) if (manifest[field] !== undefined) add(manifest[field]);
  const bin = manifest.bin;
  if (typeof bin === 'string') add(bin);
  else if (bin !== undefined) {
    if (!isRecord(bin)) throw new Error('NPM_ARTIFACT_INVALID_ENTRYPOINT: bin');
    for (const target of Object.values(bin)) add(target);
  }
  /** @param {unknown} value */
  const visitExports = (value) => {
    if (value === null) return; // A deliberately blocked export has no entrypoint.
    if (typeof value === 'string') { add(value); return; }
    if (!value || typeof value !== 'object') throw new Error('NPM_ARTIFACT_INVALID_ENTRYPOINT: exports');
    for (const target of /** @type {unknown[]} */ (Object.values(value))) visitExports(target);
  };
  if (manifest.exports !== undefined) visitExports(manifest.exports);
  if (required.size === 1) throw new Error('NPM_ARTIFACT_INVALID_ENTRYPOINT: package declares no public entrypoint');
  /** @type {string[]} */
  const missing = [];
  for (const path of required) {
    // npm export substitutions can contain '/', unlike a files glob's single '*'.
    if (path.includes('*')) {
      const pattern = new RegExp('^' + path.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
      if (![...files].some(([name, size]) => size > 0 && pattern.test(name))) missing.push(path);
    } else if (!((files.get(path) ?? 0) > 0)) missing.push(path);
  }
  if (missing.length) throw new Error(`NPM_ARTIFACT_MISSING_ENTRYPOINT: ${missing.join(', ')}`);
  /** @type {string[]} */
  const positivePatterns = [];
  const declared = manifest.files;
  if (declared !== undefined) {
    if (!Array.isArray(declared)) throw new Error('NPM_ARTIFACT_INVALID_FILES: expected an array');
    for (const pattern of /** @type {unknown[]} */ (declared)) {
      const negative = typeof pattern === 'string' && pattern.startsWith('!');
      const path = relativePackagePath(negative ? pattern.slice(1) : pattern, 'NPM_ARTIFACT_INVALID_FILES');
      if (!negative) positivePatterns.push(path.replace(/\/+$/, ''));
    }
  }
  const missingFiles = positivePatterns.filter(pattern =>
    ![...files].some(([path, size]) => size > 0 && coversFile(path, pattern)));
  if (missingFiles.length) throw new Error(`NPM_ARTIFACT_MISSING_FILES: ${missingFiles.join(', ')}`);
  return { name: packed.name, version: packed.version, entries: files.size, publicEntrypoints: required.size - 1,
    fileObligations: positivePatterns.length, integrity: packed.integrity };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [manifestPath, receiptPath] = process.argv.slice(2);
  if (!manifestPath || !receiptPath) throw new Error('Usage: node scripts/verify-npm-package-artifact.mjs <source-package.json> <npm-pack-receipt.json>');
  const proof = verifyNpmPackageArtifact(/** @type {unknown} */ (JSON.parse(readFileSync(manifestPath, 'utf8'))),
    /** @type {unknown} */ (JSON.parse(readFileSync(receiptPath, 'utf8'))));
  console.log(JSON.stringify(proof));
}
