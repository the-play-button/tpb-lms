// entropy-multiple-exports-ok: BastionPort module has 2 tightly-coupled exports sharing internal state
import type { ConnectionInfo } from '../types/ConnectionInfo.js';

/**
 * Bastion Port interface
 *
 * Provides access to:
 * - Vault secrets
 * - User storage connections
 */
export interface BastionPort {
  /**
   * Get secret from vault
   * @param jwt - User's CF Access JWT for authentication
   * @param path - Secret path (e.g., 'integrations/unifiedto_api_token')
   * @returns Secret value or null if not found
   */
  getSecret(jwt: string, path: string): Promise<string | null>;

  /**
   * Get ALL storage connections for the user
   * @param jwt - User's CF Access JWT
   */
  getAllStorageConnections(jwt: string): Promise<ConnectionInfo[]>;

  /**
   * Get connections filtered by integration type
   * @param jwt - User's CF Access JWT
   * @param provider - Integration type (e.g., 'sharepoint', 'onedrive')
   */
  getConnectionsByProvider(jwt: string, provider: string): Promise<ConnectionInfo[]>;

  /**
   * Get user's default storage connection
   * @param jwt - User's CF Access JWT
   * @throws Error if no connection configured
   */
  getDefaultStorageConnection(jwt: string): Promise<ConnectionInfo>;
}

/**
 * Configuration for Bastion adapters
 */
export interface BastionConfig {
  bastionUrl: string;
}
