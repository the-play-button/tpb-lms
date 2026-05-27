/**
 * Bastion HTTP Adapter - Production implementation
 *
 * Connects to TPB Bastion via HTTP.
 * Uses CF Access JWT for authentication.
 */

import type { BastionPort, BastionConfig } from '../BastionPort.js';
import type { ConnectionInfo } from '../../types/ConnectionInfo.js';
import { bastionFetch } from './BastionCloudflareAdapter.functions/bastionFetch.js';
import { getSecret } from './BastionCloudflareAdapter.functions/getSecret.js';
import { getAllStorageConnections } from './BastionCloudflareAdapter.functions/getAllStorageConnections.js';
import { getConnectionsByProvider } from './BastionCloudflareAdapter.functions/getConnectionsByProvider.js';
import { getDefaultStorageConnection } from './BastionCloudflareAdapter.functions/getDefaultStorageConnection.js';

export class BastionCloudflareAdapter implements BastionPort {
  private bastionUrl: string;

  constructor(config: BastionConfig) {
    this.bastionUrl = config.bastionUrl;
  }

  /**
   * Make authenticated request to bastion
   */
  private async bastionFetch(path: string, jwt: string): Promise<Response> {
    return bastionFetch(this.bastionUrl, path, jwt);
  }

  async getSecret(jwt: string, path: string): Promise<string | null> {
    return getSecret(this.bastionUrl, jwt, path);
  }

  async getAllStorageConnections(jwt: string): Promise<ConnectionInfo[]> {
    return getAllStorageConnections(this.bastionUrl, jwt);
  }

  async getConnectionsByProvider(jwt: string, provider: string): Promise<ConnectionInfo[]> {
    return getConnectionsByProvider(this.bastionUrl, jwt, provider);
  }

  async getDefaultStorageConnection(jwt: string): Promise<ConnectionInfo> {
    return getDefaultStorageConnection(this.bastionUrl, jwt);
  }
}
