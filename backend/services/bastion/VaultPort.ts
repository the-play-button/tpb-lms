/**
 * VaultPort — bastion `vault` BC consumer port (tpb-lms).
 * Plan 07 of 2026-06-02_sdk-connections-doctrine-and-entropy-checks/.
 */
export interface VaultPort {
  /**
   * Get secret from vault.
   * @param jwt - User's CF Access JWT for authentication
   * @param path - Secret path (e.g., 'integrations/{provider}_api_token')
   * @returns Secret value or null if not found
   */
  getSecret(jwt: string, path: string): Promise<string | null>;
}

export interface BastionConfig {
  bastionUrl: string;
}
