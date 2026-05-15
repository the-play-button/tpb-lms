// entropy-legacy-marker-ok: debt — legacy env bindings (TALLY_*) to be removed post-migration
/**
 * Cloudflare Worker Environment Bindings
 *
 * Declares all bindings used by the LMS worker:
 * - D1 database
 * - Bastion URL + token (HTTP)
 * - Secrets and configuration vars
 */

import type { BastionClientEnv } from '@the-play-button/tpb-sdk-js';

export interface Env extends BastionClientEnv {
  // --- D1 Database ---
  DB: D1Database;

  // --- Vars ---
  ACCESS_TEAM_DOMAIN: string;

  // --- Legacy (to be removed post-migration) ---
  BASTION_BACKEND_SECRET_KEY?: string;
  TALLY_WEBHOOK_SECRET?: string;
  TALLY_SIGNING_SECRET?: string;
}
