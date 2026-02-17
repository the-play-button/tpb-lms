/**
 * Bastion Cloudflare Adapter - Production implementation
 *
 * Connects to TPB Bastion via Cloudflare Service Binding.
 * Uses CF Access JWT for authentication.
 */

import type { BastionPort, BastionConfig } from '../BastionPort.js';
import type { ConnectionInfo } from '../../types/ConnectionInfo.js';
import type { IFetcher } from '../../types/IFetcher.js';
import { bastionFetch } from './BastionCloudflareAdapter.functions/bastionFetch.js';
import { getSecret } from './BastionCloudflareAdapter.functions/getSecret.js';
import { getAllStorageConnections } from './BastionCloudflareAdapter.functions/getAllStorageConnections.js';
import { getConnectionsByProvider } from './BastionCloudflareAdapter.functions/getConnectionsByProvider.js';
import { getDefaultStorageConnection } from './BastionCloudflareAdapter.functions/getDefaultStorageConnection.js';

export class BastionCloudflareAdapter implements BastionPort {
  private fetcher: IFetcher;

  constructor(config: BastionConfig) {
    this.fetcher = config.fetcher;
  }

  /**
   * Make authenticated request to bastion
   */
  private async bastionFetch(path: string, jwt: string): Promise<Response> {
    return bastionFetch(this.fetcher, path, jwt);
  }

  async getSecret(jwt: string, path: string): Promise<string | null> {
    return getSecret(this.fetcher, jwt, path);
  }

  async getAllStorageConnections(jwt: string): Promise<ConnectionInfo[]> {
    return getAllStorageConnections(this.fetcher, jwt);
  }

  async getConnectionsByProvider(jwt: string, provider: string): Promise<ConnectionInfo[]> {
    return getConnectionsByProvider(this.fetcher, jwt, provider);
  }

  async getDefaultStorageConnection(jwt: string): Promise<ConnectionInfo> {
    return getDefaultStorageConnection(this.fetcher, jwt);
  }
}
