/**
 * Bastion Service - Secret & Connection Management
 *
 * USAGE:
 * const bastion = createBastionClient({ bastionUrl: env.BASTION_URL });
 * const secret = await bastion.getSecret(jwt, 'integrations/api_key');
 */

// Port types
export type { BastionPort, BastionConfig } from './BastionPort.js';

// Adapters
export { BastionCloudflareAdapter } from './adapters/BastionCloudflareAdapter.js';

import type { BastionPort, BastionConfig } from './BastionPort.js';
import { BastionCloudflareAdapter } from './adapters/BastionCloudflareAdapter.js';

/**
 * Factory to create Bastion client
 *
 * @param config - Configuration with fetcher
 */
export const createBastionClient = (config: BastionConfig): BastionPort => {
  return new BastionCloudflareAdapter(config);
};

// Backward compatibility - export class as BastionClient alias
export { BastionCloudflareAdapter as BastionClient } from './adapters/BastionCloudflareAdapter.js';
