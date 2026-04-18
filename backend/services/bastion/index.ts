/**
 * Bastion Service - Secret & Connection Management
 *
 * USAGE: // entropy-single-use-variables-ok: usage example in JSDoc
 * const bastion = createBastionClient({ bastionUrl: env.BASTION_URL });
 * const secret = await bastion.getSecret(jwt, 'integrations/api_key');
 */

export type { BastionPort, BastionConfig } from './BastionPort.js';

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

export { BastionCloudflareAdapter as BastionClient } from './adapters/BastionCloudflareAdapter.js';
