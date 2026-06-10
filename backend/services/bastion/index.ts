/**
 * Bastion Service - Secret & Connection Management
 *
 * USAGE:
 * const bastion = createBastionClient({ bastionUrl: env.BASTION_URL });
 * const secret = await bastion.getSecret(jwt, 'integrations/api_key');
 */

export type { BastionDependencies, BastionConfig } from './BastionDependencies.js';

export { BastionCloudflareAdapter } from './adapters/BastionCloudflareAdapter.js';

import type { BastionDependencies, BastionConfig } from './BastionDependencies.js';
import { BastionCloudflareAdapter } from './adapters/BastionCloudflareAdapter.js';

/**
 * Factory to create Bastion client
 *
 * @param config - Configuration with fetcher
 */
export const createBastionClient = (config: BastionConfig): BastionDependencies => {
  return new BastionCloudflareAdapter(config);
};

export { BastionCloudflareAdapter as BastionClient } from './adapters/BastionCloudflareAdapter.js';
