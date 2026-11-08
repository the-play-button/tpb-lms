#!/usr/bin/env node
// Adds the SDK telemetry pair (TELEMETRY_URL + TELEMETRY_INGEST_CLIENT_ID) to the vars of a Worker's wrangler config,
// AFTER materialize_public_env.py produced it. Shipped to every Worker repository by generate_workflows.py (deploy kit),
// byte-identical to tpb-devops/scripts/materialize-telemetry-vars.mjs, its source.
//
// Why : the SDK's error handler reports unhandled 500s through its bearer-free sink only when this pair is in the Worker
// env. Without it every backend 500 of the Worker is invisible in telemetry (sub-30, 2026-10-23 : BI and accounting ;
// 2026-11-08 : 34 Workers of 44, tpb-crm and wge-tpb-bridge among them, modern-data-stack plan 06.1.1.1).
// The values come from the SDK SSOT (`@the-play-button/tpb-sdk-js/telemetry-endpoints`), resolved from the Worker's own
// directory (a repository may declare the SDK in backend/ or a sub-package only), never typed here.
//
//   node scripts/materialize-telemetry-vars.mjs <dev|staging|production> <wrangler config>
// The pair goes into `[env.<target>.vars]` when the config declares that section (one config for every environment,
// tpb-bastion), else into the top-level `[vars]`.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const BEGIN = '# BEGIN AUTO-GENERATED SDK TELEMETRY BINDINGS';
const END = '# END AUTO-GENERATED SDK TELEMETRY BINDINGS';

/** @param {string} message @returns {never} */
function fail(message) {
  console.error(`[telemetry-vars] FATAL — ${message}`);
  process.exit(1);
}

const [target, file] = process.argv.slice(2);
if (!target || !file) fail('usage: materialize-telemetry-vars.mjs <dev|staging|production> <wrangler config>');

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null;
}

// Resolved at run time from the Worker's directory, so it carries no types : its shape is checked here, and a change of
// the SDK's endpoints table fails loud rather than writing an empty pair.
/** @type {unknown} */
const loaded = createRequire(join(resolve(dirname(file)), 'package.json'))('@the-play-button/tpb-sdk-js/telemetry-endpoints');
const endpoints = isRecord(loaded) && isRecord(loaded.TELEMETRY_ENDPOINTS_PER_ENV) ? loaded.TELEMETRY_ENDPOINTS_PER_ENV : undefined;
const entry = endpoints?.[target];
const config = isRecord(entry) && typeof entry.url === 'string' && typeof entry.ingestKey === 'string' && entry.url && entry.ingestKey
  ? { url: entry.url, ingestKey: entry.ingestKey }
  : fail(`no SDK telemetry endpoint for target "${target}"`);

const block = [
  BEGIN,
  `# Source: @the-play-button/tpb-sdk-js TELEMETRY_ENDPOINTS_PER_ENV.${target}.`,
  `TELEMETRY_URL = ${JSON.stringify(config.url)}`,
  `TELEMETRY_INGEST_CLIENT_ID = ${JSON.stringify(config.ingestKey)}`,
  END,
].join('\n');

let text = readFileSync(file, 'utf8');
const b = text.indexOf(BEGIN);
if (b !== -1) {
  const e = text.indexOf(END, b);
  if (e === -1) fail(`${file} has BEGIN without END`);
  text = text.slice(0, b) + block + text.slice(e + END.length);
} else {
  if (/^\s*TELEMETRY_(URL|INGEST_CLIENT_ID)\s*=/m.test(text)) fail(`${file} already sets TELEMETRY_* by hand ; the SDK owns these values`);
  const section = new RegExp(`^\\[env\\.${target}\\.vars\\][ \\t]*\\n`, 'm').exec(text) ?? /^\[vars\][ \t]*\n/m.exec(text);
  if (!section) fail(`${file} has neither [env.${target}.vars] nor a top-level [vars]`);
  const at = section.index + section[0].length;
  text = text.slice(0, at) + block + '\n' + text.slice(at);
}
writeFileSync(file, text);
console.log(`[telemetry-vars] ${file} → ${config.url}`);
