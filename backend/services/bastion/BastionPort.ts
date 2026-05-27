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
   * @param path - Secret path (e.g., 'integrations/{provider}_api_token')
   * @returns Secret value or null if not found
   */
  getSecret(jwt: string, path: string): Promise<string | null>;

  /**
   * Get the OAuth access_token (per-connection) from bastion D1 mirror.
   * Bastion is the SSOT for connection auth.
   *
   * @param jwt - User's CF Access JWT
   * @param connectionId - User's storage connection id
   * @returns auth payload with access_token + other_auth_info
   */
  getConnectionAuth(jwt: string, connectionId: string): Promise<BastionConnectionAuth>;

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

export interface BastionConnectionAuth {
  access_token?: string;
  other_auth_info?: Array<{ key: string; value: string }>;
}

/**
 * Configuration for Bastion adapters
 */
export interface BastionConfig {
  bastionUrl: string;
}
