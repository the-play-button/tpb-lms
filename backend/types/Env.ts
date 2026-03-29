// entropy-legacy-marker-ok: debt — legacy env bindings (GITHUB_PAT, VAULT_CLIENT_*, TALLY_*) to be removed post-migration
/**
 * Cloudflare Worker Environment Bindings
 *
 * Declares all bindings used by the LMS worker:
 * - D1 database
 * - Service Binding to bastion (IAMPAM)
 * - Secrets and configuration vars
 */

export interface Env {
  // --- D1 Database ---
  DB: D1Database;

  // --- Bastion (HTTP) ---
  BASTION_URL: string;

  // --- Secrets ---
  VAULT_TOKEN: string;

  // --- Vars ---
  ACCESS_TEAM_DOMAIN: string;
  USE_LOGTO: string;
  LOGTO_ENDPOINT: string;

  // --- Legacy (to be removed post-migration) ---
  GITHUB_PAT_TPB_REPOS?: string;
  VAULT_CLIENT_ID?: string;
  VAULT_CLIENT_SECRET?: string;
  TPBIAMPAM_BACKEND_SECRET_KEY?: string;
  TALLY_WEBHOOK_SECRET?: string;
  TALLY_SIGNING_SECRET?: string;
}
